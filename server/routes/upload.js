import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ─── Supabase Storage client ─────────────────────────────────────────────────
// Uses the SERVICE ROLE key so it bypasses RLS for server-side uploads.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STORAGE_BUCKET = "property-images";

// ─── Multer config (memory storage — buffer sent directly to Supabase) ────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG and WEBP images are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per image
});

// ─── POST /api/upload/property-images/:propertyId ─────────────────────────────
// Accepts up to 10 images. Uploads to Supabase Storage bucket "property-images".
router.post(
  "/property-images/:propertyId",
  requireAuth,
  upload.array("images", 10),
  async (req, res) => {
    try {
      const { propertyId } = req.params;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "At least one image is required" });
      }

      // Verify property belongs to this owner
      const [propRows] = await pool.query(
        "SELECT owner_id FROM nivaas_properties WHERE id = ?",
        [propertyId]
      );
      if (propRows.length === 0) {
        return res.status(404).json({ error: "Property not found" });
      }
      if (propRows[0].owner_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const inserted = [];

      for (let i = 0; i < files.length; i++) {
        const file      = files[i];
        const ext       = path.extname(file.originalname).toLowerCase() || ".jpg";
        const fileName  = `${propertyId}/${uuidv4()}${ext}`;
        const id        = uuidv4();
        const isCover   = i === 0;

        // Upload buffer to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error("Supabase upload error:", uploadError.message);
          return res.status(500).json({ error: "Image upload failed: " + uploadError.message });
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(fileName);

        const url = publicUrlData.publicUrl;

        await pool.query(
          `INSERT INTO nivaas_property_images
             (id, property_id, url, storage_path, is_cover, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, propertyId, url, fileName, isCover, i]
        );

        inserted.push({ id, url, is_cover: isCover, sort_order: i });
      }

      // Update cover_image_url on the property
      await pool.query(
        "UPDATE nivaas_properties SET cover_image_url = ? WHERE id = ?",
        [inserted[0].url, propertyId]
      );

      res.status(201).json({ images: inserted, count: inserted.length });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── DELETE /api/upload/property-images/:imageId ──────────────────────────────
router.delete("/property-images/:imageId", requireAuth, async (req, res) => {
  try {
    const { imageId } = req.params;

    const [rows] = await pool.query(
      `SELECT pi.*, p.owner_id
       FROM nivaas_property_images pi
       JOIN nivaas_properties p ON p.id = pi.property_id
       WHERE pi.id = ?`,
      [imageId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Image not found" });
    if (rows[0].owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Delete from Supabase Storage
    if (rows[0].storage_path) {
      const { error: removeError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([rows[0].storage_path]);
      if (removeError) {
        console.warn("Supabase storage delete warning:", removeError.message);
        // Non-fatal — continue with DB deletion
      }
    }

    await pool.query("DELETE FROM nivaas_property_images WHERE id = ?", [imageId]);

    res.json({ message: "Image deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/upload/property-images/:propertyId ──────────────────────────────
router.get("/property-images/:propertyId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, url, is_cover, sort_order, caption FROM nivaas_property_images WHERE property_id = ? ORDER BY sort_order ASC",
      [req.params.propertyId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/saved — list saved properties for current user
router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, sp.saved_at
       FROM nivaas_saved_properties sp
       JOIN nivaas_properties p ON p.id = sp.property_id
       WHERE sp.user_id = ?
       ORDER BY sp.saved_at DESC`,
      [req.user.id]
    );

    // Attach images
    const ids = rows.map(r => r.id);
    let images = [];
    if (ids.length > 0) {
      [images] = await pool.query(
        "SELECT property_id, url FROM nivaas_property_images WHERE property_id IN (?) AND is_cover=1",
        [ids]
      );
    }
    const imgMap = {};
    images.forEach(i => { imgMap[i.property_id] = i.url; });

    const result = rows.map(p => ({
      ...p,
      images: p.cover_image_url ? [p.cover_image_url] : (imgMap[p.id] ? [imgMap[p.id]] : []),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/saved/:propertyId — save a property
router.post("/:propertyId", requireAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    await pool.query(
      "INSERT IGNORE INTO nivaas_saved_properties (id, user_id, property_id) VALUES (?, ?, ?)",
      [uuidv4(), req.user.id, propertyId]
    );
    await pool.query("UPDATE nivaas_properties SET saves_count = saves_count + 1 WHERE id = ?", [propertyId]);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/saved/:propertyId — unsave a property
router.delete("/:propertyId", requireAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    await pool.query(
      "DELETE FROM nivaas_saved_properties WHERE user_id = ? AND property_id = ?",
      [req.user.id, propertyId]
    );
    await pool.query(
      "UPDATE nivaas_properties SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = ?",
      [propertyId]
    );
    res.json({ saved: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/saved/check/:propertyId
router.get("/check/:propertyId", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM nivaas_saved_properties WHERE user_id = ? AND property_id = ?",
      [req.user.id, req.params.propertyId]
    );
    res.json({ saved: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

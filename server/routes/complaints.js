import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";

const router = Router();

// ─── GET /api/complaints ──────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const isAdmin = ["admin", "verification_team"].includes(req.user.role);
    const [rows] = await pool.query(
      `SELECT c.*,
              r.full_name  AS reporter_name, r.email AS reporter_email,
              p.title      AS property_title, p.city  AS property_city
       FROM nivaas_complaints c
       LEFT JOIN nivaas_users u       ON u.id = c.reported_user_id
       LEFT JOIN nivaas_users r       ON r.id = c.reporter_id
       LEFT JOIN nivaas_properties p  ON p.id = c.property_id
       ${isAdmin ? "" : "WHERE c.reporter_id = ?"}
       ORDER BY c.created_at DESC`,
      isAdmin ? [] : [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/complaints/:id ──────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*,
              r.full_name AS reporter_name, r.email AS reporter_email,
              p.title AS property_title
       FROM nivaas_complaints c
       LEFT JOIN nivaas_users r       ON r.id = c.reporter_id
       LEFT JOIN nivaas_properties p  ON p.id = c.property_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Complaint not found" });
    const c = rows[0];
    const isAdmin = ["admin", "verification_team"].includes(req.user.role);
    if (!isAdmin && c.reporter_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/complaints ─────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { property_id, reported_user_id, category = "other", subject, description } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ error: "subject and description are required" });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO nivaas_complaints
         (id, property_id, reporter_id, reported_user_id, category, subject, description)
       VALUES (?,?,?,?,?,?,?)`,
      [id, property_id || null, req.user.id, reported_user_id || null, category, subject, description]
    );

    const [admins] = await pool.query(
      "SELECT id FROM nivaas_users WHERE role = 'admin' LIMIT 5"
    );
    for (const admin of admins) {
      await createNotification(admin.id, "complaint_new",
        "New Complaint Received",
        `${category.replace(/_/g, " ")} complaint: ${subject}`,
        `/dashboard/admin/complaints/${id}`
      );
    }

    const [rows] = await pool.query("SELECT * FROM nivaas_complaints WHERE id = ?", [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/complaints/:id/status ────────────────────────────────────────
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const isAdmin = ["admin", "verification_team"].includes(req.user.role);
    if (!isAdmin) return res.status(403).json({ error: "Admins only" });

    const { status, admin_notes } = req.body;
    const resolved_at = status === "resolved" ? new Date() : null;

    await pool.query(
      "UPDATE nivaas_complaints SET status=?, admin_notes=?, resolved_at=? WHERE id=?",
      [status, admin_notes || null, resolved_at, req.params.id]
    );

    const [rows] = await pool.query(
      "SELECT reporter_id, subject FROM nivaas_complaints WHERE id=?",
      [req.params.id]
    );
    if (rows.length) {
      await createNotification(rows[0].reporter_id, "complaint_update",
        `Complaint ${status}`,
        `Your complaint "${rows[0].subject}" has been marked as ${status}.`,
        `/dashboard/complaints`
      );
    }

    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/complaints/:propertyId/reviews ─────────────────────────────────
router.post("/reviews/:propertyId", requireAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be 1–5" });
    }
    const id = uuidv4();
    // PostgreSQL: ON CONFLICT (property_id, reviewer_id) DO UPDATE
    await pool.query(
      `INSERT INTO nivaas_reviews (id, property_id, reviewer_id, rating, comment)
       VALUES (?,?,?,?,?)
       ON CONFLICT (property_id, reviewer_id) DO UPDATE
         SET rating = EXCLUDED.rating, comment = EXCLUDED.comment`,
      [id, propertyId, req.user.id, rating, comment || null]
    );

    const [propRows] = await pool.query(
      "SELECT owner_id, title FROM nivaas_properties WHERE id=?", [propertyId]
    );
    if (propRows.length) {
      await createNotification(propRows[0].owner_id, "review_new",
        "New Review Received",
        `${rating}★ review on "${propRows[0].title}"`,
        `/properties/${propertyId}`
      );
    }

    const [review] = await pool.query(
      `SELECT rv.*, u.full_name AS reviewer_name, u.avatar_url AS reviewer_avatar
       FROM nivaas_reviews rv JOIN nivaas_users u ON u.id = rv.reviewer_id
       WHERE rv.property_id=? AND rv.reviewer_id=?`,
      [propertyId, req.user.id]
    );
    res.status(201).json(review[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

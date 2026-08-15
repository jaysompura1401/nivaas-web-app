import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/inquiries — inquiries for the current user (owner or customer)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { role } = req.user;
    let rows;
    if (role === "owner" || role === "admin") {
      [rows] = await pool.query(
        `SELECT i.*, p.title AS property_title, p.city,
                u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
         FROM nivaas_inquiries i
         JOIN nivaas_properties p ON p.id = i.property_id
         JOIN nivaas_users u ON u.id = i.customer_id
         WHERE i.owner_id = ?
         ORDER BY i.created_at DESC`,
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT i.*, p.title AS property_title, p.city, p.cover_image_url,
                u.full_name AS owner_name, u.phone AS owner_phone
         FROM nivaas_inquiries i
         JOIN nivaas_properties p ON p.id = i.property_id
         JOIN nivaas_users u ON u.id = i.owner_id
         WHERE i.customer_id = ?
         ORDER BY i.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inquiries — send inquiry
router.post("/", requireAuth, async (req, res) => {
  try {
    const { property_id, message, visit_date } = req.body;
    if (!property_id) return res.status(400).json({ error: "property_id required" });

    const [propRows] = await pool.query(
      "SELECT owner_id FROM nivaas_properties WHERE id = ?", [property_id]
    );
    if (propRows.length === 0) return res.status(404).json({ error: "Property not found" });
    const owner_id = propRows[0].owner_id;

    const id = uuidv4();
    await pool.query(
      `INSERT INTO nivaas_inquiries (id, property_id, customer_id, owner_id, message, visit_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, property_id, req.user.id, owner_id, message || null, visit_date || null]
    );
    await pool.query(
      "UPDATE nivaas_properties SET inquiries_count = inquiries_count + 1 WHERE id = ?",
      [property_id]
    );

    const [newInq] = await pool.query("SELECT * FROM nivaas_inquiries WHERE id = ?", [id]);
    res.status(201).json(newInq[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/inquiries/:id/status
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query(
      "UPDATE nivaas_inquiries SET status = ? WHERE id = ? AND owner_id = ?",
      [status, req.params.id, req.user.id]
    );
    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

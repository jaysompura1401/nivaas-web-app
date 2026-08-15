import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/agreements
router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ag.*,
              p.title AS property_title, p.city,
              o.full_name AS owner_name,
              t.full_name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone
       FROM nivaas_agreements ag
       JOIN nivaas_properties p ON p.id = ag.property_id
       JOIN nivaas_users o ON o.id = ag.owner_id
       JOIN nivaas_users t ON t.id = ag.tenant_id
       WHERE ag.owner_id = ? OR ag.tenant_id = ?
       ORDER BY ag.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agreements
router.post("/", requireAuth, async (req, res) => {
  try {
    const { property_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, notes } = req.body;
    if (!property_id || !tenant_id || !start_date || !end_date || !monthly_rent) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO nivaas_agreements (id, property_id, owner_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, notes, status)
       VALUES (?,?,?,?,?,?,?,?,?, 'draft')`,
      [id, property_id, req.user.id, tenant_id, start_date, end_date, monthly_rent, security_deposit || null, notes || null]
    );
    const [rows] = await pool.query("SELECT * FROM nivaas_agreements WHERE id = ?", [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/agreements/:id/status
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query("UPDATE nivaas_agreements SET status = ? WHERE id = ? AND owner_id = ?",
      [status, req.params.id, req.user.id]);
    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";

const router = Router();

// ─── Admin-only guard ─────────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  if (!["admin", "verification_team"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get("/stats", requireAuth, adminOnly, async (_req, res) => {
  try {
    // PostgreSQL: SUM(CASE WHEN bool_col THEN 1 ELSE 0 END) instead of SUM(bool_col)
    const [[users]]      = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END) AS verified
       FROM nivaas_users`
    );
    const [[props]]      = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN verified = true THEN 1 ELSE 0 END) AS verified,
              SUM(views_count) AS total_views
       FROM nivaas_properties`
    );
    const [[complaints]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open
       FROM nivaas_complaints`
    );
    const [[visits]]     = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
       FROM nivaas_property_visits`
    );
    const [[revenue]]    = await pool.query(
      "SELECT SUM(amount) AS total_collected FROM nivaas_rent_payments WHERE status='paid'"
    );
    const [[agreements]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='signed' THEN 1 ELSE 0 END) AS active
       FROM nivaas_agreements`
    );

    res.json({ users, properties: props, complaints, visits, revenue, agreements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get("/users", requireAuth, adminOnly, async (req, res) => {
  try {
    const { role, q, limit = 50, offset = 0 } = req.query;
    const params = [];
    let where = "WHERE 1=1";
    if (role) { where += " AND role=?";                                   params.push(role); }
    if (q)    { where += " AND (full_name ILIKE ? OR email ILIKE ?)";     const l=`%${q}%`; params.push(l,l); }
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, role, is_verified, city, created_at
       FROM nivaas_users ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM nivaas_users ${where}`,
      params.slice(0, -2)
    );
    res.json({ data: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────
router.patch("/users/:id", requireAuth, adminOnly, async (req, res) => {
  try {
    const { role, is_verified } = req.body;
    const updates = [], vals = [];
    if (role        !== undefined) { updates.push("role=?");        vals.push(role); }
    if (is_verified !== undefined) { updates.push("is_verified=?"); vals.push(!!is_verified); }
    if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(req.params.id);
    await pool.query(`UPDATE nivaas_users SET ${updates.join(",")} WHERE id=?`, vals);

    await pool.query(
      "INSERT INTO nivaas_audit_logs (id, actor_id, action, entity, entity_id, details) VALUES (?,?,?,?,?,?)",
      [uuidv4(), req.user.id, "user_updated", "user", req.params.id, JSON.stringify(req.body)]
    );
    res.json({ message: "User updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/properties ────────────────────────────────────────────────
router.get("/properties", requireAuth, adminOnly, async (req, res) => {
  try {
    const { status, verification_status, city, q, limit = 50, offset = 0 } = req.query;
    const params = [];
    let where = "WHERE 1=1";
    if (status)              { where += " AND p.status=?";              params.push(status); }
    if (verification_status) { where += " AND p.verification_status=?"; params.push(verification_status); }
    if (city)                { where += " AND p.city=?";                params.push(city); }
    if (q)                   { where += " AND (p.title ILIKE ? OR p.locality ILIKE ?)"; const l=`%${q}%`; params.push(l,l); }
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT p.*, u.full_name AS owner_name, u.email AS owner_email
       FROM nivaas_properties p
       JOIN nivaas_users u ON u.id = p.owner_id
       ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/properties/:id ─────────────────────────────────────────
router.patch("/properties/:id", requireAuth, adminOnly, async (req, res) => {
  try {
    const { status, verified, verification_status } = req.body;
    const updates = [], vals = [];
    if (status              !== undefined) { updates.push("status=?");              vals.push(status); }
    if (verified            !== undefined) { updates.push("verified=?");            vals.push(!!verified); }
    if (verification_status !== undefined) { updates.push("verification_status=?"); vals.push(verification_status); }
    if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(req.params.id);
    await pool.query(`UPDATE nivaas_properties SET ${updates.join(",")} WHERE id=?`, vals);

    const [prop] = await pool.query("SELECT owner_id, title FROM nivaas_properties WHERE id=?", [req.params.id]);
    if (prop.length && (status || verified !== undefined)) {
      await createNotification(prop[0].owner_id, "property_status_change",
        "Property Status Updated",
        `"${prop[0].title}" has been ${status ?? (verified ? "verified" : "updated")}.`,
        `/dashboard/properties`
      );
    }

    await pool.query(
      "INSERT INTO nivaas_audit_logs (id, actor_id, action, entity, entity_id, details) VALUES (?,?,?,?,?,?)",
      [uuidv4(), req.user.id, "property_updated", "property", req.params.id, JSON.stringify(req.body)]
    );
    res.json({ message: "Property updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/complaints ────────────────────────────────────────────────
router.get("/complaints", requireAuth, adminOnly, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let where = "WHERE 1=1";
    const params = [];
    if (status) { where += " AND c.status=?"; params.push(status); }
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT c.*,
              r.full_name AS reporter_name, r.email AS reporter_email,
              p.title AS property_title
       FROM nivaas_complaints c
       LEFT JOIN nivaas_users r       ON r.id = c.reporter_id
       LEFT JOIN nivaas_properties p  ON p.id = c.property_id
       ${where}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────
router.get("/audit-logs", requireAuth, adminOnly, async (req, res) => {
  try {
    const { limit = 50, offset = 0, entity } = req.query;
    const params = [];
    let where = "WHERE 1=1";
    if (entity) { where += " AND al.entity=?"; params.push(entity); }
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT al.*, u.full_name AS actor_name, u.role AS actor_role
       FROM nivaas_audit_logs al
       LEFT JOIN nivaas_users u ON u.id = al.actor_id
       ${where}
       ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/revenue ───────────────────────────────────────────────────
// PostgreSQL: TO_CHAR() instead of DATE_FORMAT(), CURRENT_DATE - INTERVAL instead of DATE_SUB/CURDATE
router.get("/revenue", requireAuth, adminOnly, async (_req, res) => {
  try {
    const [monthly] = await pool.query(
      `SELECT TO_CHAR(paid_date, 'YYYY-MM') AS month,
              SUM(amount) AS total,
              COUNT(*) AS transactions
       FROM nivaas_rent_payments
       WHERE status='paid'
         AND paid_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY month ORDER BY month ASC`
    );
    const [byCity] = await pool.query(
      `SELECT p.city, SUM(rp.amount) AS total
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       JOIN nivaas_properties p  ON p.id  = ag.property_id
       WHERE rp.status='paid'
       GROUP BY p.city ORDER BY total DESC LIMIT 10`
    );
    res.json({ monthly, by_city: byCity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

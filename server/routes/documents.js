import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ─── GET /api/documents ───────────────────────────────────────────────────────
// Returns documents for the logged-in owner; filter by property_id optionally
router.get("/", requireAuth, async (req, res) => {
  try {
    const { property_id } = req.query;
    const isAdmin = ["admin", "verification_team"].includes(req.user.role);

    const params = [];
    let where = "WHERE 1=1";

    if (!isAdmin) {
      where += " AND d.owner_id = ?";
      params.push(req.user.id);
    }
    if (property_id) {
      where += " AND d.property_id = ?";
      params.push(property_id);
    }

    const [rows] = await pool.query(
      `SELECT d.*,
              p.title AS property_title,
              u.full_name AS owner_name
       FROM nivaas_documents d
       LEFT JOIN nivaas_properties p ON p.id = d.property_id
       LEFT JOIN nivaas_users      u ON u.id = d.owner_id
       ${where}
       ORDER BY d.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/documents ──────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { property_id, doc_type = "other", title, file_url, file_name, file_size } = req.body;
    if (!title || !file_url) {
      return res.status(400).json({ error: "title and file_url are required" });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO nivaas_documents
         (id, owner_id, property_id, doc_type, title, file_url, file_name, file_size)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, req.user.id, property_id || null, doc_type, title, file_url,
       file_name || null, file_size || null]
    );
    const [rows] = await pool.query("SELECT * FROM nivaas_documents WHERE id=?", [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/documents/:id ─────────────────────────────────────────────────
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT owner_id FROM nivaas_documents WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const isAdmin = ["admin", "verification_team"].includes(req.user.role);
    if (!isAdmin && rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { title, doc_type, is_verified } = req.body;
    const updates = [], vals = [];
    if (title !== undefined)       { updates.push("title=?");       vals.push(title); }
    if (doc_type !== undefined)    { updates.push("doc_type=?");    vals.push(doc_type); }
    if (is_verified !== undefined && isAdmin) {
      updates.push("is_verified=?");
      vals.push(is_verified ? 1 : 0);
    }
    if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(req.params.id);
    await pool.query(`UPDATE nivaas_documents SET ${updates.join(",")} WHERE id=?`, vals);
    const [updated] = await pool.query("SELECT * FROM nivaas_documents WHERE id=?", [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT owner_id FROM nivaas_documents WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await pool.query("DELETE FROM nivaas_documents WHERE id=?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

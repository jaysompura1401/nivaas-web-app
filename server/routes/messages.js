import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/messages/threads — grouped conversations
router.get("/threads", requireAuth, async (req, res) => {
  try {
    // PostgreSQL: CASE WHEN instead of MySQL's IF()
    const [rows] = await pool.query(
      `SELECT
         m.id, m.content, m.created_at, m.is_read,
         m.sender_id, m.receiver_id,
         CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
         u.full_name AS other_user_name, u.avatar_url AS other_user_avatar,
         p.title AS property_title, p.id AS property_id
       FROM nivaas_messages m
       JOIN nivaas_users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
       LEFT JOIN nivaas_properties p ON p.id = m.property_id
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );

    // Deduplicate into threads by other_user_id
    const seen = new Set();
    const threads = [];
    for (const row of rows) {
      const key = `${row.other_user_id}-${row.property_id || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        threads.push(row);
      }
    }
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/:userId?property_id= — messages between two users
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { property_id } = req.query;

    let sql = `
      SELECT m.*,
             su.full_name AS sender_name, su.avatar_url AS sender_avatar
      FROM nivaas_messages m
      JOIN nivaas_users su ON su.id = m.sender_id
      WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
    `;
    const params = [req.user.id, userId, userId, req.user.id];

    if (property_id) { sql += " AND m.property_id = ?"; params.push(property_id); }
    sql += " ORDER BY m.created_at ASC";

    const [rows] = await pool.query(sql, params);

    // Mark as read — PostgreSQL uses true/false
    await pool.query(
      "UPDATE nivaas_messages SET is_read = true WHERE receiver_id = ? AND sender_id = ?",
      [req.user.id, userId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages — send a message
router.post("/", requireAuth, async (req, res) => {
  try {
    const { receiver_id, content, property_id } = req.body;
    if (!receiver_id || !content) {
      return res.status(400).json({ error: "receiver_id and content required" });
    }
    const id = uuidv4();
    await pool.query(
      "INSERT INTO nivaas_messages (id, sender_id, receiver_id, property_id, content) VALUES (?,?,?,?,?)",
      [id, req.user.id, receiver_id, property_id || null, content]
    );
    const [rows] = await pool.query("SELECT * FROM nivaas_messages WHERE id = ?", [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

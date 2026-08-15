import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateRentReminders } from "../lib/notifications.js";

const router = Router();

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit)  || 30, 100);
    const offset = Number(req.query.offset) || 0;
    const [rows] = await pool.query(
      `SELECT * FROM nivaas_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    const [[{ unread }]] = await pool.query(
      "SELECT COUNT(*) AS unread FROM nivaas_notifications WHERE user_id=? AND is_read=false",
      [req.user.id]
    );
    res.json({ data: rows, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE nivaas_notifications SET is_read=true WHERE user_id=?",
      [req.user.id]
    );
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE nivaas_notifications SET is_read=true WHERE id=? AND user_id=?",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM nivaas_notifications WHERE id=? AND user_id=?",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notifications/trigger-reminders ───────────────────────────────
router.post("/trigger-reminders", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
    const result = await generateRentReminders();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

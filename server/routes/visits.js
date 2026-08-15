import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";

const router = Router();

// ─── GET /api/visits ──────────────────────────────────────────────────────────
// Returns visits for the logged-in user (as customer or as owner)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { role } = req.query; // ?role=owner or ?role=customer
    const isAdmin = ["admin", "verification_team"].includes(req.user.role);

    let where = "";
    const params = [];
    if (!isAdmin) {
      if (role === "owner") {
        where = "WHERE v.owner_id = ?";
        params.push(req.user.id);
      } else {
        where = "WHERE v.customer_id = ?";
        params.push(req.user.id);
      }
    }

    const [rows] = await pool.query(
      `SELECT v.*,
              p.title AS property_title, p.locality, p.city, p.cover_image_url,
              c.full_name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
              o.full_name AS owner_name, o.phone AS owner_phone
       FROM nivaas_property_visits v
       JOIN nivaas_properties p ON p.id = v.property_id
       JOIN nivaas_users c      ON c.id = v.customer_id
       JOIN nivaas_users o      ON o.id = v.owner_id
       ${where}
       ORDER BY v.visit_date DESC, v.visit_time DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/visits/:id ──────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.*,
              p.title AS property_title, p.locality, p.city, p.cover_image_url,
              c.full_name AS customer_name, c.phone AS customer_phone,
              o.full_name AS owner_name, o.phone AS owner_phone
       FROM nivaas_property_visits v
       JOIN nivaas_properties p ON p.id = v.property_id
       JOIN nivaas_users c      ON c.id = v.customer_id
       JOIN nivaas_users o      ON o.id = v.owner_id
       WHERE v.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Visit not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/visits ─────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const { property_id, visit_date, visit_time, visit_type = "in_person", notes } = req.body;
    if (!property_id || !visit_date || !visit_time) {
      return res.status(400).json({ error: "property_id, visit_date and visit_time are required" });
    }

    // Get property owner
    const [prop] = await pool.query(
      "SELECT owner_id, title FROM nivaas_properties WHERE id=?", [property_id]
    );
    if (!prop.length) return res.status(404).json({ error: "Property not found" });

    // Prevent owner booking their own property
    if (prop[0].owner_id === req.user.id) {
      return res.status(400).json({ error: "You cannot book a visit to your own property" });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO nivaas_property_visits
         (id, property_id, customer_id, owner_id, visit_date, visit_time, visit_type, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, property_id, req.user.id, prop[0].owner_id, visit_date, visit_time, visit_type, notes || null]
    );

    // Notify owner
    await createNotification(prop[0].owner_id, "visit_request",
      "New Visit Request",
      `Someone wants to visit "${prop[0].title}" on ${visit_date} at ${visit_time}`,
      "/dashboard/visits"
    );

    const [visit] = await pool.query("SELECT * FROM nivaas_property_visits WHERE id=?", [id]);
    res.status(201).json(visit[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/visits/:id ────────────────────────────────────────────────────
// Owner confirms/cancels; customer reschedules/cancels
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM nivaas_property_visits WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const visit = rows[0];

    const isOwner    = visit.owner_id    === req.user.id;
    const isCustomer = visit.customer_id === req.user.id;
    const isAdmin    = req.user.role === "admin";
    if (!isOwner && !isCustomer && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { status, visit_date, visit_time, cancel_reason, notes } = req.body;
    const updates = [];
    const vals    = [];

    if (status)        { updates.push("status=?");        vals.push(status); }
    if (visit_date)    { updates.push("visit_date=?");    vals.push(visit_date); }
    if (visit_time)    { updates.push("visit_time=?");    vals.push(visit_time); }
    if (cancel_reason) { updates.push("cancel_reason=?"); vals.push(cancel_reason); }
    if (notes)         { updates.push("notes=?");         vals.push(notes); }

    if (!updates.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(req.params.id);
    await pool.query(`UPDATE nivaas_property_visits SET ${updates.join(",")} WHERE id=?`, vals);

    // Notifications
    const [propRows] = await pool.query(
      "SELECT title FROM nivaas_properties WHERE id=?", [visit.property_id]
    );
    const propertyTitle = propRows[0]?.title ?? "the property";
    const notifyUserId  = isOwner ? visit.customer_id : visit.owner_id;

    if (status === "confirmed") {
      await createNotification(notifyUserId, "visit_confirmed",
        "Visit Confirmed",
        `Your visit to "${propertyTitle}" on ${visit.visit_date} has been confirmed.`,
        "/dashboard/visits"
      );
    } else if (status === "cancelled") {
      await createNotification(notifyUserId, "visit_cancelled",
        "Visit Cancelled",
        `Visit to "${propertyTitle}" has been cancelled. ${cancel_reason || ""}`,
        "/dashboard/visits"
      );
    } else if (status === "rescheduled") {
      await createNotification(notifyUserId, "visit_rescheduled",
        "Visit Rescheduled",
        `Visit to "${propertyTitle}" has been rescheduled to ${visit_date} at ${visit_time}.`,
        "/dashboard/visits"
      );
    }

    const [updated] = await pool.query("SELECT * FROM nivaas_property_visits WHERE id=?", [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/visits/:id ───────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT customer_id FROM nivaas_property_visits WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].customer_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await pool.query("DELETE FROM nivaas_property_visits WHERE id=?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

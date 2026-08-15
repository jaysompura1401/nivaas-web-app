import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";

const router = Router();

// ─── GET /api/verification/pending ───────────────────────────────────────────
router.get("/pending", requireAuth, async (req, res) => {
  try {
    const isStaff = ["admin", "verification_team"].includes(req.user.role);
    if (!isStaff) return res.status(403).json({ error: "Staff only" });

    const [rows] = await pool.query(
      `SELECT p.*,
              u.full_name AS owner_name, u.phone AS owner_phone, u.email AS owner_email
       FROM nivaas_properties p
       JOIN nivaas_users u ON u.id = p.owner_id
       WHERE p.verification_status IN ('pending', 'unverified')
       ORDER BY p.created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/verification/logs/:propertyId ───────────────────────────────────
router.get("/logs/:propertyId", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT vl.*, u.full_name AS verifier_name
       FROM nivaas_verification_logs vl
       JOIN nivaas_users u ON u.id = vl.verifier_id
       WHERE vl.property_id = ?
       ORDER BY vl.created_at DESC`,
      [req.params.propertyId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/verification/submit/:propertyId ───────────────────────────────
router.post("/submit/:propertyId", requireAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const [prop] = await pool.query(
      "SELECT owner_id, title, verification_status FROM nivaas_properties WHERE id=?",
      [propertyId]
    );
    if (!prop.length) return res.status(404).json({ error: "Property not found" });
    if (prop[0].owner_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    if (prop[0].verification_status === "verified") {
      return res.status(400).json({ error: "Property already verified" });
    }

    await pool.query(
      "UPDATE nivaas_properties SET verification_status='pending' WHERE id=?",
      [propertyId]
    );

    await pool.query(
      "INSERT INTO nivaas_verification_logs (id, property_id, verifier_id, action, notes) VALUES (?,?,?,?,?)",
      [uuidv4(), propertyId, req.user.id, "submitted", "Owner submitted for verification"]
    );

    const [staff] = await pool.query(
      "SELECT id FROM nivaas_users WHERE role IN ('admin','verification_team') LIMIT 5"
    );
    for (const s of staff) {
      await createNotification(s.id, "verification_pending",
        "Property Submitted for Verification",
        `"${prop[0].title}" has been submitted for review.`,
        `/dashboard/admin/verification`
      );
    }

    res.json({ message: "Submitted for verification" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/verification/action/:propertyId ───────────────────────────────
router.post("/action/:propertyId", requireAuth, async (req, res) => {
  try {
    const isStaff = ["admin", "verification_team"].includes(req.user.role);
    if (!isStaff) return res.status(403).json({ error: "Staff only" });

    const { action, notes, report_url } = req.body;
    const validActions = ["approved", "rejected", "inspection_done"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${validActions.join(", ")}` });
    }

    const { propertyId } = req.params;
    const [prop] = await pool.query(
      "SELECT owner_id, title FROM nivaas_properties WHERE id=?", [propertyId]
    );
    if (!prop.length) return res.status(404).json({ error: "Property not found" });

    if (action === "approved") {
      await pool.query(
        "UPDATE nivaas_properties SET verification_status='verified', verified=true WHERE id=?",
        [propertyId]
      );
    } else if (action === "rejected") {
      await pool.query(
        "UPDATE nivaas_properties SET verification_status='rejected' WHERE id=?",
        [propertyId]
      );
    }

    await pool.query(
      "INSERT INTO nivaas_verification_logs (id, property_id, verifier_id, action, notes, report_url) VALUES (?,?,?,?,?,?)",
      [uuidv4(), propertyId, req.user.id, action, notes || null, report_url || null]
    );

    const msg = action === "approved"
      ? `"${prop[0].title}" has been verified and marked with a Verified badge.`
      : action === "rejected"
        ? `"${prop[0].title}" verification was rejected. ${notes || ""}`
        : `Inspection completed for "${prop[0].title}".`;

    await createNotification(prop[0].owner_id,
      `verification_${action}`,
      `Property ${action.replace("_", " ")}`,
      msg,
      `/properties/${propertyId}`
    );

    await pool.query(
      `INSERT INTO nivaas_audit_logs (id, actor_id, action, entity, entity_id, details)
       VALUES (?,?,?,?,?,?)`,
      [uuidv4(), req.user.id, `verification_${action}`, "property", propertyId,
       JSON.stringify({ notes, report_url })]
    );

    res.json({ message: `Property ${action}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

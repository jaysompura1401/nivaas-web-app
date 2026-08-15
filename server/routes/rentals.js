import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";

const router = Router();

// ─── GET /api/rentals — owner view ───────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rp.*,
              ag.monthly_rent, ag.property_id,
              ag.rent_due_day, ag.grace_period_days, ag.late_fee_amount,
              p.title AS property_title, p.locality, p.city,
              t.full_name AS tenant_name, t.phone AS tenant_phone, t.email AS tenant_email
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       JOIN nivaas_properties p  ON p.id  = ag.property_id
       JOIN nivaas_users t       ON t.id  = ag.tenant_id
       WHERE ag.owner_id = ?
       ORDER BY rp.due_date DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/rentals/tenant — tenant's rent history ─────────────────────────
router.get("/tenant", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rp.*,
              ag.monthly_rent, ag.property_id, ag.start_date, ag.end_date,
              ag.rent_due_day, ag.grace_period_days,
              p.title AS property_title, p.locality, p.city, p.cover_image_url,
              o.full_name AS owner_name, o.phone AS owner_phone
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       JOIN nivaas_properties p  ON p.id  = ag.property_id
       JOIN nivaas_users o       ON o.id  = ag.owner_id
       WHERE ag.tenant_id = ?
       ORDER BY rp.due_date DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/rentals/stats ───────────────────────────────────────────────────
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const isOwner = req.query.role !== "tenant";

    const idField = isOwner ? "ag.owner_id" : "ag.tenant_id";
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN rp.status='paid' AND MONTH(rp.paid_date)=MONTH(CURDATE()) AND YEAR(rp.paid_date)=YEAR(CURDATE()) THEN rp.amount ELSE 0 END) AS collected,
         SUM(CASE WHEN rp.status IN ('pending') THEN rp.amount ELSE 0 END)  AS pending,
         SUM(CASE WHEN rp.status = 'overdue'    THEN rp.amount ELSE 0 END)  AS overdue,
         COUNT(DISTINCT ag.id) AS total_agreements
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       WHERE ${idField} = ?`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/rentals/:id/status — mark paid/overdue etc. ──────────────────
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { status, paid_date, transaction_id, payment_method } = req.body;
    await pool.query(
      "UPDATE nivaas_rent_payments SET status=?, paid_date=?, transaction_id=?, payment_method=? WHERE id=?",
      [status, paid_date || null, transaction_id || null, payment_method || null, req.params.id]
    );

    // Notify owner + tenant if paid
    if (status === "paid") {
      const [rows] = await pool.query(
        `SELECT rp.amount, rp.due_date,
                ag.owner_id, ag.tenant_id,
                p.title AS property_title
         FROM nivaas_rent_payments rp
         JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
         JOIN nivaas_properties p  ON p.id  = ag.property_id
         WHERE rp.id=?`,
        [req.params.id]
      );
      if (rows.length) {
        const r = rows[0];
        await createNotification(r.owner_id,  "rent_received",
          "Rent Payment Received",
          `₹${r.amount} received for "${r.property_title}" (due ${r.due_date}).`,
          "/dashboard/rentals"
        );
        await createNotification(r.tenant_id, "rent_paid",
          "Rent Payment Successful",
          `Your rent of ₹${r.amount} for "${r.property_title}" has been confirmed.`,
          "/dashboard/rentals"
        );
      }
    }

    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rentals/generate/:agreementId ──────────────────────────────────
// Auto-generate monthly rent payment rows for a signed agreement
router.post("/generate/:agreementId", requireAuth, async (req, res) => {
  try {
    const [agRows] = await pool.query(
      `SELECT ag.*, p.title AS property_title
       FROM nivaas_agreements ag
       JOIN nivaas_properties p ON p.id = ag.property_id
       WHERE ag.id=? AND ag.owner_id=?`,
      [req.params.agreementId, req.user.id]
    );
    if (!agRows.length) return res.status(404).json({ error: "Agreement not found or forbidden" });
    const ag = agRows[0];

    const start  = new Date(ag.start_date);
    const end    = new Date(ag.end_date);
    const dueDay = ag.rent_due_day || 1;

    // Build array of monthly due dates
    const payments = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), dueDay);
    if (cursor < start) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, dueDay);
    }

    while (cursor <= end) {
      payments.push({
        id:           uuidv4(),
        agreement_id: ag.id,
        amount:       ag.monthly_rent,
        due_date:     cursor.toISOString().slice(0, 10),
        status:       cursor < new Date() ? "overdue" : "pending",
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, dueDay);
    }

    // Insert only rows that don't already exist for this agreement/due_date
    let created = 0;
    for (const p of payments) {
      const [exists] = await pool.query(
        "SELECT id FROM nivaas_rent_payments WHERE agreement_id=? AND due_date=?",
        [ag.id, p.due_date]
      );
      if (!exists.length) {
        await pool.query(
          "INSERT INTO nivaas_rent_payments (id, agreement_id, amount, due_date, status) VALUES (?,?,?,?,?)",
          [p.id, p.agreement_id, p.amount, p.due_date, p.status]
        );
        created++;
      }
    }

    res.json({ message: `Generated ${created} payment rows`, total_months: payments.length, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/rentals/receipt/:id ─────────────────────────────────────────────
// Returns all data needed to render a rent receipt
router.get("/receipt/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rp.*,
              ag.monthly_rent, ag.security_deposit, ag.start_date, ag.end_date,
              ag.rent_due_day,
              p.title AS property_title, p.address, p.locality, p.city, p.state, p.pincode,
              o.full_name AS owner_name, o.phone AS owner_phone, o.email AS owner_email,
              t.full_name AS tenant_name, t.phone AS tenant_phone, t.email AS tenant_email
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       JOIN nivaas_properties p  ON p.id  = ag.property_id
       JOIN nivaas_users o       ON o.id  = ag.owner_id
       JOIN nivaas_users t       ON t.id  = ag.tenant_id
       WHERE rp.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Payment not found" });
    const receipt = rows[0];

    // Access control — only owner or tenant may download
    const isAllowed = receipt.owner_id === req.user.id ||
                      receipt.tenant_id === req.user.id ||
                      req.user.role === "admin";
    if (!isAllowed) return res.status(403).json({ error: "Forbidden" });

    // Add receipt number
    receipt.receipt_number = `NIVAAS-${receipt.id.slice(0, 8).toUpperCase()}`;
    receipt.generated_at   = new Date().toISOString();

    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

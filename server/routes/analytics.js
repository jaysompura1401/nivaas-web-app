import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/analytics/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const [props] = await pool.query(
      `SELECT
         SUM(p.views_count)     AS total_views,
         SUM(p.saves_count)     AS total_saves,
         SUM(p.inquiries_count) AS total_inquiries,
         COUNT(p.id)            AS total_listings,
         SUM(CASE WHEN p.status='active'  THEN 1 ELSE 0 END) AS active_listings,
         SUM(CASE WHEN p.status='rented'  THEN 1 ELSE 0 END) AS rented_listings,
         SUM(CASE WHEN p.verified = true  THEN 1 ELSE 0 END) AS verified_listings
       FROM nivaas_properties p
       WHERE p.owner_id = ?`,
      [req.user.id]
    );

    // PostgreSQL: CURRENT_DATE, date_trunc, EXTRACT instead of MySQL date functions
    const [payments] = await pool.query(
      `SELECT
         SUM(CASE WHEN rp.status='paid' AND EXTRACT(YEAR FROM rp.paid_date)=EXTRACT(YEAR FROM CURRENT_DATE) THEN rp.amount ELSE 0 END) AS yearly_collected,
         SUM(CASE WHEN rp.status='paid' AND EXTRACT(MONTH FROM rp.paid_date)=EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM rp.paid_date)=EXTRACT(YEAR FROM CURRENT_DATE) THEN rp.amount ELSE 0 END) AS monthly_collected,
         SUM(CASE WHEN rp.status IN ('pending','overdue') THEN rp.amount ELSE 0 END) AS pending_rent,
         COUNT(DISTINCT rp.id) AS total_transactions
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       WHERE ag.owner_id = ?`,
      [req.user.id]
    );

    const [visits] = await pool.query(
      `SELECT
         COUNT(*) AS total_visits,
         SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) AS pending_visits,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_visits
       FROM nivaas_property_visits
       WHERE owner_id = ?`,
      [req.user.id]
    );

    const [inquiries] = await pool.query(
      `SELECT COUNT(*) AS total_inquiries,
              SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS open_inquiries
       FROM nivaas_inquiries
       WHERE owner_id = ?`,
      [req.user.id]
    );

    const total   = Number(props[0].active_listings || 0) + Number(props[0].rented_listings || 0);
    const rented  = Number(props[0].rented_listings || 0);
    const conversion_rate = total > 0 ? Math.round((rented / total) * 100) : 0;

    res.json({
      ...props[0],
      ...payments[0],
      ...visits[0],
      ...inquiries[0],
      conversion_rate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/monthly — last 6 months rent income
// PostgreSQL: TO_CHAR() instead of DATE_FORMAT(); CURRENT_DATE - INTERVAL instead of DATE_SUB/CURDATE
router.get("/monthly", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         TO_CHAR(rp.paid_date, 'Mon') AS month,
         EXTRACT(MONTH FROM rp.paid_date)::int AS month_num,
         EXTRACT(YEAR  FROM rp.paid_date)::int AS year,
         SUM(rp.amount) AS total
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       WHERE ag.owner_id = ?
         AND rp.status = 'paid'
         AND rp.paid_date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY year, month_num, month
       ORDER BY year ASC, month_num ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/visits — visits per month
router.get("/visits", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         TO_CHAR(v.visit_date, 'Mon') AS month,
         EXTRACT(MONTH FROM v.visit_date)::int AS month_num,
         EXTRACT(YEAR  FROM v.visit_date)::int AS year,
         COUNT(*) AS total,
         SUM(CASE WHEN v.status='completed' THEN 1 ELSE 0 END) AS completed
       FROM nivaas_property_visits v
       WHERE v.owner_id = ?
         AND v.visit_date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY year, month_num, month
       ORDER BY year, month_num`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/tenant-summary
router.get("/tenant-summary", requireAuth, async (req, res) => {
  try {
    const [agreements] = await pool.query(
      `SELECT ag.*,
              p.title AS property_title, p.city, p.locality
       FROM nivaas_agreements ag
       JOIN nivaas_properties p ON p.id = ag.property_id
       WHERE ag.tenant_id = ? AND ag.status = 'signed'
       ORDER BY ag.created_at DESC LIMIT 1`,
      [req.user.id]
    );

    const [upcoming] = await pool.query(
      `SELECT rp.*
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       WHERE ag.tenant_id = ? AND rp.status IN ('pending','overdue')
       ORDER BY rp.due_date ASC LIMIT 1`,
      [req.user.id]
    );

    const [history] = await pool.query(
      `SELECT rp.*,
              p.title AS property_title
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       JOIN nivaas_properties p  ON p.id  = ag.property_id
       WHERE ag.tenant_id = ?
       ORDER BY rp.due_date DESC LIMIT 12`,
      [req.user.id]
    );

    const [complaints] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open
       FROM nivaas_complaints WHERE reporter_id = ?`,
      [req.user.id]
    );

    const [visits] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS upcoming
       FROM nivaas_property_visits WHERE customer_id = ?`,
      [req.user.id]
    );

    res.json({
      active_agreement: agreements[0] ?? null,
      next_payment:     upcoming[0]   ?? null,
      payment_history:  history,
      complaints:       complaints[0],
      visits:           visits[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

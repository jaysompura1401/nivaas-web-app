import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";

/**
 * Insert a notification row for a user.
 */
export async function createNotification(userId, type, title, body, link = null) {
  try {
    const id = uuidv4();
    await pool.query(
      "INSERT INTO nivaas_notifications (id, user_id, type, title, body, link) VALUES (?,?,?,?,?,?)",
      [id, userId, type, title, body, link]
    );
    return id;
  } catch (err) {
    console.error("createNotification error:", err.message);
    return null;
  }
}

/**
 * Generate automatic monthly rent reminder notifications for all active agreements.
 * PostgreSQL: CURRENT_DATE instead of CURDATE(), no MySQL date functions.
 */
export async function generateRentReminders() {
  try {
    const [payments] = await pool.query(
      `SELECT rp.id, rp.due_date, rp.amount,
              ag.tenant_id, ag.owner_id,
              p.title AS property_title
       FROM nivaas_rent_payments rp
       JOIN nivaas_agreements ag ON ag.id = rp.agreement_id
       JOIN nivaas_properties p  ON p.id  = ag.property_id
       WHERE rp.status IN ('pending', 'overdue')
         AND ag.status = 'signed'`
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const p of payments) {
      const due = new Date(p.due_date);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due - today) / 86400000);

      let title = null, body = null;

      if (diffDays === 7)  { title = "Rent Due in 7 Days";   body = `₹${p.amount} due on ${p.due_date} for ${p.property_title}`; }
      if (diffDays === 3)  { title = "Rent Due in 3 Days";   body = `₹${p.amount} due on ${p.due_date} for ${p.property_title}`; }
      if (diffDays === 1)  { title = "Rent Due Tomorrow";    body = `₹${p.amount} due tomorrow for ${p.property_title}`; }
      if (diffDays === 0)  { title = "Rent Due Today";        body = `₹${p.amount} is due today for ${p.property_title}`; }
      if (diffDays === -1) { title = "Rent Overdue – 1 Day";  body = `₹${p.amount} was due yesterday for ${p.property_title}. Please pay immediately.`; }
      if (diffDays === -3) { title = "Rent Overdue – 3 Days"; body = `₹${p.amount} is 3 days overdue for ${p.property_title}.`; }
      if (diffDays === -7) { title = "Rent Overdue – 7 Days"; body = `₹${p.amount} is 7 days overdue for ${p.property_title}. Escalating to owner.`; }

      if (title) {
        await createNotification(p.tenant_id, "rent_reminder", title, body, "/dashboard/rentals");
        if (diffDays < 0) {
          await createNotification(p.owner_id, "rent_overdue", "Tenant Rent Overdue", body, "/dashboard/rentals");
          // PostgreSQL uses true/false
          await pool.query(
            "UPDATE nivaas_rent_payments SET status='overdue' WHERE id=? AND status='pending'",
            [p.id]
          );
        }
      }
    }
    return { processed: payments.length };
  } catch (err) {
    console.error("generateRentReminders error:", err.message);
    return { error: err.message };
  }
}

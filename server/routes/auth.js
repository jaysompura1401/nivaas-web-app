import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendOtp as dispatchOtp, sendSmsOtp } from "../lib/sendOtp.js";

const router = Router();

// In-memory OTP store — key = email OR phone
const otpStore = new Map();

function generateOTP() {
  // TEMPORARY FIXED OTP — change to random in production
  return "123456";
}

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// Helper — send OTP to phone AND email (both)
async function issueOtp(email, phone) {
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

  // Store by email
  otpStore.set(email, { otp, expiresAt });

  // Also store by phone so verify-otp works with phone key too
  if (phone) {
    const normalized = phone.replace(/\s/g, "").replace(/^\+91/, "");
    otpStore.set(normalized, { otp, expiresAt });
    otpStore.set("+91" + normalized, { otp, expiresAt });
  }

  // Send SMS if phone provided
  if (phone) {
    await sendSmsOtp(phone, otp);
  } else {
    // Email fallback
    await dispatchOtp(email, otp);
  }

  return otp;
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, phone, password, role = "customer" } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [existing] = await pool.query(
      "SELECT id FROM nivaas_users WHERE email = ?", [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const id   = uuidv4();
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO nivaas_users (id, full_name, email, phone, password_hash, role, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, full_name || null, email, phone || null, hash, role]
    );

    // Issue OTP — SMS to phone if provided, else console
    await issueOtp(email, phone);

    const [rows] = await pool.query(
      "SELECT id, full_name, email, phone, avatar_url, city, role FROM nivaas_users WHERE id = ?",
      [id]
    );
    const user  = rows[0];
    const token = makeToken(user);

    res.status(201).json({ token, user, message: phone ? "OTP sent to mobile" : "OTP sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [rows] = await pool.query(
      "SELECT id, full_name, email, phone, avatar_url, city, role, password_hash FROM nivaas_users WHERE email = ?",
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid email or password" });

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash || "");
    if (!match) return res.status(401).json({ error: "Invalid email or password" });

    delete user.password_hash;
    const token = makeToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────────
// Body: { email, phone? }
router.post("/send-otp", async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) return res.status(400).json({ error: "Email or phone required" });

    const key = email || phone;
    await issueOtp(email || key, phone);

    res.json({ message: phone ? "OTP sent to mobile" : "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
// Body: { email, otp }  — looks up by email
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

    // Try email key first, then phone variants
    let stored = otpStore.get(email);

    if (!stored) return res.status(400).json({ error: "No OTP found. Request a new one." });
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ error: "OTP expired. Request a new one." });
    }
    if (stored.otp !== String(otp)) {
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    // Clear all keys for this OTP
    otpStore.delete(email);

    await pool.query("UPDATE nivaas_users SET is_verified = 1 WHERE email = ?", [email]);

    const [rows] = await pool.query(
      "SELECT id, full_name, email, phone, avatar_url, city, role FROM nivaas_users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const token = makeToken(user);
    res.json({ token, user, message: "Verified successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, full_name, email, phone, avatar_url, city, bio, role, is_verified FROM nivaas_users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put("/profile", requireAuth, async (req, res) => {
  try {
    const { full_name, phone, city, bio, avatar_url } = req.body;
    await pool.query(
      "UPDATE nivaas_users SET full_name=?, phone=?, city=?, bio=?, avatar_url=? WHERE id=?",
      [full_name || null, phone || null, city || null, bio || null, avatar_url || null, req.user.id]
    );
    const [rows] = await pool.query(
      "SELECT id, full_name, email, phone, avatar_url, city, bio, role FROM nivaas_users WHERE id = ?",
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

/**
 * sendOtp.js
 * SMS OTP via Fast2SMS (free, Indian numbers) with Twilio fallback.
 *
 * Priority:
 *   1. Fast2SMS   — if FAST2SMS_API_KEY is set
 *   2. Twilio     — if TWILIO_* is set
 *   3. Console    — development fallback (always prints)
 */

import axios from "axios";

// ─── Normalize phone ──────────────────────────────────────────────────────────
function normalizePhone(phone) {
  // Strip spaces, dashes, brackets
  let p = phone.replace(/[\s\-().+]/g, "");
  // Remove leading 91 if 12 digits (91XXXXXXXXXX)
  if (p.length === 12 && p.startsWith("91")) p = p.slice(2);
  // Should be 10 digits now
  return p;
}

// ─── Fast2SMS ─────────────────────────────────────────────────────────────────
async function sendVisFast2SMS(phone10, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey || apiKey === "your_fast2sms_api_key_here") return false;

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        variables_values: otp,
        route:            "otp",
        numbers:          phone10,
      },
      {
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    if (response.data?.return === true) {
      console.log(`✅ Fast2SMS OTP sent to ${phone10}`);
      return true;
    } else {
      console.error("Fast2SMS error:", response.data);
      return false;
    }
  } catch (err) {
    console.error("Fast2SMS failed:", err.response?.data || err.message);
    return false;
  }
}

// ─── Twilio ───────────────────────────────────────────────────────────────────
async function sendViaTwilio(phone10, otp) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE;

  if (
    !sid   || sid   === "your_account_sid_here"  || !sid.startsWith("AC") ||
    !token || token === "your_auth_token_here" ||
    !from  || from  === "+1234567890"
  ) return false;

  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(sid, token);
    await client.messages.create({
      body: `Your Nivaas OTP is: ${otp}. Valid 10 minutes. Do not share.`,
      from,
      to: `+91${phone10}`,
    });
    console.log(`✅ Twilio OTP sent to +91${phone10}`);
    return true;
  } catch (err) {
    console.error("Twilio failed:", err.message);
    return false;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Send OTP SMS to an Indian mobile number.
 * Always prints OTP to console as fallback.
 *
 * @param {string} phone - any format: "8306929541" / "+918306929541" / "918306929541"
 * @param {string} otp   - 6-digit string
 */
export async function sendSmsOtp(phone, otp) {
  const phone10 = normalizePhone(phone);

  // Always log — useful in dev even if SMS works
  console.log(`\n📱 SMS OTP for +91${phone10}: ${otp}   (valid 10 min)\n`);

  // 1. Try Fast2SMS
  const fast2smsOk = await sendVisFast2SMS(phone10, otp);
  if (fast2smsOk) return { sent: true, via: "fast2sms" };

  // 2. Try Twilio
  const twilioOk = await sendViaTwilio(phone10, otp);
  if (twilioOk) return { sent: true, via: "twilio" };

  // 3. Console only
  console.log("⚠️  No SMS provider configured — OTP printed to console only.");
  return { sent: false, via: "console" };
}

/**
 * Route OTP delivery — phone → SMS, email → console
 */
export async function sendOtp(identifier, otp) {
  const cleaned = identifier.replace(/\s/g, "");
  if (/^\+?[0-9]{8,15}$/.test(cleaned)) {
    return sendSmsOtp(cleaned, otp);
  }
  // Email — just log for now
  console.log(`\n📧 Email OTP for ${identifier}: ${otp}\n`);
  return { sent: false, via: "console" };
}

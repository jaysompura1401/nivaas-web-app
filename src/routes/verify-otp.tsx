import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, Shield, HelpCircle } from "lucide-react";
import heroPng from "@/assets/hero.png";
import { auth as authApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/verify-otp")({
  head: () => ({ meta: [{ title: "Verify OTP — Nivaas" }] }),
  component: VerifyOTPPage,
});

const GOLD  = "#C9921A";
const DARK  = "#0d0a06";
const DARK2 = "#1a1209";

function VerifyOTPPage() {
  const navigate     = useNavigate();
  const { applyAuth } = useAuth();
  const [otp, setOtp]         = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timer, setTimer]     = useState(30);
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([]);

  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const email  = search?.get("email") ?? "";
  const phone  = search?.get("phone") ?? "";
  const displayTo = phone ? `+91 ${phone}` : email;

  useEffect(() => {
    inputRefs.current[0]?.focus();
    const iv = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-submit when all 6 digits are entered — but only once
  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6 && !loading && !submitted && email) {
      // Small delay so the user sees all digits filled before submit fires
      const autoSubmitTimer = setTimeout(() => {
        const form = document.getElementById("otp-form") as HTMLFormElement | null;
        form?.requestSubmit();
      }, 300);
      return () => clearTimeout(autoSubmitTimer);
    }
  }, [otp, loading, submitted, email]);

  const handleChange = (i: number, val: string) => {
    // Handle paste into a single box (mobile SMS autofill injects full code into one input)
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, 6).split("");
      const next = [...otp];
      digits.forEach((d, idx) => { next[idx] = d; });
      setOtp(next);
      inputRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    if (val && !/^\d$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const next = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) { toast.error("Enter all 6 digits"); return; }
    if (!email) { toast.error("Email missing — sign in again"); return; }
    if (loading || submitted) return;   // prevent duplicate submissions
    setSubmitted(true);
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email, code);
      applyAuth(res.token, res.user);
      toast.success("Verified! Welcome to Nivaas.");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setSubmitted(false);   // allow retry on error
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (timer > 0 || !email) return;
    setTimer(30);
    try { await authApi.sendOtp(email); toast.success("OTP resent — check server console."); }
    catch { toast.error("Failed to resend"); }
  };

  const fmtTimer = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: DARK, fontFamily: "'Inter',sans-serif" }}>

      {/* ══════════════════════════════════════════════════
          LEFT — dark panel with text
      ══════════════════════════════════════════════════ */}
      <div className="relative hidden lg:flex lg:w-[30%] flex-col justify-between p-10 overflow-hidden">
        {/* Subtle building bg */}
        <img src={heroPng} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0d0a06 0%, rgba(13,10,6,0.85) 100%)" }} />

        {/* Dot grid */}
        <div className="relative z-10 grid grid-cols-5 gap-[6px] w-fit opacity-50">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: GOLD }} />
          ))}
        </div>

        {/* Logo + headline */}
        <div className="relative z-10 space-y-10">
          <Link to="/">
            <span style={{ color: GOLD, fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800 }}>
              Nivaas.
            </span>
          </Link>

          <div>
            <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 38, fontWeight: 700, lineHeight: 1.2, color: "#fff" }}>
              Your{" "}
              <span style={{ color: GOLD }}>perfect<br />home</span>{" "}
              is one step<br />closer.
            </h2>
            <div className="mt-4 h-[3px] w-10 rounded-full" style={{ backgroundColor: GOLD }} />
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)", maxWidth: 260 }}>
              Complete your verification to securely rent, buy, or manage your property — all in one place.
            </p>
          </div>

          {/* Feature pills row */}
          <div className="flex items-stretch rounded-2xl overflow-hidden divide-x divide-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {[
              { badge: "✓",  title: "Secure &\nTrusted"    },
              { badge: "✓",  title: "Verified\nListings"   },
              { badge: "24", title: "24/7 Support"          },
            ].map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-2 px-4 py-4 flex-1"
                style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                  style={{ border: `1.5px solid ${GOLD}`, color: GOLD }}>
                  {f.badge}
                </div>
                <p className="text-[11px] text-center whitespace-pre-line leading-snug"
                  style={{ color: "rgba(255,255,255,0.55)" }}>{f.title}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10" />
      </div>

      {/* ══════════════════════════════════════════════════
          CENTER — OTP card
      ══════════════════════════════════════════════════ */}
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px]">

          {/* Need help */}
          <div className="flex justify-end mb-3">
            <button className="flex items-center gap-1.5 text-[13px] font-medium"
              style={{ color: "rgba(255,255,255,0.45)" }}>
              <HelpCircle className="h-3.5 w-3.5" /> Need help?
            </button>
          </div>

          {/* Card */}
          <div className="rounded-3xl p-8"
            style={{ backgroundColor: "#1a1209", border: `1px solid rgba(201,146,26,0.2)`, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

            {/* Phone icon illustration */}
            <div className="flex justify-center mb-6">
              <div className="flex h-[80px] w-[80px] items-center justify-center rounded-full"
                style={{ backgroundColor: "#FAF6EE" }}>
                {/* Phone with lock SVG */}
                <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
                  <rect x="11" y="4" width="24" height="38" rx="4" stroke={GOLD} strokeWidth="2" fill="none" />
                  <circle cx="23" cy="37" r="1.5" fill={GOLD} />
                  <rect x="17" y="8" width="12" height="1.5" rx="0.75" fill={GOLD} opacity="0.35" />
                  <text x="17" y="24" fontSize="9" fill={GOLD} opacity="0.85" fontWeight="bold">✦✦✦</text>
                  {/* Lock badge */}
                  <circle cx="31" cy="31" r="7" fill="#1a1209" />
                  <circle cx="31" cy="31" r="6" stroke={GOLD} strokeWidth="1.5" fill="none" />
                  <rect x="28.5" y="30.5" width="5" height="4" rx="0.5" fill={GOLD} opacity="0.8" />
                  <path d="M29.5 30.5v-2a1.5 1.5 0 013 0v2" stroke={GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <h1 className="text-center text-2xl font-bold mb-2"
              style={{ color: GOLD, fontFamily: "'Sora',sans-serif" }}>
              Verify your mobile
            </h1>
            <p className="text-center text-[13px] mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              We've sent a 6-digit verification code to
            </p>
            <p className="text-center text-sm font-semibold mb-7" style={{ color: GOLD }}>
              {displayTo || "your registered contact"}
            </p>

            {/* OTP input boxes */}
            <form onSubmit={handleVerify} id="otp-form">
              <div className="flex justify-center gap-2.5 mb-6" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1}
                    autoComplete="one-time-code"
                    value={digit}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="h-12 w-11 text-center text-lg font-bold rounded-xl outline-none transition-all"
                    style={{
                      backgroundColor: digit ? "#FAF6EE" : "rgba(255,255,255,0.07)",
                      border: `2px solid ${digit ? GOLD : "rgba(255,255,255,0.14)"}`,
                      color: digit ? "#1a1209" : "#fff",
                      boxShadow: digit ? `0 0 0 1px ${GOLD}22` : "none",
                    }}
                    onFocus={e => { e.target.style.borderColor = GOLD; e.target.style.boxShadow = `0 0 0 3px ${GOLD}25`; }}
                    onBlur={e => {
                      e.target.style.borderColor = digit ? GOLD : "rgba(255,255,255,0.14)";
                      e.target.style.boxShadow = digit ? `0 0 0 1px ${GOLD}22` : "none";
                    }}
                  />
                ))}
              </div>

              {/* Verify & Continue */}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-[14px] text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
                style={{ backgroundColor: GOLD, boxShadow: "0 4px 20px rgba(201,146,26,0.45)" }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Continue"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>OR</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
            </div>

            {/* Resend OTP */}
            <button type="button" onClick={handleResend} disabled={timer > 0}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-3 transition hover:opacity-80 disabled:opacity-60"
              style={{ backgroundColor: "#fff", border: "1.5px solid #e8d9c0" }}>
              <MessageSquare className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: "#1a1209" }}>Resend OTP</p>
                {timer > 0 && (
                  <p className="text-[11px]" style={{ color: "#a08858" }}>Resend in {fmtTimer}</p>
                )}
              </div>
            </button>

            {/* Secure verification */}
            <div className="w-full flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: "rgba(201,146,26,0.08)", border: "1.5px solid rgba(201,146,26,0.2)" }}>
              <Shield className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#FAF6EE" }}>Secure verification</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Never share your OTP with anyone.</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT — hero.png building
      ══════════════════════════════════════════════════ */}
      <div className="relative hidden lg:block lg:w-[30%] overflow-hidden">
        <img src={heroPng} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(270deg, transparent 40%, rgba(13,10,6,0.6) 100%)" }} />
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import heroPng from "@/assets/hero.png";
import { auth as authApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nivaas" },
      { name: "description", content: "Sign in or create an account on Nivaas." },
    ],
  }),
  component: AuthPage,
});

const GOLD = "#C9921A";
const BG   = "#FAF6EE";

function AuthPage() {
  const navigate               = useNavigate();
  const { applyAuth, profile } = useAuth();
  const [tab, setTab]          = useState<"signin" | "signup">("signin");
  const [name, setName]        = useState("");
  const [email, setEmail]      = useState("");
  const [phone, setPhone]      = useState("");
  const [role, setRole]        = useState<"customer" | "owner">("customer");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]  = useState(false);

  useEffect(() => {
    if (getToken() && profile) navigate({ to: "/dashboard" });
  }, [profile, navigate]);

  // Sign in — send OTP to email (both email + phone required)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim())  { toast.error("Email is required"); return; }
    if (!phone.trim())  { toast.error("Phone number is required"); return; }
    setLoading(true);
    try {
      await authApi.sendOtp(email);
      toast.success("OTP sent! Use 123456 to verify.");
      navigate({ to: "/verify-otp", search: { email, phone } as never });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally { setLoading(false); }
  };

  // Create account — register then send OTP
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Email required"); return; }
    if (!phone) { toast.error("Phone number required"); return; }
    setLoading(true);
    try {
      // Use phone as temp password (user will verify via OTP)
      const tempPassword = `nivaas_${phone}_${Date.now()}`;
      const res = await authApi.register({
        full_name: name || undefined,
        email,
        phone,
        password: tempPassword,
        role,
      });
      applyAuth(res.token, res.user);
      toast.success("Account created! OTP sent to verify.");
      navigate({ to: "/verify-otp", search: { email, phone } as never });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: BG, fontFamily: "'Inter',sans-serif" }}>

      {/* ══ LEFT — hero.png ════════════════════════════════════════ */}
      <div className="relative hidden lg:flex lg:w-[52%] flex-col overflow-hidden">
        <img src={heroPng} alt="Nivaas"
          className="absolute inset-0 h-full w-full object-cover object-center" />
        {/* Gradient */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(180deg,rgba(250,246,238,0.45) 0%,rgba(0,0,0,0.05) 40%,rgba(0,0,0,0.42) 100%)" }} />

        {/* Dot grid */}
        <div className="absolute top-7 left-7 z-10 grid grid-cols-5 gap-[6px] opacity-80">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: GOLD }} />
          ))}
        </div>

        {/* Logo */}
        <div className="absolute top-9 left-9 z-10 mt-6">
          <Link to="/">
            <span style={{ color: GOLD, fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Nivaas.
            </span>
          </Link>
        </div>

        {/* Headline shown on Sign in tab */}
        {tab === "signin" && (
          <div className="absolute bottom-52 left-9 right-9 z-10">
            <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 34, fontWeight: 700, lineHeight: 1.22, color: "#fff", textShadow: "0 2px 16px rgba(0,0,0,0.22)" }}>
              A better way to{" "}
              <span style={{ color: GOLD }}>rent</span>,{" "}
              <span style={{ color: GOLD }}>buy</span>, and{" "}
              <span style={{ color: GOLD }}>manage</span>{" "}
              your home.
            </h2>
            <div className="mt-3 h-[3px] w-10 rounded-full" style={{ backgroundColor: GOLD }} />
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.78)", maxWidth: 295 }}>
              Verified listings, digital agreements, online rent payments, and AI-powered recommendations all in one place.
            </p>
          </div>
        )}

        {/* Stats bar */}
        <div className="absolute bottom-7 left-7 right-7 z-10">
          <div className="flex items-center rounded-2xl px-5 py-4"
            style={{ backgroundColor: "rgba(0,0,0,0.44)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {[
              { emoji: "📋", val: "25K+",  label: "Listings" },
              { emoji: "👤", val: "120K+", label: "Users"    },
              { emoji: "⭐", val: "4.9★",  label: "Rating"   },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 flex-1">
                {i > 0 && <div className="h-8 w-px mr-3" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                  style={{ backgroundColor: "rgba(201,146,26,0.22)" }}>
                  {s.emoji}
                </div>
                <div>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1 }}>{s.val}</p>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ RIGHT — Form (NO card border, direct on bg) ════════════ */}
      <div className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-14 overflow-y-auto"
        style={{ backgroundColor: BG }}>

        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Link to="/">
            <span style={{ color: GOLD, fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800 }}>Nivaas.</span>
          </Link>
        </div>

        <div className="w-full max-w-[460px] mx-auto">

          {/* White card wrapper */}
          <div className="rounded-2xl bg-white px-8 py-6"
            style={{ boxShadow: "0 4px 32px rgba(201,146,26,0.10), 0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f0e4cc" }}>

          {/* Heading */}
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: "#1a1209", marginBottom: 3, letterSpacing: "-0.01em" }}>
            Welcome to Nivaas
          </h1>
          <p style={{ fontSize: 13, color: "#836737", marginBottom: 18 }}>
            Sign in or create an account to continue.
          </p>

          {/* ── Tab switcher (pill) ── */}
          <div className="flex rounded-full p-[4px] mb-5"
            style={{ backgroundColor: "#ede8df", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.07)" }}>
            {(["signin", "signup"] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="flex-1 rounded-full py-[8px] text-sm font-semibold transition-all duration-200"
                style={tab === t
                  ? { backgroundColor: GOLD, color: "#fff", boxShadow: "0 3px 10px rgba(201,146,26,0.32)" }
                  : { color: "#836737", backgroundColor: "transparent" }}>
                {t === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════
              SIGN IN — Email + Phone only
          ══════════════════════════════════ */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-[10px]">

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-[5px]" style={{ color: "#1a1209" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-[14px] top-1/2 -translate-y-1/2 h-[15px] w-[15px]" style={{ color: "#c8b08a" }} />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@nivaas.com" required
                    className="w-full rounded-xl pl-10 pr-4 py-[9px] text-sm outline-none transition-all"
                    style={{ border: "1.5px solid #e8d9c0", backgroundColor: "#faf6ee", color: "#1a1209" }}
                    onFocus={e => (e.target.style.borderColor = GOLD)}
                    onBlur={e => (e.target.style.borderColor = "#e8d9c0")}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium mb-[5px]" style={{ color: "#1a1209" }}>
                  Phone No. <span style={{ color: "red" }}>*</span>
                </label>
                <div className="flex rounded-xl overflow-hidden"
                  style={{ border: "1.5px solid #e8d9c0", backgroundColor: "#fff" }}>
                  <span className="flex items-center px-3.5 text-sm font-semibold border-r shrink-0"
                    style={{ borderColor: "#e8d9c0", color: "#836737", backgroundColor: "#faf6ee" }}>
                    +91
                  </span>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="Enter Phone Number" required
                    className="flex-1 px-3 py-[9px] text-sm outline-none bg-transparent"
                    style={{ color: "#1a1209" }}
                  />
                </div>
              </div>

              {/* Remember me + Forgot */}
              <div className="flex items-center justify-between pt-[2px]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    className="h-[15px] w-[15px] rounded" style={{ accentColor: GOLD }} />
                  <span className="text-sm" style={{ color: "#836737" }}>Remember me</span>
                </label>
                <button type="button" className="text-sm font-medium hover:underline" style={{ color: GOLD }}>
                  Forgot Password?
                </button>
              </div>

              {/* Sign in button */}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-[11px] text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90 mt-2"
                style={{ backgroundColor: GOLD, boxShadow: "0 4px 16px rgba(201,146,26,0.35)" }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </button>

              {/* Temp OTP hint */}
              <p className="text-center text-xs" style={{ color: "#a08858" }}>
                OTP: <span className="font-bold" style={{ color: GOLD }}>123456</span> (temporary)
              </p>

              {/* Divider */}
              <Divider />

              {/* Google */}
              <GoogleBtn />
            </form>
          )}

          {/* ══════════════════════════════════
              CREATE ACCOUNT
              Name · Email · Mobile · Role radio · Button
          ══════════════════════════════════ */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-[10px]">

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium mb-[5px]" style={{ color: "#1a1209" }}>Full name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Rohan Mehta"
                  className="w-full rounded-xl px-4 py-[9px] text-sm outline-none transition-all"
                  style={{ border: "1.5px solid #e8d9c0", backgroundColor: "#faf6ee", color: "#1a1209" }}
                  onFocus={e => (e.target.style.borderColor = GOLD)}
                  onBlur={e => (e.target.style.borderColor = "#e8d9c0")}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-[5px]" style={{ color: "#1a1209" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-[14px] top-1/2 -translate-y-1/2 h-[15px] w-[15px]" style={{ color: "#c8b08a" }} />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@nivaas.com" required
                    className="w-full rounded-xl pl-10 pr-4 py-[9px] text-sm outline-none transition-all"
                    style={{ border: "1.5px solid #e8d9c0", backgroundColor: "#faf6ee", color: "#1a1209" }}
                    onFocus={e => (e.target.style.borderColor = GOLD)}
                    onBlur={e => (e.target.style.borderColor = "#e8d9c0")}
                  />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-sm font-medium mb-[5px]" style={{ color: "#1a1209" }}>Mobile No.</label>
                <div className="flex rounded-xl overflow-hidden"
                  style={{ border: "1.5px solid #e8d9c0", backgroundColor: "#fff" }}>
                  <span className="flex items-center px-3.5 text-sm font-semibold border-r shrink-0"
                    style={{ borderColor: "#e8d9c0", color: "#836737", backgroundColor: "#faf6ee" }}>
                    +91
                  </span>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="Enter Mobile Number" required
                    className="flex-1 px-3 py-[9px] text-sm outline-none bg-transparent"
                    style={{ color: "#1a1209" }}
                  />
                </div>
              </div>

              {/* ── Create account as — simple radio buttons, no icon ── */}
              <div>
                <label className="block text-sm font-medium mb-[7px]" style={{ color: "#1a1209" }}>
                  Create account as
                </label>
                <div className="flex gap-3">
                  {([
                    { value: "customer", label: "Customer" },
                    { value: "owner",    label: "Owner"    },
                  ] as const).map(r => (
                    <label key={r.value}
                      className="flex items-center gap-2.5 flex-1 rounded-xl px-4 py-3 cursor-pointer select-none transition-all"
                      style={{
                        border:          `1.5px solid ${role === r.value ? GOLD : "#e8d9c0"}`,
                        backgroundColor: role === r.value ? "#fef3d4" : "#fff",
                      }}>
                      {/* Custom radio circle */}
                      <div className="flex-shrink-0 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition-all"
                        style={{ borderColor: role === r.value ? GOLD : "#d4b896" }}>
                        {role === r.value && (
                          <div className="h-[9px] w-[9px] rounded-full" style={{ backgroundColor: GOLD }} />
                        )}
                      </div>
                      <input type="radio" name="role" value={r.value}
                        checked={role === r.value} onChange={() => setRole(r.value)}
                        className="sr-only" />
                      <span className="text-sm font-semibold"
                        style={{ color: role === r.value ? GOLD : "#1a1209" }}>
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Create account button — immediately after radio */}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-[11px] text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
                style={{ backgroundColor: GOLD, boxShadow: "0 4px 16px rgba(201,146,26,0.35)" }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </button>

              {/* Temp OTP hint */}
              <p className="text-center text-xs" style={{ color: "#a08858" }}>
                OTP: <span className="font-bold" style={{ color: GOLD }}>123456</span> (temporary)
              </p>

              <Divider />
              <GoogleBtn />
            </form>
          )}

          </div>{/* end white card */}
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ backgroundColor: "#e8d9c0" }} />
      <span className="text-xs font-semibold" style={{ color: "#c8b08a", letterSpacing: "0.06em" }}>OR</span>
      <div className="flex-1 h-px" style={{ backgroundColor: "#e8d9c0" }} />
    </div>
  );
}

function GoogleBtn() {
  return (
    <button
      type="button"
      onClick={() => toast.info("Google sign-in — configure OAuth in production")}
      className="w-full flex items-center justify-center gap-3 rounded-xl py-[9px] text-sm font-medium transition hover:bg-[#f5ede0]"
      style={{ border: "1.5px solid #e8d9c0", backgroundColor: "#faf6ee", color: "#1a1209" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>
  );
}


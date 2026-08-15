import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.CLIENT_URL,       // production Vercel URL
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    // Also allow any *.vercel.app preview URLs
    if (/\.vercel\.app$/.test(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed — " + origin));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRouter          from "./routes/auth.js";
import propertiesRouter    from "./routes/properties.js";
import savedRouter         from "./routes/saved.js";
import inquiriesRouter     from "./routes/inquiries.js";
import messagesRouter      from "./routes/messages.js";
import agreementsRouter    from "./routes/agreements.js";
import rentalsRouter       from "./routes/rentals.js";
import analyticsRouter     from "./routes/analytics.js";
import uploadRouter        from "./routes/upload.js";
import mapsRouter          from "./routes/maps.js";
import complaintsRouter    from "./routes/complaints.js";
import visitsRouter        from "./routes/visits.js";
import notificationsRouter from "./routes/notifications.js";
import documentsRouter     from "./routes/documents.js";
import pricingRouter       from "./routes/pricing.js";
import verificationRouter  from "./routes/verification.js";
import adminRouter         from "./routes/admin.js";

app.use("/api/auth",          authRouter);
app.use("/api/properties",    propertiesRouter);
app.use("/api/saved",         savedRouter);
app.use("/api/inquiries",     inquiriesRouter);
app.use("/api/messages",      messagesRouter);
app.use("/api/agreements",    agreementsRouter);
app.use("/api/rentals",       rentalsRouter);
app.use("/api/analytics",     analyticsRouter);
app.use("/api/upload",        uploadRouter);
app.use("/api/maps",          mapsRouter);
app.use("/api/complaints",    complaintsRouter);
app.use("/api/visits",        visitsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/documents",     documentsRouter);
app.use("/api/pricing",       pricingRouter);
app.use("/api/verification",  verificationRouter);
app.use("/api/admin",         adminRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), db: "supabase/postgresql" });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Nivaas API running at http://localhost:${PORT}`);
});

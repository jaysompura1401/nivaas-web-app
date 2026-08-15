import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:8080", "http://localhost:5173", "http://localhost:4173"],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images as static files → http://localhost:4000/uploads/filename.jpg
app.use("/uploads", express.static(uploadsDir));

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
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Nivaas API running at http://localhost:${PORT}`);
});

import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

// ─── PostgreSQL connection pool ───────────────────────────────────────────────
// Reads DATABASE_URL from .env (Supabase connection string — use the
// "Transaction" or "Session" pooler URL from Supabase → Settings → Database)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ─── Thin compatibility shim ─────────────────────────────────────────────────
// mysql2 returns [rows, fields] from pool.query(sql, params).
// The pg driver returns { rows, fields }. This wrapper keeps every route file
// working without changes — all existing code does:
//   const [rows] = await pool.query(...)
//   const [[row]] = await pool.query(...)
//
// Positional params:  mysql2 uses ?  →  pg uses $1, $2, …
// This shim converts ? → $n automatically so route files stay unchanged.

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const pgPool = {
  query: async (sql, params = []) => {
    const converted = convertPlaceholders(sql);
    try {
      const result = await pool.query(converted, params);
      // Return [rows, fields] tuple to match mysql2 API
      return [result.rows, result.fields];
    } catch (err) {
      console.error("DB query error:", err.message);
      console.error("SQL:", converted);
      throw err;
    }
  },
  // Expose raw pg pool for transactions if needed in future
  _pool: pool,
};

// Test connection on startup
pool.connect()
  .then((client) => {
    console.log("✅ PostgreSQL connected to Supabase");
    client.release();
  })
  .catch((err) => {
    console.error("❌ PostgreSQL connection failed:", err.message);
    console.error("   Check DATABASE_URL in server/.env");
  });

export default pgPool;

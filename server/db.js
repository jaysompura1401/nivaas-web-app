import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "nivaas",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
});

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    console.log("✅ MySQL connected to:", process.env.DB_NAME || "nivaas_db");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ MySQL connection failed:", err.message);
    console.error("   Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in server/.env");
  });

export default pool;

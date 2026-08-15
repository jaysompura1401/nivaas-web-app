# Nivaas — Setup Guide (MySQL Backend)

## Prerequisites
- Node.js 18+
- MySQL 8.0+

---

## 1. MySQL Database Setup

Open MySQL and run the schema file:

```sql
mysql -u root -p < talelight.sql
```

This creates the `nivaas_db` database with all tables:
- `nivaas_users`
- `nivaas_properties`
- `nivaas_property_images`
- `nivaas_amenities`
- `nivaas_property_amenities`
- `nivaas_saved_properties`
- `nivaas_inquiries`
- `nivaas_messages`
- `nivaas_agreements`
- `nivaas_rent_payments`
- `nivaas_reviews`

---

## 2. Configure Backend

Edit `server/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password    ← change this
DB_NAME=nivaas_db
JWT_SECRET=change_this_to_a_long_random_string
PORT=4000
CLIENT_URL=http://localhost:5173
```

---

## 3. Install Backend Dependencies

```bash
cd server
npm install
```

---

## 4. Start the Backend API

```bash
cd server
npm run dev
```

API runs at: **http://localhost:4000/api**

Test it: http://localhost:4000/api/health

---

## 5. Configure Frontend

The root `.env` already has:
```env
VITE_API_URL=http://localhost:4000/api
```

---

## 6. Install Frontend Dependencies

```bash
npm install
```

---

## 7. Start the Frontend

```bash
npm run dev
```

App runs at: **http://localhost:5173**

---

## How it works

| Action | Flow |
|--------|------|
| Register | POST /api/auth/register → JWT token stored in localStorage |
| Login | POST /api/auth/login → JWT token |
| OTP | Printed to **server console** (wire up email in production) |
| Browse | GET /api/properties?city=Ahmedabad&listing_type=rent |
| Post property | POST /api/properties (requires JWT) |
| Save property | POST /api/saved/:id (requires JWT) |
| Send inquiry | POST /api/inquiries (requires JWT) |
| Dashboard | All /api/* endpoints require `Authorization: Bearer <token>` |

---

## Production Notes

1. Set `JWT_SECRET` to a 64-char random string
2. Configure `SMTP_*` in `server/.env` for real OTP emails
3. Set `CLIENT_URL` to your production domain
4. Use `pm2` or similar to run the Node server
5. Put Nginx in front as a reverse proxy

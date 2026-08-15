# Nivaas

Rent, buy, and manage homes across Gujarat — built with React, TanStack Router, Supabase, and Tailwind CSS.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TanStack Router (file-based, SSR-ready) |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Backend | Supabase (Postgres + Auth + Storage) |
| State | React context (auth) + TanStack Query (server data) |
| Build | Vite + Bun |

---

## Project structure

```
src/
├── assets/                  Static images (hero, property photos)
├── components/
│   ├── dashboard/
│   │   └── DashboardShell   Sidebar layout used by all /dashboard/* routes
│   ├── site/
│   │   ├── Navbar           Public site navigation
│   │   ├── Footer           Site footer
│   │   └── PropertyCard     Card used on the public listing browse page
│   └── ui/                  shadcn/ui primitives (button, card, dialog, …)
├── integrations/supabase/
│   ├── client.ts            Supabase client singleton (lazy, proxy-wrapped)
│   └── types.ts             Generated database types
├── lib/
│   ├── auth-cache.ts        localStorage profile cache (30-min TTL)
│   ├── AuthContext.tsx      React context + useAuth() hook
│   ├── mock-properties.ts   Static seed data + formatINR helper
│   └── utils.ts             cn() and other utilities
└── routes/
    ├── __root.tsx            Root shell — QueryClientProvider + AuthProvider
    ├── index.tsx             Landing page
    ├── auth.tsx              Sign-in / sign-up
    ├── verify-otp.tsx        OTP verification
    ├── properties.index.tsx  Public browse page
    ├── properties.$id.tsx    Property detail page
    └── _authenticated/       Protected routes (require sign-in)
        ├── route.tsx         Auth guard (redirects to /auth if unauthenticated)
        ├── dashboard.index.tsx          Overview
        ├── dashboard.properties.index.tsx  My listings (live Supabase)
        ├── dashboard.properties.new.tsx    Post property (4-step form)
        ├── dashboard.rentals.tsx
        ├── dashboard.agreements.tsx
        ├── dashboard.saved.tsx
        ├── dashboard.messages.tsx
        ├── dashboard.analytics.tsx
        └── dashboard.settings.tsx
```

---

## Database

The Supabase project exposes four tables.

### `profiles`

Linked 1-to-1 to `auth.users`. Created automatically on signup.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | matches `auth.users.id` |
| `full_name` | text | |
| `phone` | text | |
| `avatar_url` | text | |
| `city` | text | |
| `role` | text | `'customer'` \| `'owner'` \| `'admin'` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `properties`

Core listing table. Every row is owned by a `profiles` row.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK → profiles | |
| `title` | text | required |
| `description` | text | |
| `property_type` | text | Apartment, Villa, PG, Office Space, … |
| `listing_type` | text | `'rent'` \| `'sale'` \| `'pg'` |
| `price` | numeric | monthly rent or sale price (₹) |
| `deposit` | numeric | security deposit (₹) |
| `bedrooms` | int | |
| `bathrooms` | int | |
| `area_sqft` | numeric | |
| `furnished` | text | Fully Furnished / Semi-Furnished / Unfurnished |
| `amenities` | text[] | free-form array (WiFi, Gym, …) |
| `city` | text | required |
| `locality` | text | |
| `address` | text | |
| `images` | text[] | public URLs; first element used as cover |
| `status` | text | `'active'` \| `'inactive'` \| `'rented'` \| `'pending_review'` |
| `verified` | bool | set by admins |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `saved_properties`

Wishlists — customers save listings they like.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `property_id` | uuid FK → properties | |
| `created_at` | timestamptz | |

Unique constraint on `(user_id, property_id)`.

### `inquiries`

A customer contacts an owner about a property.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `property_id` | uuid FK → properties | |
| `user_id` | uuid FK → profiles | the enquiring customer |
| `owner_id` | uuid FK → profiles | denormalised for fast RLS checks |
| `message` | text | |
| `status` | text | `'pending'` \| `'responded'` \| `'scheduled'` \| `'closed'` |
| `visit_date` | timestamptz | optional scheduled visit |
| `created_at` | timestamptz | |

---

## Auth & caching

Authentication is handled by Supabase Auth (email + OTP).

### How the cache works

```
User signs in
     │
     ▼
supabase.auth.onAuthStateChange fires SIGNED_IN
     │
     ▼
fetchProfile() → queries public.profiles → writes to localStorage
     │
     ▼
AuthContext.profile is set  →  all components re-render
```

On the next page load `getProfile()` checks localStorage first (TTL = 30 min). If the cached entry is still fresh the app skips the network call entirely. If stale or missing it falls back to `fetchProfile()`.

Signing out calls `supabase.auth.signOut()` **and** removes the localStorage entry so no stale data lingers.

### useAuth hook

```tsx
import { useAuth } from "@/lib/AuthContext";

function Navbar() {
  const { profile, loading, signOut } = useAuth();

  if (loading) return <Spinner />;
  if (!profile) return <Link to="/auth">Sign in</Link>;

  return (
    <span>
      Hello, {profile.full_name ?? "there"} ({profile.role})
    </span>
  );
}
```

---

## Owner dashboard features

### Post property — `/dashboard/properties/new`

4-step wizard:

1. **Basic info** — title, property type, listing type, description
2. **Configuration** — bedrooms, bathrooms, area, furnished status, amenity checkboxes (20 options)
3. **Location** — city (dropdown), locality (required), full address
4. **Pricing** — rent/sale price, security deposit, live summary card

Each step validates required fields before advancing. On submit the row is inserted into `public.properties` with `status = 'active'`.

### My listings — `/dashboard/properties`

Live table of the owner's properties fetched from Supabase, ordered newest-first. Features:

- Thumbnail from `images[0]` (placeholder icon if none)
- Status badge: Active (green) / Inactive (grey) / Rented (blue) / Pending review (amber)
- Verified badge when `verified = true`
- Per-row action menu: **View listing** · **Activate / Deactivate** · **Delete** (with confirmation dialog)
- Refresh button
- Empty state with CTA to post the first listing

---

## Getting started

### 1. Install dependencies

```bash
bun install
```

### 2. Set environment variables

Create a `.env` file at the project root (a template is committed as `.env`):

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

### 3. Run the database schema

Open the Supabase SQL editor and run `nivaas.sql` (in the project root). It creates all tables, enums, RLS policies, indexes, triggers, and seed data.

### 4. Start the dev server

```bash
bun run dev
```

The app starts at `http://localhost:3000`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon/publishable key |

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run preview` | Preview production build locally |

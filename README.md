# POS System

A point-of-sale system for a retail store, built with Next.js (App Router) and Supabase. Priced in Naira (₦).

## Features

- **Sell** — search or camera-scan products, build a cart, split payment across cash/card/transfer, optionally attach a customer. Works offline (queues the sale and syncs automatically once back online). In-progress carts survive a refresh, and a cashier can hold one customer's cart to attend to another (Held Sales).
- **Shift management** — cashiers open/close their shift with cash reconciliation (expected vs counted); closing pushes a summary to admin devices.
- **Products** — catalog with multiple sellable units per product (e.g. piece/carton), photos, low-stock thresholds, categories. Supports bulk creation via CSV import.
- **Stock History** — every stock movement, receiving new deliveries from a supplier, and stock takes/counts.
- **Suppliers** — vendor list, linked to stock receipts.
- **Sales History** — every completed sale, with the ability to void one (returns stock, requires a reason).
- **Reports** — revenue/profit trends, top products, low-stock list, payment-method breakdown, per-cashier breakdown, inventory valuation at cost.
- **Users** — staff accounts with `admin` / `cashier` roles enforced by Supabase Row Level Security, not just UI hiding.
- **Settings** — store name, logo, address, receipt footer/return policy.
- **In-app help** — a guided first-run tour of the sidebar, and a help widget that answers questions from a built-in FAQ (zero cost, zero setup) or, optionally, a real AI (Gemini free tier).
- **Push notifications** — low-stock alerts and shift-close summaries pushed to admin devices via Web Push (no third-party account, just a locally-generated keypair).
- **PWA** — installable on a phone/tablet home screen.
- Full dark mode (follows system preference).

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
- [Supabase](https://supabase.com) (Postgres, Auth, Storage, Row Level Security)
- Tailwind CSS 4
- TypeScript

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in the values (see below).

3. Run the dev server:

   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → Project Settings → API. **Server-only — never expose to the browser.** Used for admin actions (creating users, resetting passwords, sending push notifications). |
| `GEMINI_API_KEY` | No | Free, no card, at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it, the help widget still works using a built-in local FAQ. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | Not a third-party account — generate your own keypair locally: `node -e "console.log(require('web-push').generateVAPIDKeys())"`. Without these, push notifications are silently skipped. |

### Database

The schema (tables, RLS policies, RPCs like `process_sale`, `open_shift`, `close_shift`, `void_sale`) lives in the Supabase project itself, not in this repo. If you're setting up a new project from scratch, you'll need to recreate that schema — there's currently no committed migration history (`supabase/migrations` doesn't exist yet). Treat the live Supabase project as the source of truth for schema, and consider exporting migrations (`supabase db diff`) if you need to reproduce it elsewhere.

## Deployment

Deployed as a standard Next.js app (e.g. Vercel). Make sure every environment variable above is set in your hosting provider's dashboard — they are **not** read from `.env.local` in production.

## Project structure

```
app/dashboard/       Authenticated app screens (role-gated via app/dashboard/layout.tsx)
app/api/              Server routes (admin actions, push notifications, AI assistant)
components/           Shared UI components
lib/                  Supabase clients, auth helpers, client-side persistence (offline queue, held sales, help-assistant knowledge base)
public/sw.js          Service worker (PWA + push notifications)
```

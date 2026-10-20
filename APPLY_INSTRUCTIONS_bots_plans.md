# Applying the Trading Bots + Plans update to dezzzinr/Nexatrade

This zip (`nexatrade-bots-plans.zip`) contains your full Nexatrade project tree with
the new **Trading Bots** and **Plans** production-mode features added on top of the
previously delivered Deposits / Withdrawals / Copy Trading work. I don't have push
access to your GitHub repo, so apply it manually:

## 1. Copy the files into your repo

Unzip this archive over your existing `dezzzinr/Nexatrade` checkout (or diff it
against your repo and merge by hand if you've made local changes since the last
delivered zip). The files that are new or changed in this update:

**New:**
- `src/app/admin/page.tsx` — Bots/Plans admin tabs (bundled together with the
  previously-delivered Copy Traders/Deposits/Withdrawals tabs — this file replaces
  the whole admin page)
- `src/app/api/admin/bots/route.ts`, `src/app/api/admin/bots/[id]/route.ts`
- `src/app/api/admin/plans/route.ts`, `src/app/api/admin/plans/[id]/route.ts`
- `src/app/api/bots/route.ts`
- `src/app/api/bot-subscriptions/route.ts`
- `src/app/api/bot-instances/route.ts`, `src/app/api/bot-instances/[id]/route.ts`
- `src/app/api/plans/route.ts`
- `src/app/api/plan-subscriptions/route.ts`
- `src/lib/bots.ts`, `src/lib/plans.ts`, `src/lib/subscriptions.ts`
- `scripts/seed.mjs` — seeds the 10 starter bots + 4 starter plans (idempotent)

**Changed:**
- `src/db/schema.ts` — added `botProducts`, `botSubscriptions`, `botInstances`,
  `plans`, `planSubscriptions` tables (removed the old placeholder `bots` /
  `subscriptions` tables)
- `src/app/page.tsx` — new Trading Bot and Plans pages wired to the live catalog/
  subscription APIs (replacing the old hardcoded bot/plan UI)
- `src/app/api/app/route.ts` — `plan` is now `string | null` (no default "Starter"
  fallback) plus a new `planExpiresAt` field
- `src/app/globals.css` — a few small new CSS rules for the bot configure form
- `package.json` — adds the `"seed": "node scripts/seed.mjs"` script
- `.env.example`, `src/app/api/auth/route.ts`, `src/lib/auth.ts` — unrelated to
  this feature; these only changed in a prior delivered zip (Copy Trading) and are
  included here unchanged so this zip is a complete, consistent snapshot.

## 2. Apply the schema change

```bash
npm install
npx drizzle-kit push
```

`drizzle-kit push` reads `DATABASE_URL` from your `.env`. Review the prompts
carefully — pushing against a database that already has the old `bots` /
`subscriptions` tables with data in them will ask to drop/recreate; back up first
if you have real user data you care about.

## 3. Seed the starter catalog

```bash
npm run seed
```

This inserts 10 trading bots and 4 plans (see README for the exact list) **only if
they don't already exist** — it's safe to re-run any time, including in CI/CD after
every deploy, without duplicating rows or overwriting admin edits.

## 4. Set `ADMIN_EMAILS` if you haven't already

Trading Bots/Plans admin management lives under the same `/admin` panel as
Deposits/Withdrawals/Copy Traders — any account whose email is listed in
`ADMIN_EMAILS` (comma-separated, in `.env` / your hosting provider's environment
variables) automatically gets admin access on login/registration.

## 5. Verify

```bash
npm run build
```

should finish with "Compiled successfully" and list `/api/admin/bots`,
`/api/admin/plans`, `/api/bots`, `/api/bot-subscriptions`, `/api/bot-instances`,
`/api/plans`, `/api/plan-subscriptions` among the generated routes.

Then start the app, log in as an admin, and check **Admin panel → Trading bots**
and **Admin panel → Plans** — you should see the 10 seeded bots and 4 seeded plans
ready to edit, deactivate, or add to. As a regular user, check the **Trading Bot**
and **Plans** pages in the main app sidebar.

## What's new, functionally

**Trading Bots**
- Admins add bots and set strategy/risk/minimum allocation/price from
  **Admin panel → Trading bots**, exactly like Copy Traders.
- Users subscribe to a bot for a **7-day, non-renewing** paid subscription (same
  pattern as copy trading).
- Once subscribed, a user can configure **any number of separate bot instances**
  for that bot (e.g. one on BTC, another on ETH), each with its own allocation
  amount and optional name, pause/resume and delete independently.
- If the subscription lapses, existing instances are flagged "Needs resubscribe"
  (not deleted) until the user subscribes again.

**Plans**
- Admins add plans, weekly price, and a feature list (one feature per line) from
  **Admin panel → Plans**, plus a "featured" flag and sort order.
- Users subscribe **weekly** (7-day, non-renewing) to a plan from the **Plans**
  page; switching plans is allowed any time; re-choosing an already-active plan is
  blocked until it lapses.
- "Current plan" (shown in the topbar and on the Plans page) is computed live from
  the most recent active subscription — there is no hardcoded default tier anymore.

Both features reuse the admin-catalog / 7-day-subscription / delete-blocked-by-
history pattern already established for Copy Trading, so the admin workflow should
feel identical across all three tabs.

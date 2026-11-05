# Multi-asset paper trading + CoinGecko universe

This branch expands the crypto-only simulator into a **seven-class paper-trading workspace** with a dynamic, full-catalog **CoinGecko crypto universe**. It does not add a broker, custody, or real-money execution.

## What is included

| Class | Starter instruments | Access |
|---|---|---|
| Crypto | **All CoinGecko-listed coins** (22,643 at verification), including the legacy BTC/ETH/SOL/BNB/AVAX/LINK/ADA/DOGE tickers | Dynamic catalog, icons, charts, metadata, trending/categories/exchanges/global stats. Paper spot trading for any listed coin with a fresh quote. Legacy eight keep margin; long-tail listings are spot-only. |
| Stocks | AAPL, MSFT, NVDA, AMZN, GOOGL, TSLA | Cash-style paper orders; whole shares |
| ETFs | SPY, QQQ, TLT, AGG | Cash-style paper orders; whole shares |
| Forex | EUR/USD, GBP/USD, AUD/USD, NZD/USD | Base-currency units; minimum 1,000 units |
| Commodities | XAU/USD, XAG/USD, WTI/USD, XBR/USD | Indicative spot simulation; no futures or delivery |
| Indices | S&P 500, Nasdaq Composite, Dow Jones Industrial Average | Charts, watchlists, alerts; **reference only** |
| Bonds | US 2Y, 10Y, 20Y, 30Y government-bond yields | Charts, watchlists, alerts; **reference only** |

The traditional starter catalog remains 33 instruments (26 tradable, 7 reference benchmarks). Crypto is no longer limited to that starter list: the CoinGecko universe is loaded/searched dynamically and persisted in `crypto_assets`. Bond exposure is available through bond ETFs such as TLT and AGG. Index exposure is available through equity-index ETFs. QQQ tracks the Nasdaq-100, which is **not** the Nasdaq Composite benchmark shown in the index tab.

The Markets page has two views: **Multi-asset markets** (class filters, search, sorting, watchlist/gainer/loser views, feed labels, related-ETF discovery) and **CoinGecko universe** (full coin search/pagination, icons, sparklines, market cap/volume, trending, categories, exchanges, global stats, and coin detail modals with contracts/links/tickers). The Trade page has a full CoinGecko coin search box. Portfolio allocation groups holdings by asset class. Instrument detail pages explain units, access, data latency, and market-session eligibility.

## Architecture

- `src/lib/instruments.ts`: versioned, provider-independent instrument identities and trading policies.
- `src/lib/market.ts`: shared client/server market types and legacy crypto compatibility exports.
- `src/lib/market-rules.ts`: pure quantity, identity, freshness, session, and execution-eligibility rules.
- `src/lib/providers/`: CoinGecko, Twelve Data, EODHD, and explicit synthetic-demo adapters.
- `src/lib/crypto-instruments.ts`: collision-proof dynamic CoinGecko identities (`cg:<coin-id>` / `crypto:cg:<coin-id>`) while preserving legacy crypto tickers.
- `src/lib/crypto-catalog.ts`: server-only CoinGecko catalog sync, search, market hydration, coin detail, discovery, and dynamic instrument resolution.
- `src/app/api/crypto/`: catalog, coin detail, discovery, and admin catalog-sync routes.
- `src/components/crypto-universe.tsx` / `crypto-asset-search.tsx`: full-universe UI and Trade-page coin search.
- `migrations/20261030_crypto_universe.sql`: additive `crypto_assets` and `market_cache` tables.
- `src/lib/market-server.ts`: provider orchestration, per-instrument fallback, execution price map, and separate benchmark-alert price map.
- `src/lib/trading-instruments.ts`: server-side tradable-instrument and budget-to-quantity validation.
- `src/lib/trading-engine.ts`: existing ledger engine, now with stable instrument IDs and central instrument/reservation checks.
- `migrations/20261030_multi_asset_instrument_ids.sql`: additive identity migration.

New financial rows store both the compatibility ticker and `instrument_id`. Existing crypto rows keep their original tickers, balances, quantities, and cost bases. The migration backfills IDs such as `crypto:BTC`; it never changes financial values.

## Data modes

### Local preview / tests

```env
MARKET_DATA_MODE=demo
```

Demo mode is explicit and never selected as a silent fallback. It uses deterministic synthetic fixtures, displays a persistent demo disclosure, and labels every quote/chart as synthetic. Demo prices are **not** current or historical market prices. Demo mode still uses the real paper-order routes and database ledger.

### Provider mode (recommended)

```env
MARKET_DATA_MODE=provider
COINGECKO_API_KEY=...                 # CoinGecko Demo key
# Optional explicit preview hybrid: live CoinGecko crypto + synthetic non-crypto
# NON_CRYPTO_DATA_MODE=demo
TWELVEDATA_API_KEY=...
TWELVEDATA_FEED_LATENCY=delayed
EODHD_API_TOKEN=...
ALLOW_DELAYED_PAPER_FILLS=true
MAX_QUOTE_AGE_SECONDS=900
```

- **CoinGecko Demo** is the comprehensive crypto source: `/coins/list` for the full catalog, `/coins/markets` for quotes/icons/ranks/sparklines, `/coins/{id}` for metadata/contracts/tickers, `/search/trending`, `/coins/categories`, `/exchanges`, and `/global`. The client queues requests below the Demo rate limit, caches catalog/discovery/detail data, and hydrates market data lazily. Demo documented limits are around 100 calls/min and 10,000 calls/month; keyless public access is much lower and not suitable for production.
- **Recommended non-CoinGecko providers:** Twelve Data for stocks/ETFs/forex/spot commodities/index benchmarks; EODHD for government-bond yield benchmarks. CoinGecko does not provide these asset classes.
- Twelve Data serves the starter stocks, ETFs, USD-quoted FX pairs, spot commodities, and explicitly typed index benchmarks.
- EODHD serves daily government-bond **yield** series from its `GBOND` virtual exchange.
- Keys are server-only. Never use a `NEXT_PUBLIC_` prefix. EODHD requires a query token; its request URL must not be logged or exposed to the browser.
- Confirm your subscription's instrument coverage, exchange entitlements, rate limits, and redistribution/display rights before deployment. The adapters were contract-tested with fixtures; live entitlement verification requires your credentials.
- `TWELVEDATA_FEED_LATENCY` defaults to `unknown`. Set it to `real_time` or `delayed` only after checking your entitlement. Unknown latency blocks new fills.
- Known delayed feeds can be used for paper fills when `ALLOW_DELAYED_PAPER_FILLS=true` (the default). Set it to `false` to require real-time data. This setting never makes an unknown-latency feed executable.
- Missing credentials produce unavailable instruments, not fabricated prices. One provider's outage does not disable other fresh feeds.

Provider references:
- https://twelvedata.com/docs
- https://support.twelvedata.com/en/articles/5620513-how-to-find-all-available-symbols-at-twelve-data
- https://eodhd.com/financial-apis/macroeconomic-data-api

## Execution safeguards

1. Only catalog instruments marked tradable can enter spot routes. Indices and bond yields are rejected server-side.
2. Quantities use instrument-specific minimums and steps. Stocks/ETFs use whole shares in this starter policy; FX uses base units, not standardized lots.
3. Every executable starter instrument is USD-quoted. The ledger remains USD. A non-USD quote is rejected rather than silently treated as dollars.
4. Non-crypto fills require the provider to report an open market. Missing session status fails closed; the app does not guess exchange holidays.
5. Quote age uses the provider's observation timestamp, not the time the HTTP response was cached.
6. Closed/stale/unavailable quotes cannot trigger new fills. Existing positions are not repriced to an invented fallback when a quote disappears.
7. New stock/ETF/FX/commodity markets do not inherit crypto leverage or timed short positions. Existing crypto margin behavior remains available.
8. Benchmark alerts use a separate price map, so a yield can notify without becoming an executable order.
9. Pending-order cash/quantity reservations are enforced in the shared fill path. Margin opening also respects cash reserved by open buy orders.

The engine remains opportunistic, not a tick-by-tick exchange simulator. Fills are indicative paper fills with no fees/slippage; stop triggers do not guarantee a real-world execution price.

## Database migration and deployment

Back up the target database and verify `DATABASE_URL` first.

```bash
npm ci
npm run db:migrate:multiasset
npm run db:migrate:crypto
npm run typecheck
npm test
npm run build
```

The SQL migrations are additive and idempotent. The first adds nullable `instrument_id` columns to holdings, trades, orders, positions, watchlist items, and price alerts, then backfills known legacy crypto tickers. Apply it before deploying the new code. For a fresh database, the existing `npx drizzle-kit push` setup can create the schema; run the identity migration afterward if you have legacy rows to backfill. The second creates `crypto_assets` and `market_cache` for the dynamic CoinGecko universe. Do not blindly push schema changes to production.

Set provider environment variables in the deployment environment and redeploy. `MARKET_DATA_MODE=demo` is suitable for an explicitly labeled preview, not a live-data production release. No Vercel or GitHub deployment was performed by this change.

## Verification

```bash
npm test
# Requires the local app and a local database whose name starts with test/preview:
npm run test:integration
# Provider-mode CoinGecko universe checks (local preview DB + loopback app):
npm run test:integration:crypto
```

The integration scripts refuse non-loopback hosts and non-test/preview databases. It creates and cleans up its own temporary user. It checks multi-class fills, stable IDs, rejection rules, alerts, watchlists, pending orders, portfolio history, ledger reconciliation, and legacy migration.

Optional browser checks use Playwright (`npx playwright install chromium`). The app also supports `ALLOWED_DEV_ORIGINS` as a comma-separated list for development-only cross-origin allowances.

## Deliberate limitations / next phases

- No real broker execution, custody, KYC/AML, or regulatory onboarding.
- CoinGecko long-tail listings may have stale/missing prices, no market cap rank, or no executable quote; the UI shows availability and the server blocks fills without a fresh quote. NFTs/derivatives are not paper-tradable instruments here.
- The committed `.env.example` no longer contains a CoinGecko key. If a real key was previously committed, rotate it and keep the replacement only in `.env.local`/deployment secrets.
- No individual bond ownership: face value, coupon accrual, accrued interest, maturity settlement, and bond-specific taxation are not modeled.
- No index futures/options or CFD contracts.
- No commodity futures expiry, roll, storage, or physical delivery.
- No FX rollover/swap financing or non-USD settlement ledger.
- No dividend/coupon cash events or corporate-action adjustments. ETF performance here is price-only, not total return.
- No portfolio-level margin/netting or real exchange order book.
- The starter catalog is curated, not a full security master. Add instruments through the catalog and verify provider identity/entitlement before enabling them.
- Existing admin funding, manual deposit/withdrawal review, subscriptions, and notification features are preserved; this change does not turn them into a payment or brokerage service.

## Local verification on this branch

- `npm run typecheck`: passed.
- `npm test`: 42 unit tests passed.
- `npm run test:integration` (explicit demo mode): 25 local database/API checks passed.
- `npm run test:integration:crypto` (provider mode): 11 CoinGecko universe checks passed, including a dynamic long-tail coin buy/sell, stable identity, watchlist/alert, chart, and margin rejection.
- `npm run test:ui`: desktop/mobile, catalog, benchmark ticket, ETF margin guard, and browser-error checks passed.
- Manual Playwright CoinGecko universe check: 50 coin rows with icons, coin detail modal, trade handoff, mobile layout, no page/console errors.
- `npm run build`: production build passed.
- `npm ci --dry-run`: lockfile is installable.
- CoinGecko catalog sync observed **22,643 listed coins**; discovery returned trending coins, 100 categories, 50 exchanges, and global stats.
- `npm run lint`: still fails on pre-existing React hook/purity/entity/link issues (38 errors / 22 warnings). New CoinGecko universe modules are lint-clean.

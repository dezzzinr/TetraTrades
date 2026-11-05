-- Additive dynamic CoinGecko catalog/cache. Safe to run more than once.
CREATE TABLE IF NOT EXISTS crypto_assets (
  id text PRIMARY KEY,
  symbol text NOT NULL,
  name text NOT NULL,
  image text,
  market_cap_rank integer,
  platforms jsonb,
  active boolean NOT NULL DEFAULT true,
  listed_synced_at timestamptz,
  market_updated_at timestamptz,
  market_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crypto_assets_symbol_idx ON crypto_assets(symbol);
CREATE INDEX IF NOT EXISTS crypto_assets_name_idx ON crypto_assets(name);
CREATE INDEX IF NOT EXISTS crypto_assets_rank_idx ON crypto_assets(market_cap_rank);
CREATE TABLE IF NOT EXISTS market_cache (
  key text PRIMARY KEY,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

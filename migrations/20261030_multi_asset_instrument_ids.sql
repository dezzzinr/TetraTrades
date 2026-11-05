-- Additive, idempotent migration. Existing balances, prices and quantities are
-- unchanged. Run once before deploying the multi-asset application.
BEGIN;
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS instrument_id text;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS instrument_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS instrument_id text;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS instrument_id text;
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS instrument_id text;
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS instrument_id text;

UPDATE holdings SET instrument_id = 'crypto:' || symbol
 WHERE instrument_id IS NULL AND symbol IN ('BTC','ETH','SOL','BNB','AVAX','LINK','ADA','DOGE');
UPDATE trades SET instrument_id = 'crypto:' || symbol
 WHERE instrument_id IS NULL AND symbol IN ('BTC','ETH','SOL','BNB','AVAX','LINK','ADA','DOGE');
UPDATE orders SET instrument_id = 'crypto:' || symbol
 WHERE instrument_id IS NULL AND symbol IN ('BTC','ETH','SOL','BNB','AVAX','LINK','ADA','DOGE');
UPDATE positions SET instrument_id = 'crypto:' || symbol
 WHERE instrument_id IS NULL AND symbol IN ('BTC','ETH','SOL','BNB','AVAX','LINK','ADA','DOGE');
UPDATE watchlist_items SET instrument_id = 'crypto:' || symbol
 WHERE instrument_id IS NULL AND symbol IN ('BTC','ETH','SOL','BNB','AVAX','LINK','ADA','DOGE');
UPDATE price_alerts SET instrument_id = 'crypto:' || symbol
 WHERE instrument_id IS NULL AND symbol IN ('BTC','ETH','SOL','BNB','AVAX','LINK','ADA','DOGE');
COMMIT;

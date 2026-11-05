import test from "node:test";
import assert from "node:assert/strict";
import { getInstrument } from "../src/lib/instruments";
import { mapQuote, mapCandles } from "../src/lib/providers/twelvedata";
import { mapYieldHistory } from "../src/lib/providers/eodhd";
import { demoPrice, demoProvider } from "../src/lib/providers/demo";
import { formatAssetValue, formatAssetChange } from "../src/lib/market-display";
import { readFile } from "node:fs/promises";

const now = Date.parse("2026-10-30T15:00:00Z");
const stock = getInstrument("AAPL")!;
const raw = { symbol: "AAPL", close: "220.12", currency: "USD", timestamp: now / 1000 - 10, is_market_open: true, percent_change: "1.2", volume: "1234" };
test("Twelve Data numeric strings normalize without fabricating values", () => {
  const quote = mapQuote(raw, stock, now)!;
  assert.equal(quote.price, 220.12);
  assert.equal(quote.volume, 1234);
  assert.equal(quote.marketCap, null);
  assert.equal(quote.marketOpen, true);
});
test("wrong-currency equity responses are rejected", () => assert.equal(mapQuote({ ...raw, currency: "EUR" }, stock, now), null));
test("an index request cannot silently accept a same-ticker stock", () => {
  assert.equal(mapQuote({ ...raw, symbol: "SPX", type: "Common Stock" }, getInstrument("SPX")!, now), null);
  assert.ok(mapQuote({ ...raw, symbol: "SPX", type: "Index" }, getInstrument("SPX")!, now));
});
test("provider errors and invalid prices are unavailable", () => {
  assert.equal(mapQuote({ status: "error", message: "not entitled" }, stock, now), null);
  assert.equal(mapQuote({ ...raw, close: "0" }, stock, now), null);
  assert.equal(mapQuote({ ...raw, close: "NaN" }, stock, now), null);
});
test("closed markets retain a quote but are marked closed", () => assert.equal(mapQuote({ ...raw, is_market_open: false }, stock, now)?.status, "closed"));
test("historical intraday timestamps are UTC when requested as UTC", () => {
  const candles = mapCandles({ status: "ok", meta: { currency: "USD", type: "Common Stock" }, values: [
    { datetime: "2026-10-30 14:55:00", open: "219", high: "221", low: "218", close: "220", volume: "10" },
    { datetime: "2026-10-30 14:50:00", open: "218", high: "220", low: "217", close: "219", volume: "20" },
  ] }, stock);
  assert.equal(candles[0].timestamp, Date.parse("2026-10-30T14:50:00Z"));
  assert.equal(candles[1].close, 220);
});
test("history rejects an index/stock identity mismatch", () => assert.throws(() => mapCandles({ status: "ok", meta: { type: "Common Stock" }, values: [] }, getInstrument("SPX")!), /index/));
test("bond yields are percentages, including valid zero and negative observations", () => {
  const candles = mapYieldHistory([{ date: "2026-10-29", close: 0 }, { date: "2026-10-30", close: -0.1 }], getInstrument("US10Y")!);
  assert.equal(candles.length, 2);
  assert.equal(candles[1].close, -0.1);
  assert.equal(candles[1].volume, 0);
});
test("demo fixtures are deterministic and explicitly labeled", async () => {
  const quotes = await demoProvider.getQuotes(instrumentsForDemo());
  assert.equal(quotes.length, 33);
  assert.ok(quotes.every(q => q.status === "demo" && q.latency === "demo" && q.source.includes("Synthetic")));
  assert.equal(demoPrice(stock, now), demoPrice(stock, now));
  assert.equal(demoProvider.id, "demo");
});
test("demo charts have valid OHLC and no fake yield volume", async () => {
  const candles = await demoProvider.getCandles(getInstrument("US10Y")!, "1Y");
  assert.equal(candles.length, 100);
  assert.ok(candles.every(c => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close) && c.volume === 0));
});
test("yields and index levels are never formatted as dollar prices", () => {
  assert.equal(formatAssetValue(getInstrument("US10Y")!, 4.25, "EUR", 0.9), "4.250%");
  assert.equal(formatAssetValue(getInstrument("SPX")!, 5500, "EUR", 0.9), "5,500.00");
  assert.equal(formatAssetChange(getInstrument("US10Y")!, 0.025), "+0.025 pp");
});
test("additive migration preserves financial columns", async () => {
  const sql = await readFile(new URL("../migrations/20261030_multi_asset_instrument_ids.sql", import.meta.url), "utf8");
  for (const table of ["holdings", "trades", "orders", "positions", "watchlist_items", "price_alerts"]) assert.ok(sql.includes(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS instrument_id`));
  assert.ok(!/UPDATE\s+\w+\s+SET\s+(quantity|price|cash_balance|total|margin)/i.test(sql));
});
function instrumentsForDemo() { return ["BTC","ETH","SOL","BNB","AVAX","LINK","ADA","DOGE","AAPL","MSFT","NVDA","AMZN","GOOGL","TSLA","SPY","QQQ","TLT","AGG","EURUSD","GBPUSD","AUDUSD","NZDUSD","XAUUSD","XAGUSD","WTIUSD","XBRUSD","SPX","IXIC","DJI","US2Y","US10Y","US20Y","US30Y"].map(s => getInstrument(s)!); }

import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_CLASSES, getInstrument, getInstrumentById, instruments, resolveInstrument } from "../src/lib/instruments";
import { executionGate, floorQuantity, validateQuantity, validateSpotRequest, type Quote } from "../src/lib/market-rules";
import { groupHoldingsByClass } from "../src/lib/portfolio";

const now = Date.parse("2026-10-30T15:00:00Z");
const policy = { allowDelayedPaperFills: true, maxQuoteAgeMs: 900000 };
const quote = (overrides: Partial<Quote> = {}): Quote => ({ instrumentId: "stock:XNAS:AAPL", price: 220, observedAt: new Date(now - 1000).toISOString(), status: "live", latency: "real_time", marketOpen: true, changePercent: 1, change7dPercent: null, high: 222, low: 218, volume: 1000, marketCap: null, sparkline: [], rank: null, image: null, source: "test", ...overrides });

test("catalog covers all seven requested asset classes", () => {
  assert.deepEqual(new Set(instruments.map(i => i.assetClass)), new Set(ASSET_CLASSES.map(c => c.id)));
  assert.equal(ASSET_CLASSES.length, 7);
});
test("instrument identities and compatibility tickers are unique", () => {
  assert.equal(new Set(instruments.map(i => i.id)).size, instruments.length);
  assert.equal(new Set(instruments.map(i => i.symbol)).size, instruments.length);
  assert.equal(new Set(instruments.map(i => i.displaySymbol)).size, instruments.length);
});
test("legacy crypto tickers retain their identities and margin eligibility", () => {
  for (const symbol of ["BTC", "ETH", "SOL", "BNB", "AVAX", "LINK", "ADA", "DOGE"]) {
    const instrument = getInstrument(symbol)!;
    assert.equal(instrument.id, `crypto:${symbol}`);
    assert.equal(instrument.marginEligible, true);
    assert.equal(resolveInstrument(symbol, null)?.id, instrument.id);
  }
});
test("new cash markets do not inherit crypto leverage", () => {
  for (const symbol of ["AAPL", "SPY", "TLT", "EURUSD", "XAUUSD"]) assert.equal(getInstrument(symbol)?.marginEligible, false);
});
test("indices and government yields are reference-only", () => {
  for (const instrument of instruments.filter(i => i.assetClass === "index" || i.assetClass === "bond")) {
    assert.equal(instrument.tradable, false);
    assert.match(validateSpotRequest(instrument, "buy", 1) ?? "", /benchmark|reference-only/);
  }
});
test("related ETFs exist and are tradable", () => {
  for (const instrument of instruments) for (const symbol of instrument.relatedSymbols) assert.ok(getInstrument(symbol));
  for (const instrument of instruments.filter(i => !i.tradable && i.relatedSymbols.length)) for (const symbol of instrument.relatedSymbols) assert.equal(getInstrument(symbol)?.tradable, true);
});
test("ambiguous index ticker is explicitly typed and exchange-scoped", () => {
  const index = getInstrument("SPX")!;
  assert.equal(index.providerType, "Index");
  assert.equal(index.country, "US");
  assert.notEqual(index.id, getInstrument("SPY")!.id);
});
test("display aliases resolve to canonical symbols", () => {
  assert.equal(getInstrument("EUR/USD")?.symbol, "EURUSD");
  assert.equal(getInstrument("XAU/USD")?.symbol, "XAUUSD");
});
test("all executable starter instruments are USD-quoted", () => {
  for (const instrument of instruments.filter(i => i.tradable)) assert.equal(instrument.quoteCurrency, "USD");
});
test("unknown stored identity does not fall back to a different ticker", () => {
  assert.equal(resolveInstrument("AAPL", "stock:NYSE:WRONG"), undefined);
});
test("stocks and ETFs reject fractional shares under the starter policy", () => {
  for (const symbol of ["AAPL", "SPY", "TLT"]) {
    assert.equal(validateQuantity(getInstrument(symbol)!, 2), null);
    assert.ok(validateQuantity(getInstrument(symbol)!, 0.5));
    assert.ok(validateQuantity(getInstrument(symbol)!, 0));
  }
});
test("FX sizes are base units with an explicit minimum", () => {
  const fx = getInstrument("EURUSD")!;
  assert.equal(validateQuantity(fx, 1000), null);
  assert.ok(validateQuantity(fx, 999));
  assert.ok(validateQuantity(fx, 1000.5));
});
test("commodity and crypto increments are enforced", () => {
  assert.equal(validateQuantity(getInstrument("XAUUSD")!, 0.001), null);
  assert.ok(validateQuantity(getInstrument("XAUUSD")!, 0.0001));
  assert.equal(validateQuantity(getInstrument("BTC")!, 0.00000001), null);
  assert.ok(validateQuantity(getInstrument("BTC")!, 0.000000001));
});
test("invalid numeric inputs never become orders", () => {
  for (const value of [NaN, Infinity, -1, 1e20]) assert.ok(validateQuantity(getInstrument("AAPL")!, value));
  assert.ok(validateSpotRequest(getInstrument("AAPL"), "hold", 1));
});
test("budget conversion floors to a valid step without oversizing", () => {
  assert.equal(floorQuantity(getInstrument("AAPL")!, 2.99), 2);
  assert.equal(floorQuantity(getInstrument("EURUSD")!, 1234.9), 1234);
  assert.equal(floorQuantity(getInstrument("XAUUSD")!, 0.1239), 0.123);
  assert.equal(floorQuantity(getInstrument("BTC")!, -1), 0);
});
test("fresh real-time open-market quote is executable", () => assert.equal(executionGate(getInstrument("AAPL")!, quote(), policy, now), null));
test("synthetic demo quotes are executable only as paper fixtures", () => assert.equal(executionGate(getInstrument("AAPL")!, quote({ status: "demo", latency: "demo" }), policy, now), null));
test("closed and unknown market sessions fail closed", () => {
  assert.match(executionGate(getInstrument("AAPL")!, quote({ marketOpen: false, status: "closed" }), policy, now)!, /closed/);
  assert.match(executionGate(getInstrument("AAPL")!, quote({ marketOpen: null }), policy, now)!, /unknown/);
});
test("stale and future quotes fail closed", () => {
  assert.match(executionGate(getInstrument("AAPL")!, quote({ observedAt: new Date(now - 901000).toISOString() }), policy, now)!, /stale/);
  assert.ok(executionGate(getInstrument("AAPL")!, quote({ observedAt: new Date(now + 120000).toISOString() }), policy, now));
});
test("known delayed data requires explicit paper-fill opt-in", () => {
  assert.equal(executionGate(getInstrument("AAPL")!, quote({ latency: "delayed" }), policy, now), null);
  assert.ok(executionGate(getInstrument("AAPL")!, quote({ latency: "delayed" }), { ...policy, allowDelayedPaperFills: false }, now));
});
test("unverified latency is never silently treated as real time", () => assert.match(executionGate(getInstrument("AAPL")!, quote({ latency: "unknown" }), policy, now)!, /unverified/));
test("one unavailable feed does not block another instrument", () => {
  assert.ok(executionGate(getInstrument("US10Y")!, undefined, policy, now));
  assert.equal(executionGate(getInstrument("BTC")!, quote({ instrumentId: "crypto:BTC", latency: "delayed" }), policy, now), null);
});
test("portfolio allocation aggregates by class, not ticker", () => {
  const result = groupHoldingsByClass([{ symbol: "AAPL", quantity: 2, price: 100 }, { symbol: "MSFT", quantity: 1, price: 100 }, { symbol: "TLT", quantity: 1, price: 100 }]);
  assert.equal(result.find(a => a.assetClass === "stock")?.percent, 75);
  assert.equal(result.find(a => a.assetClass === "etf")?.percent, 25);
  assert.equal(result.reduce((sum, a) => sum + a.value, 0), 400);
});
test("stored identity is available without a live provider", () => assert.equal(getInstrumentById("bond:US10Y")?.valueKind, "yield"));

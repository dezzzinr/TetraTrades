import test from "node:test";
import assert from "node:assert/strict";
import { cryptoInstrument, coinGeckoIdFromSymbol, coinGeckoIdFromInstrumentId, isDynamicCryptoSymbol } from "../src/lib/crypto-instruments";
import { getInstrument } from "../src/lib/instruments";
import { mapMarketRow, quoteFromMarket, safeImage, stripHtml } from "../src/lib/providers/coingecko-map";

const now = Date.parse("2026-10-30T12:00:00Z");
const row = { id: "example-coin", symbol: "exam", name: "Example Coin", current_price: 1.23, last_updated: "2026-10-30T11:59:00Z", price_change_percentage_24h: 2.5, price_change_percentage_7d_in_currency: -1.2, market_cap: 1000000, total_volume: 50000, high_24h: 1.3, low_24h: 1.1, market_cap_rank: 123, image: "https://coin-images.coingecko.com/coins/images/1/large/example.png", sparkline_in_7d: { price: [1, 1.1, 1.2] } };

test("dynamic CoinGecko symbols are collision-proof and preserve legacy crypto", () => {
  const dynamic = cryptoInstrument({ id: "example-coin", symbol: "exam", name: "Example Coin" });
  assert.equal(dynamic.symbol, "cg:example-coin");
  assert.equal(dynamic.id, "crypto:cg:example-coin");
  assert.equal(dynamic.displaySymbol, "EXAM");
  assert.equal(dynamic.tradable, true);
  assert.equal(dynamic.marginEligible, false);
  assert.equal(cryptoInstrument({ id: "bitcoin", symbol: "btc", name: "Bitcoin" }).id, getInstrument("BTC")!.id);
});
test("dynamic identity helpers round-trip", () => {
  assert.equal(isDynamicCryptoSymbol("cg:example-coin"), true);
  assert.equal(isDynamicCryptoSymbol("BTC"), false);
  assert.equal(coinGeckoIdFromSymbol("cg:example-coin"), "example-coin");
  assert.equal(coinGeckoIdFromInstrumentId("crypto:cg:example-coin"), "example-coin");
});
test("market rows normalize numeric strings and icons safely", () => {
  const market = mapMarketRow({ ...row, current_price: "1.23", market_cap_rank: "123" })!;
  assert.equal(market.price, 1.23);
  assert.equal(market.rank, 123);
  assert.equal(market.image, row.image);
  assert.deepEqual(market.sparkline, [1, 1.1, 1.2]);
  assert.equal(safeImage("https://example.com/logo.png"), null);
  assert.equal(safeImage("javascript:alert(1)"), null);
});
test("fresh CoinGecko quotes are delayed paper-eligible, stale quotes are not", () => {
  const instrument = cryptoInstrument({ id: "example-coin", symbol: "exam", name: "Example Coin" });
  const market = mapMarketRow(row)!;
  const fresh = quoteFromMarket(instrument, market, now);
  assert.equal(fresh.status, "live");
  assert.equal(fresh.latency, "delayed");
  assert.equal(fresh.marketOpen, true);
  const stale = quoteFromMarket(instrument, { ...market, lastUpdated: "2026-10-30T11:00:00Z" }, now);
  assert.equal(stale.status, "stale");
});
test("invalid prices and missing ids do not become quotes", () => {
  assert.equal(mapMarketRow({ symbol: "exam", name: "Example" }), null);
  const instrument = cryptoInstrument({ id: "example-coin", symbol: "exam", name: "Example Coin" });
  const market = mapMarketRow({ ...row, current_price: 0 })!;
  assert.equal(quoteFromMarket(instrument, market, now).price, null);
});
test("coin descriptions are stripped to plain text", () => {
  assert.equal(stripHtml("<p>Hello <b>world</b>!</p>"), "Hello world !");
  assert.equal(stripHtml(null), "");
});

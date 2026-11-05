import dotenv from 'dotenv';
import pg from 'pg';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
dotenv.config({ path: '.env.local' });
dotenv.config();
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const dbName = new URL(databaseUrl).pathname;
if (process.env.MARKET_DATA_MODE !== 'demo' || !/^\/(tetratrades_)?(test|preview)/.test(dbName) || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Safety stop: this smoke test requires MARKET_DATA_MODE=demo, a local test/preview database, and a loopback SMOKE_BASE_URL.');
}
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const userId = randomUUID();
const token = randomBytes(32).toString('hex');
const cookie = `nexa_session=${token}`;
let passed = 0;
async function request(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
function check(condition, label) { if (!condition) throw new Error(`FAIL: ${label}`); passed++; console.log(`PASS: ${label}`); }
try {
  await client.query(`INSERT INTO users (id,name,email,cash_balance,is_demo,role,currency,email_verified_at) VALUES ($1,'Multi-asset smoke',$2,100000,false,'user','USD',now())`, [userId, `smoke-${userId}@example.test`]);
  await client.query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval \'1 hour\')', [createHash('sha256').update(token).digest('hex'), userId]);
  const market = await request('/api/market');
  check(market.status === 200 && market.data.mode === 'demo' && market.data.assets.length === 33, 'all 33 instruments load in explicit demo mode');
  check(new Set(market.data.assets.map(a => a.assetClass)).size === 7, 'all seven asset classes are present');
  const account = await request('/api/app');
  check(account.status === 200 && account.data.user.id === userId, 'authenticated workspace loads');
  for (const [symbol, quantity, instrumentId] of [['AAPL', 2, 'stock:XNAS:AAPL'], ['TLT', 2, 'etf:XNAS:TLT'], ['EURUSD', 1000, 'forex:EURUSD'], ['XAUUSD', 0.1, 'commodity:XAUUSD']]) {
    const result = await request('/api/app', { action: 'trade', symbol, side: 'buy', quantity, currency: 'USD' });
    check(result.status === 200, `${symbol} paper market order fills`);
    const holding = await client.query('SELECT instrument_id, quantity FROM holdings WHERE user_id=$1 AND symbol=$2', [userId, symbol]);
    check(holding.rows[0]?.instrument_id === instrumentId && Number(holding.rows[0]?.quantity) === quantity, `${symbol} stores stable identity and exact units`);
  }
  for (const [symbol, quantity, label] of [['AAPL', 0.5, 'fractional stock'], ['SPX', 1, 'index'], ['US10Y', 1, 'bond yield'], ['EURUSD', 1, 'undersized FX']]) {
    const result = await request('/api/app', { action: 'trade', symbol, side: 'buy', quantity, currency: 'USD' });
    check(result.status === 400, `${label} is rejected server-side`);
  }
  const margin = await request('/api/positions', { symbol: 'AAPL', side: 'long', leverage: 1, margin: 100, currency: 'USD' });
  check(margin.status === 400, 'stock timed/margin order is rejected');
  const starred = await request('/api/watchlist', { symbol: 'SPX' });
  check(starred.status === 200, 'reference index can be watchlisted');
  const alert = await request('/api/price-alerts', { symbol: 'US10Y', direction: 'above', targetPrice: 25, currency: 'EUR' });
  check(alert.status === 200 && Number(alert.data.alert.targetPrice) === 25, 'bond-yield alert stays in percent, not FX-converted');
  const aapl = market.data.assets.find(a => a.symbol === 'AAPL');
  const order = await request('/api/orders', { symbol: 'AAPL', side: 'buy', type: 'limit', quantity: 1, triggerPrice: aapl.price * 0.5, currency: 'USD' });
  check(order.status === 200 && order.data.filled === false, 'non-marketable stock limit order stays open');
  const orders = await request('/api/orders');
  const openOrder = orders.data.open.find(o => o.symbol === 'AAPL');
  check(openOrder?.instrumentId === 'stock:XNAS:AAPL', 'pending order stores instrument identity');
  const cancelled = await request(`/api/orders/${openOrder.id}`, { action: 'cancel' }, 'PATCH');
  check(cancelled.status === 200, 'pending stock order can be cancelled');
  const chart = await request('/api/market/chart?mode=portfolio&period=7D');
  check(chart.status === 200 && chart.data.points.length >= 2, 'mixed-class portfolio history loads');
  const yieldChart = await request('/api/market/candles?symbol=US10Y&period=30D');
  check(yieldChart.status === 200 && yieldChart.data.valueKind === 'yield' && yieldChart.data.volumeUnit === null, 'yield chart is not labeled as a price or volume series');
  const expectedCash = (await client.query('SELECT cash_balance FROM users WHERE id=$1', [userId])).rows[0].cash_balance;
  const fills = (await client.query('SELECT side,total FROM trades WHERE user_id=$1', [userId])).rows;
  const calculated = 100000 + fills.reduce((sum, t) => sum + (t.side === 'buy' ? -Number(t.total) : Number(t.total)), 0);
  check(Math.abs(Number(expectedCash) - calculated) < 0.011, 'cash ledger reconciles with multi-asset fills');
  // Exercise the additive migration on a legacy-shaped row, without changing units.
  await client.query('INSERT INTO holdings (user_id,symbol,quantity,avg_price) VALUES ($1,$2,$3,$4)', [userId, 'BTC', '0.1', '60000']);
  await client.query(await readFile(new URL('../migrations/20261030_multi_asset_instrument_ids.sql', import.meta.url), 'utf8'));
  const legacy = (await client.query('SELECT instrument_id,quantity,avg_price FROM holdings WHERE user_id=$1 AND symbol=$2', [userId, 'BTC'])).rows[0];
  check(legacy.instrument_id === 'crypto:BTC' && legacy.quantity === '0.10000000' && legacy.avg_price === '60000.00000000', 'legacy crypto migration preserves quantity and cost basis');
  console.log(`\n${passed} integration checks passed.`);
} finally {
  await client.query('DELETE FROM users WHERE id=$1', [userId]);
  await client.end();
}

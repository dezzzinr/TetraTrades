import dotenv from 'dotenv';
import pg from 'pg';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5432';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const dbName = new URL(databaseUrl).pathname;
if (process.env.MARKET_DATA_MODE !== 'provider' || !/^\/(tetratrades_)?(test|preview)/.test(dbName) || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Safety stop: requires MARKET_DATA_MODE=provider, a local test/preview database, and a loopback SMOKE_BASE_URL.');
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
  await client.query(`INSERT INTO users (id,name,email,cash_balance,is_demo,role,currency,email_verified_at) VALUES ($1,'CoinGecko smoke',$2,100000,false,'user','USD',now())`, [userId, `cg-smoke-${userId}@example.test`]);
  await client.query(`INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '1 hour')`, [createHash('sha256').update(token).digest('hex'), userId]);
  const page = await request('/api/crypto/assets?perPage=10&page=1');
  check(page.status === 200 && page.data.total > 1000 && page.data.assets.some(a => a.symbol === 'BTC' && a.image), 'full CoinGecko catalog loads with icons');
  const search = await request('/api/crypto/assets?search=uniswap&perPage=5');
  const uni = search.data.assets?.find(a => a.symbol === 'cg:uniswap');
  check(search.status === 200 && !!uni, 'long-tail CoinGecko coin is searchable by name');
  const discovery = await request('/api/crypto/discovery');
  check(discovery.status === 200 && discovery.data.trending?.length && discovery.data.categories?.length && discovery.data.exchanges?.length && discovery.data.global?.active_cryptocurrencies > 1000, 'trending/categories/exchanges/global discovery loads');
  const detail = await request('/api/crypto/coin/uniswap');
  check(detail.status === 200 && detail.data.asset?.image && Object.keys(detail.data.detail?.platforms ?? {}).length > 0, 'coin detail includes icon and contract metadata');
  const buy = await request('/api/app', { action: 'trade', symbol: 'cg:uniswap', side: 'buy', amount: 10, currency: 'USD' });
  check(buy.status === 200, 'dynamic CoinGecko coin paper buy fills');
  const holding = (await client.query('SELECT instrument_id, quantity FROM holdings WHERE user_id=$1 AND symbol=$2', [userId, 'cg:uniswap'])).rows[0];
  check(holding?.instrument_id === 'crypto:cg:uniswap' && Number(holding?.quantity) > 0, 'dynamic holding stores collision-proof CoinGecko identity');
  const margin = await request('/api/positions', { symbol: 'cg:uniswap', side: 'long', leverage: 2, margin: 100, currency: 'USD' });
  check(margin.status === 400, 'long-tail dynamic coin does not inherit crypto margin');
  const watch = await request('/api/watchlist', { symbol: 'cg:uniswap' });
  check(watch.status === 200, 'dynamic coin can be watchlisted');
  const alert = await request('/api/price-alerts', { symbol: 'cg:uniswap', direction: 'above', targetPrice: (uni?.price ?? detail.data.asset.price) * 10, currency: 'USD' });
  check(alert.status === 200 && alert.data.alert?.instrumentId === 'crypto:cg:uniswap', 'dynamic coin alert stores stable identity');
  const candles = await request('/api/market/candles?symbol=cg%3Auniswap&period=7D');
  check(candles.status === 200 && candles.data.candles?.length > 10, 'dynamic coin chart loads');
  const sell = await request('/api/app', { action: 'trade', symbol: 'cg:uniswap', side: 'sell', quantity: Number(holding.quantity), currency: 'USD' });
  check(sell.status === 200, 'dynamic coin paper sell fills');
  console.log(`\n${passed} CoinGecko universe integration checks passed.`);
} finally {
  await client.query('DELETE FROM users WHERE id=$1', [userId]);
  await client.end();
}

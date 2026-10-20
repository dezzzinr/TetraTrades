// One-time seed script for the trading bot catalog and subscription plans.
// Safe to re-run: it only inserts into a table when that table is empty, so
// it won't duplicate rows or clobber admin edits made after the first run.
//
// Usage:  npm run seed
// Requires DATABASE_URL in your environment / .env file.

import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const BOTS = [
  { name: "BTC DCA Starter", description: "Dollar-cost-averages into Bitcoin at steady intervals so you build a position without timing the market.", strategy: "DCA", riskLevel: "Low", minAllocation: 50, subscriptionAmount: 9 },
  { name: "Conservative DCA Plus", description: "A slower, steadier DCA strategy spread across majors for investors who want to minimize volatility.", strategy: "DCA", riskLevel: "Low", minAllocation: 75, subscriptionAmount: 12 },
  { name: "Stablecoin Yield Bot", description: "Keeps allocation parked and accumulating in small, frequent buys - built for patient, low-risk exposure.", strategy: "Yield", riskLevel: "Low", minAllocation: 50, subscriptionAmount: 5 },
  { name: "ETH Grid Trader", description: "Places buy and sell orders across a price range on Ethereum to capture gains from sideways markets.", strategy: "Grid", riskLevel: "Moderate", minAllocation: 100, subscriptionAmount: 15 },
  { name: "Multi-Asset Rebalancer", description: "Periodically rebalances an allocation across several top assets to maintain target weightings.", strategy: "Rebalancing", riskLevel: "Moderate", minAllocation: 150, subscriptionAmount: 19 },
  { name: "Swing Trader AI", description: "Follows medium-term market swings, aiming to enter early in a trend and exit before it reverses.", strategy: "Momentum", riskLevel: "Moderate", minAllocation: 150, subscriptionAmount: 22 },
  { name: "BTC Grid Pro", description: "A tighter, higher-frequency grid strategy on Bitcoin designed for active ranges and higher volume.", strategy: "Grid", riskLevel: "Moderate", minAllocation: 250, subscriptionAmount: 35 },
  { name: "Momentum Surge", description: "Chases strong directional moves across major assets, scaling in as momentum builds.", strategy: "Momentum", riskLevel: "High", minAllocation: 200, subscriptionAmount: 25 },
  { name: "Altcoin Momentum Hunter", description: "Looks for breakout momentum in higher-volatility altcoins - higher risk, higher potential swings.", strategy: "Momentum", riskLevel: "High", minAllocation: 100, subscriptionAmount: 29 },
  { name: "Scalper Bot", description: "Aims for many small, fast gains throughout the day - the highest-activity, highest-risk strategy in the catalog.", strategy: "Scalping", riskLevel: "High", minAllocation: 300, subscriptionAmount: 39 },
];

const PLANS = [
  { name: "Starter", description: "The essentials to get started trading with confidence.", priceWeekly: 0, features: ["Paper trading dashboard", "Market overview", "Portfolio tracking", "Basic trade history"], isFeatured: false, sortOrder: 0 },
  { name: "Pro", description: "Powerful tools for traders ready to take the next step.", priceWeekly: 15, features: ["Everything in Starter", "Trading bot subscriptions", "Copy trading subscriptions", "Advanced market signals", "Priority insights"], isFeatured: true, sortOrder: 1 },
  { name: "Elite", description: "The complete experience for serious market explorers.", priceWeekly: 35, features: ["Everything in Pro", "Unlimited bot instances", "All trading signals", "Advanced portfolio analytics", "VIP experience"], isFeatured: false, sortOrder: 2 },
  { name: "Institutional", description: "White-glove tools and priority access for power users.", priceWeekly: 75, features: ["Everything in Elite", "Dedicated account concierge", "Early access to new bots & traders", "Custom portfolio reporting", "Priority support response"], isFeatured: false, sortOrder: 3 },
];

async function main() {
  await client.connect();

  const { rows: botCount } = await client.query("SELECT COUNT(*)::int AS n FROM bot_products");
  if (botCount[0].n === 0) {
    for (const b of BOTS) {
      await client.query(
        `INSERT INTO bot_products (name, description, strategy, risk_level, min_allocation, subscription_amount, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [b.name, b.description, b.strategy, b.riskLevel, b.minAllocation.toFixed(2), b.subscriptionAmount.toFixed(2)]
      );
    }
    console.log(`Seeded ${BOTS.length} trading bots.`);
  } else {
    console.log(`Skipped bot seed - bot_products already has ${botCount[0].n} row(s).`);
  }

  const { rows: planCount } = await client.query("SELECT COUNT(*)::int AS n FROM plans");
  if (planCount[0].n === 0) {
    for (const p of PLANS) {
      await client.query(
        `INSERT INTO plans (name, description, price_weekly, features, is_featured, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [p.name, p.description, p.priceWeekly.toFixed(2), p.features, p.isFeatured, p.sortOrder]
      );
    }
    console.log(`Seeded ${PLANS.length} plans.`);
  } else {
    console.log(`Skipped plan seed - plans already has ${planCount[0].n} row(s).`);
  }

  await client.end();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});

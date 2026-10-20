// Shared constants/helpers for the trading bot feature. Admins curate a
// catalog of bot products (strategy, risk, price) from the admin panel;
// users pay for a 7-day subscription to a product, then can configure any
// number of their own instances of it (e.g. one per asset) while that
// subscription stays active.

export { SUBSCRIPTION_DAYS, SUBSCRIPTION_MS } from "@/lib/subscriptions";
export { RISK_LEVELS, type RiskLevel } from "@/lib/copy-trading";
export { SUBSCRIPTION_DURATION_OPTIONS, type SubscriptionDurationDays } from "@/lib/catalog-profile";

export const BOT_STRATEGIES = ["DCA", "Grid", "Momentum", "Scalping", "Rebalancing", "Yield"] as const;
export type BotStrategy = (typeof BOT_STRATEGIES)[number];

import { RISK_LEVELS, type RiskLevel } from "@/lib/copy-trading";
import { validateProfileFields } from "@/lib/catalog-profile";

// Validates/normalizes admin-submitted bot product fields. When `partial`
// is true (PATCH), only fields present in `body` are validated/returned.
export function validateBotProductFields(body: Record<string, unknown>, partial: boolean): { error: string; updates?: undefined } | { error?: undefined; updates: Record<string, unknown> } {
  const updates: Record<string, unknown> = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 80) return { error: "Name must be between 2 and 80 characters." };
    updates.name = name;
  }
  if (!partial || body.description !== undefined) {
    const description = String(body.description ?? "").trim();
    if (description.length < 1 || description.length > 400) return { error: "Description must be between 1 and 400 characters." };
    updates.description = description;
  }
  if (!partial || body.strategy !== undefined) {
    const strategy = String(body.strategy ?? "");
    if (!BOT_STRATEGIES.includes(strategy as BotStrategy)) return { error: "Choose a valid strategy." };
    updates.strategy = strategy;
  }
  if (!partial || body.riskLevel !== undefined) {
    const riskLevel = String(body.riskLevel ?? "Moderate");
    if (!RISK_LEVELS.includes(riskLevel as RiskLevel)) return { error: "Choose a valid risk level." };
    updates.riskLevel = riskLevel;
  }
  if (!partial || body.minAllocation !== undefined) {
    const minAllocation = Number(body.minAllocation);
    if (!Number.isFinite(minAllocation) || minAllocation < 0 || minAllocation > 1000000) return { error: "Enter a valid minimum allocation." };
    updates.minAllocation = minAllocation.toFixed(2);
  }
  if (!partial || body.subscriptionAmount !== undefined) {
    const subscriptionAmount = Number(body.subscriptionAmount);
    if (!Number.isFinite(subscriptionAmount) || subscriptionAmount < 0 || subscriptionAmount > 1000000) return { error: "Enter a valid subscription price." };
    updates.subscriptionAmount = subscriptionAmount.toFixed(2);
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  const profile = validateProfileFields(body, partial);
  if (profile.error !== undefined) return { error: profile.error };
  return { updates: { ...updates, ...profile.updates } };
}

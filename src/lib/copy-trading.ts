// Shared constants for the copy-trading feature. Admins curate the trader
// roster (name, stats, price) from the admin panel; users subscribe for a
// fixed 7-day window and are charged the trader's current subscription
// price from their paper-trading cash balance.

export { SUBSCRIPTION_DAYS, SUBSCRIPTION_MS } from "@/lib/subscriptions";
export { SUBSCRIPTION_DURATION_OPTIONS, type SubscriptionDurationDays } from "@/lib/catalog-profile";
import { validateProfileFields } from "@/lib/catalog-profile";

export const AVATAR_COLORS = ["blue", "purple", "orange", "pink", "green", "red"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const RISK_LEVELS = ["Low", "Moderate", "High"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Validates/normalizes admin-submitted trader fields. When `partial` is
// true (PATCH), only fields present in `body` are validated/returned.
export function validateTraderFields(body: Record<string, unknown>, partial: boolean): { error: string; updates?: undefined } | { error?: undefined; updates: Record<string, unknown> } {
  const updates: Record<string, unknown> = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 80) return { error: "Name must be between 2 and 80 characters." };
    updates.name = name;
  }
  if (!partial || body.handle !== undefined) {
    let handle = String(body.handle ?? "").trim();
    if (handle && !handle.startsWith("@")) handle = `@${handle}`;
    if (handle.length < 2 || handle.length > 40) return { error: "Handle must be between 2 and 40 characters." };
    updates.handle = handle;
  }
  if (!partial || body.avatarColor !== undefined) {
    const avatarColor = String(body.avatarColor ?? "blue");
    if (!AVATAR_COLORS.includes(avatarColor as AvatarColor)) return { error: "Choose a valid avatar color." };
    updates.avatarColor = avatarColor;
  }
  if (!partial || body.avatarInitials !== undefined) {
    const initials = String(body.avatarInitials ?? "").trim().slice(0, 3).toUpperCase() || initialsFromName(String(updates.name ?? body.name ?? ""));
    updates.avatarInitials = initials;
  }
  if (!partial || body.focus !== undefined) {
    const focus = String(body.focus ?? "").trim();
    if (focus.length < 1 || focus.length > 120) return { error: "Focus must be between 1 and 120 characters." };
    updates.focus = focus;
  }
  if (!partial || body.bio !== undefined) {
    const bio = String(body.bio ?? "").trim();
    if (bio.length < 1 || bio.length > 200) return { error: "Bio must be between 1 and 200 characters." };
    updates.bio = bio;
  }
  if (!partial || body.riskLevel !== undefined) {
    const riskLevel = String(body.riskLevel ?? "Moderate");
    if (!RISK_LEVELS.includes(riskLevel as RiskLevel)) return { error: "Choose a valid risk level." };
    updates.riskLevel = riskLevel;
  }
  if (!partial || body.returnPercent !== undefined) {
    const returnPercent = Number(body.returnPercent);
    if (!Number.isFinite(returnPercent) || returnPercent < -100 || returnPercent > 1000) return { error: "Enter a valid return percentage." };
    updates.returnPercent = returnPercent.toFixed(2);
  }
  if (!partial || body.winRate !== undefined) {
    const winRate = Number(body.winRate);
    if (!Number.isFinite(winRate) || winRate < 0 || winRate > 100) return { error: "Win rate must be between 0 and 100." };
    updates.winRate = winRate.toFixed(2);
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


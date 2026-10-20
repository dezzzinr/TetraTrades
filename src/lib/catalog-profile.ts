// Shared admin-settable "profile" fields reused by both the copy-trading
// roster and the trading bot catalog: a star rating, a country (rendered as
// a flag on the card), an optional profile photo, and the subscription
// duration that pairs with each item's price. Kept in one place so both
// catalogs validate/normalize these fields identically.

import { isCountryCode, DEFAULT_COUNTRY } from "@/lib/countries";

export const SUBSCRIPTION_DURATION_OPTIONS = [7, 14, 30, 60, 90] as const;
export type SubscriptionDurationDays = (typeof SUBSCRIPTION_DURATION_OPTIONS)[number];

export function validateProfileFields(body: Record<string, unknown>, partial: boolean): { error: string; updates?: undefined } | { error?: undefined; updates: Record<string, unknown> } {
  const updates: Record<string, unknown> = {};
  if (!partial || body.rating !== undefined) {
    const rating = Number(body.rating ?? 4.8);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) return { error: "Rating must be between 0 and 5." };
    updates.rating = rating.toFixed(1);
  }
  if (!partial || body.country !== undefined) {
    const country = String(body.country ?? DEFAULT_COUNTRY).toUpperCase();
    if (!isCountryCode(country)) return { error: "Choose a valid country." };
    updates.country = country;
  }
  if (!partial || body.photoUrl !== undefined) {
    const photoUrl = String(body.photoUrl ?? "").trim();
    if (photoUrl && !/^https?:\/\/.+/i.test(photoUrl)) return { error: "Profile photo must be a valid http(s) image URL." };
    if (photoUrl.length > 600) return { error: "Profile photo URL is too long." };
    updates.photoUrl = photoUrl || null;
  }
  if (!partial || body.subscriptionDurationDays !== undefined) {
    const durationDays = Number(body.subscriptionDurationDays ?? 7);
    if (!SUBSCRIPTION_DURATION_OPTIONS.includes(durationDays as SubscriptionDurationDays)) return { error: "Choose a valid subscription duration." };
    updates.subscriptionDurationDays = durationDays;
  }
  return { updates };
}

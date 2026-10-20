// Shared constants/helpers for the subscription plans feature. Admins
// curate the plan catalog (name, weekly price, feature list) from the admin
// panel; users subscribe to a plan for a fixed 7-day (weekly) window.

export { SUBSCRIPTION_DAYS, SUBSCRIPTION_MS } from "@/lib/subscriptions";

// Validates/normalizes admin-submitted plan fields. When `partial` is true
// (PATCH), only fields present in `body` are validated/returned.
export function validatePlanFields(body: Record<string, unknown>, partial: boolean): { error: string; updates?: undefined } | { error?: undefined; updates: Record<string, unknown> } {
  const updates: Record<string, unknown> = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 60) return { error: "Name must be between 2 and 60 characters." };
    updates.name = name;
  }
  if (!partial || body.description !== undefined) {
    const description = String(body.description ?? "").trim();
    if (description.length < 1 || description.length > 300) return { error: "Description must be between 1 and 300 characters." };
    updates.description = description;
  }
  if (!partial || body.priceWeekly !== undefined) {
    const priceWeekly = Number(body.priceWeekly);
    if (!Number.isFinite(priceWeekly) || priceWeekly < 0 || priceWeekly > 1000000) return { error: "Enter a valid weekly price." };
    updates.priceWeekly = priceWeekly.toFixed(2);
  }
  if (!partial || body.features !== undefined) {
    const raw = body.features;
    const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split("\n") : [];
    const features = list.map((f) => String(f).trim()).filter(Boolean).slice(0, 20);
    if (features.length === 0) return { error: "Add at least one feature." };
    updates.features = features;
  }
  if (!partial || body.isFeatured !== undefined) updates.isFeatured = Boolean(body.isFeatured);
  if (!partial || body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    updates.sortOrder = (Number.isFinite(sortOrder) ? sortOrder : 0).toFixed(0);
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  return { updates };
}

// Shared constants and helpers for the manual deposit-review workflow.
// Deposits are never credited automatically: a user sends funds to an
// admin-provided destination outside the app, submits a receipt, and an
// admin approves or rejects the request before any balance changes.

export type DepositMethod = "crypto" | "bank_transfer" | "paypal" | "cashapp" | "giftcard";

export const DEPOSIT_METHODS: { id: DepositMethod; label: string; blurb: string }[] = [
  { id: "crypto", label: "Cryptocurrency", blurb: "Send BTC, ETH, USDT or another supported coin to the wallet address below." },
  { id: "bank_transfer", label: "Bank transfer", blurb: "Send a wire or ACH transfer to the bank account below." },
  { id: "paypal", label: "PayPal", blurb: "Send a PayPal payment to the email address below." },
  { id: "cashapp", label: "Cash App", blurb: "Send a payment to the $Cashtag below." },
  { id: "giftcard", label: "Gift card", blurb: "Purchase a supported gift card and submit a photo of the card and code." },
];

export const DEPOSIT_METHOD_IDS = DEPOSIT_METHODS.map((m) => m.id) as DepositMethod[];

export function depositMethodLabel(id: string) {
  return DEPOSIT_METHODS.find((m) => m.id === id)?.label ?? id;
}

export const DEPOSIT_STATUS_LABELS: Record<string, string> = { pending: "Pending review", approved: "Approved", rejected: "Rejected" };

// Receipts are stored as base64 data URLs directly in Postgres to avoid
// needing extra file-storage infrastructure. Keep the raw file small so the
// encoded JSON payload stays well under typical serverless request-body
// limits (e.g. Vercel's ~4.5MB) - swap this for object storage (S3, Vercel
// Blob, etc.) if you need to support larger files.
export const MAX_RECEIPT_BYTES = 3 * 1024 * 1024; // 3MB raw file
export const ALLOWED_RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export function parseDataUrl(dataUrl: string): { mimeType: string; base64: string; byteLength: number } | null {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const [, mimeType, base64] = match;
  if (base64.length === 0) return null;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;
  return { mimeType, base64, byteLength };
}

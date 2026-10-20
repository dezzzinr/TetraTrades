import { DEPOSIT_METHODS, depositMethodLabel } from "@/lib/deposits";

// Users can request a payout to any platform they choose - the same five
// methods deposits support, plus a free-form "other" option for anything
// not listed. Unlike deposits, the user supplies the destination (their own
// wallet/account/email/tag) since the funds are going out to them.
export type WithdrawalMethod = (typeof DEPOSIT_METHODS)[number]["id"] | "other";

export const WITHDRAWAL_METHODS: { id: WithdrawalMethod; label: string; blurb: string; placeholder: string }[] = [
  { id: "crypto", label: "Cryptocurrency", blurb: "Receive funds at a crypto wallet address you control.", placeholder: "e.g. Wallet address and network (BTC, ETH, USDT-TRC20, ...)" },
  { id: "bank_transfer", label: "Bank transfer", blurb: "Receive a wire or ACH transfer to your bank account.", placeholder: "e.g. Bank name, account name, account number, routing number" },
  { id: "paypal", label: "PayPal", blurb: "Receive a PayPal payment at your email address.", placeholder: "e.g. Your PayPal email address" },
  { id: "cashapp", label: "Cash App", blurb: "Receive a payment at your $Cashtag.", placeholder: "e.g. $YourCashtag" },
  { id: "giftcard", label: "Gift card", blurb: "Receive your payout as a gift card.", placeholder: "e.g. Preferred gift card brand and delivery email" },
  { id: "other", label: "Other", blurb: "Choose this if your preferred payout platform isn't listed above.", placeholder: "Describe where and how we should send your payout" },
];

export const WITHDRAWAL_METHOD_IDS = WITHDRAWAL_METHODS.map((m) => m.id);

export function withdrawalMethodLabel(method: string, methodLabel?: string | null) {
  if (method === "other") return methodLabel?.trim() || "Other";
  return depositMethodLabel(method);
}

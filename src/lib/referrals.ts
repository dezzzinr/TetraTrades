// Referral program: every user gets a unique shareable code at registration
// (never user-chosen). Entering someone else's code at signup links the two
// accounts and credits a one-time paper-trading bonus to both sides.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const REFERRAL_BONUS_AMOUNT = 25; // USD credited to both the new user and the referrer

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I - easier to read/share aloud

function randomCode(length = 7): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

// Generates a fresh referral code guaranteed unique against the database.
// Collisions are astronomically unlikely (33^7 ≈ 4 trillion combinations)
// but this stays correct even if they happen.
export async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
    if (!existing) return code;
  }
  // Fall back to a longer code if we somehow kept colliding.
  return randomCode(10);
}

// Looks up the user whose referral code was entered at signup. Returns null
// (silently ignored, never blocks registration) if the code doesn't match
// any account - referral codes are a bonus, not a required/validated field.
export async function findReferrer(enteredCode: string) {
  const code = enteredCode.trim().toUpperCase();
  if (!code) return null;
  const [referrer] = await db.select().from(users).where(eq(users.referralCode, code)).limit(1);
  return referrer ?? null;
}

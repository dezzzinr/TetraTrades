// Shared constants and helpers for the registration form / profile page.

export const GENDERS: { id: string; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "non_binary", label: "Non-binary" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
];

export function genderLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return GENDERS.find((g) => g.id === id)?.label ?? id;
}

// Profile photos are stored as base64 data URLs directly in Postgres, same
// pattern as deposit receipts (see src/lib/deposits.ts) - kept small since
// it's just an avatar.
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB raw file
export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const MIN_SIGNUP_AGE = 18;

export function calculateAge(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,24}$/;
export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

// Normalizes a security answer before hashing/comparing so that casing and
// stray whitespace don't cause an otherwise-correct answer to fail.
export function normalizeSecurityAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

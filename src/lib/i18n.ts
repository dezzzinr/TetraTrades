// Supported UI languages. Kept deliberately curated rather than
// "every language MyMemory supports" so the selector stays a clean dropdown.
// Add more here any time - the only other place to touch is
// MYMEMORY_LANGPAIR in src/lib/translate-server.ts (which is typed as
// Record<LanguageCode, string>, so the build fails loudly if a new language
// is added here without a translation-API code there).
// The translation cache/API picks up new languages automatically.
export type LanguageCode =
  | "en" | "es" | "fr" | "pt" | "ar" | "hi" | "zh" | "ru"
  | "pl" | "de" | "it" | "nl" | "sv" | "ro" | "cs" | "el" | "uk";

export type LanguageInfo = { code: LanguageCode; label: string; nativeLabel: string; flag: string; rtl?: boolean };

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸" },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", flag: "🇵🇹" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", rtl: true },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳" },
  { code: "zh", label: "Chinese (Simplified)", nativeLabel: "中文", flag: "🇨🇳" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", flag: "🇷🇺" },
  { code: "pl", label: "Polish", nativeLabel: "Polski", flag: "🇵🇱" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italian", nativeLabel: "Italiano", flag: "🇮🇹" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands", flag: "🇳🇱" },
  { code: "sv", label: "Swedish", nativeLabel: "Svenska", flag: "🇸🇪" },
  { code: "ro", label: "Romanian", nativeLabel: "Română", flag: "🇷🇴" },
  { code: "cs", label: "Czech", nativeLabel: "Čeština", flag: "🇨🇿" },
  { code: "el", label: "Greek", nativeLabel: "Ελληνικά", flag: "🇬🇷" },
  { code: "uk", label: "Ukrainian", nativeLabel: "Українська", flag: "🇺🇦" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return !!value && LANGUAGES.some((l) => l.code === value);
}

export function languageInfo(code: string | null | undefined): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

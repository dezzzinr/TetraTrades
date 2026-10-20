"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, LanguageCode, isLanguageCode } from "@/lib/i18n";
import { UI_STRINGS } from "@/lib/ui-strings";

type Dictionary = Record<string, string>;
type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (text: string) => string;
  translating: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "nexa_language";
const dictCacheKey = (lang: string) => `nexa_i18n_${lang}`;

// Exposed so callers (e.g. the main dashboard) can tell whether this browser
// already has an explicit local choice before deciding to adopt a signed-in
// user's saved profile language.
export function readStoredLanguage(): LanguageCode | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(saved) ? saved : null;
  } catch {
    return null;
  }
}

// Wraps the whole app. Translation is "live" (machine-translated via
// /api/translate, which is backed by a free API + a persistent server-side
// cache) rather than a hand-written dictionary: the first time any language
// is selected, the full UI_STRINGS manifest is translated in one batch and
// cached both server-side (shared across every user, forever) and in this
// browser's localStorage (instant on repeat visits).
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => readStoredLanguage() ?? DEFAULT_LANGUAGE);
  const [dict, setDict] = useState<Dictionary>({});
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    // English needs no dictionary at all - t() always returns the raw
    // string when language === "en", so there's nothing to fetch or clear.
    if (language === "en") return;
    let cancelled = false;
    (async () => {
      try {
        const raw = window.localStorage.getItem(dictCacheKey(language));
        if (raw) setDict(JSON.parse(raw));
      } catch { /* ignore corrupt cache */ }
      setTranslating(true);
      const merged: Dictionary = {};
      const CHUNK = 150;
      for (let i = 0; i < UI_STRINGS.length; i += CHUNK) {
        if (cancelled) return;
        const chunk = UI_STRINGS.slice(i, i + CHUNK);
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language, texts: chunk }),
          });
          const result = await res.json();
          if (Array.isArray(result.translations)) {
            chunk.forEach((text: string, idx: number) => { merged[text] = result.translations[idx] ?? text; });
          }
        } catch { /* leave this chunk untranslated for now */ }
      }
      if (!cancelled) {
        setDict(merged);
        try { window.localStorage.setItem(dictCacheKey(language), JSON.stringify(merged)); } catch { /* ignore quota errors */ }
        setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }, []);

  const t = useCallback((text: string) => (language === "en" ? text : (dict[text] ?? text)), [language, dict]);

  const value = useMemo(() => ({ language, setLanguage, t, translating }), [language, setLanguage, t, translating]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

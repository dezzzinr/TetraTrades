"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LANGUAGE, LanguageCode, isLanguageCode, languageInfo } from "@/lib/i18n";
import { UI_STRINGS } from "@/lib/ui-strings";
import { TRANSLATION_OVERRIDES } from "@/lib/i18n-dictionaries";

type Dictionary = Record<string, string>;
type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (text: string) => string;
  translating: boolean;
  requestTranslation: (text: string) => void;
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
  // Match the server's default on the first browser render. Restore the local
  // preference after hydration so translated text never changes the SSR tree.
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [dict, setDict] = useState<Dictionary>({});
  const [translating, setTranslating] = useState(false);
  const dynamicQueue = useRef(new Set<string>());
  const dynamicInFlight = useRef(new Set<string>());
  const dynamicTimer = useRef<number | null>(null);
  const flushDynamicRef = useRef<() => void>(() => {});
  const activeLanguage = useRef(language);

  useEffect(() => {
    activeLanguage.current = language;
  }, [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLanguageState(readStoredLanguage() ?? DEFAULT_LANGUAGE), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const info = languageInfo(language);
    document.documentElement.lang = info.code;
    document.documentElement.dir = info.rtl ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    dynamicQueue.current.clear();
    if (dynamicTimer.current !== null) window.clearTimeout(dynamicTimer.current);
    dynamicTimer.current = null;
  }, [language]);

  useEffect(() => {
    // English needs no dictionary at all - t() always returns the raw
    // string when language === "en", so there's nothing to fetch or clear.
    // (Languages with a hand-written override entry still get the machine
    // translation for everything the dictionary doesn't cover, so this batch
    // fetch runs for them too.)
    if (language === "en") return;
    let cancelled = false;
    (async () => {
      const merged: Dictionary = {};
      try {
        const raw = window.localStorage.getItem(dictCacheKey(language));
        if (raw) {
          const cached = JSON.parse(raw) as Dictionary;
          Object.assign(merged, cached);
          setDict(cached);
        } else setDict({});
      } catch { /* ignore corrupt cache */ }
      setTranslating(true);
      const CHUNK = 400;
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
            if (!cancelled) {
              setDict(previous => ({ ...previous, ...Object.fromEntries(chunk.map(text => [text, merged[text]])) }));
              try { window.localStorage.setItem(dictCacheKey(language), JSON.stringify(merged)); } catch { /* ignore quota errors */ }
            }
          }
        } catch { /* leave this chunk untranslated for now */ }
      }
      if (!cancelled) {
        setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    if (lang === "en") {
      setDict({});
      setTranslating(false);
    }
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }, []);

  // Resolution order: hand-written override -> machine-translated dictionary
  // -> the English source string. Overrides are checked first and only for the
  // current language, so a partial dictionary never shadows a complete one.
  const t = useCallback((text: string) => {
    if (language === "en") return text;
    return TRANSLATION_OVERRIDES[language]?.[text] ?? dict[text] ?? text;
  }, [language, dict]);

  const flushDynamic = useCallback(async () => {
    dynamicTimer.current = null;
    const batch = [...dynamicQueue.current].slice(0, 400);
    batch.forEach(value => { dynamicQueue.current.delete(value); dynamicInFlight.current.add(`${language}\u0000${value}`); });
    if (!batch.length) return;
    try {
      const response = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, texts: batch }),
      });
      const result = await response.json();
      if (Array.isArray(result.translations)) {
        const translated = Object.fromEntries(batch.map((value, index) => [value, result.translations[index] ?? value]));
        if (activeLanguage.current === language) setDict(previous => ({ ...previous, ...translated }));
        try {
          const raw = window.localStorage.getItem(dictCacheKey(language));
          const cache = raw ? JSON.parse(raw) as Dictionary : {};
          window.localStorage.setItem(dictCacheKey(language), JSON.stringify({ ...cache, ...translated }));
        } catch { /* ignore corrupt/oversized browser caches */ }
      }
    } catch { /* dynamic content remains in its original language if translation is unavailable */ }
    finally {
      batch.forEach(value => dynamicInFlight.current.delete(`${language}\u0000${value}`));
      if (dynamicQueue.current.size && dynamicTimer.current === null) {
        dynamicTimer.current = window.setTimeout(() => { void flushDynamicRef.current(); }, 0);
      }
    }
  }, [language]);
  useEffect(() => {
    flushDynamicRef.current = () => { void flushDynamic(); };
  }, [flushDynamic]);

  const requestTranslation = useCallback((text: string) => {
    if (language === "en" || !text.trim() || UI_STRINGS.includes(text) || dict[text] || TRANSLATION_OVERRIDES[language]?.[text]) return;
    if (dynamicInFlight.current.has(`${language}\u0000${text}`)) return;
    dynamicQueue.current.add(text);
    if (dynamicTimer.current === null) dynamicTimer.current = window.setTimeout(() => { void flushDynamicRef.current(); }, 25);
  }, [language, dict]);

  const value = useMemo(() => ({ language, setLanguage, t, translating, requestTranslation }), [language, setLanguage, t, translating, requestTranslation]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

/** Translate literal JSX copy while keeping the surrounding markup semantic. */
export function LocalizedText({ text }: { text: string }) {
  const { t, language, requestTranslation } = useLanguage();
  useEffect(() => {
    if (language !== "en" && !UI_STRINGS.includes(text)) requestTranslation(text);
  }, [language, requestTranslation, text]);
  return t(text);
}

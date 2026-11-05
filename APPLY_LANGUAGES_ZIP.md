# Adding 9 European languages + hand-written Polish dictionary

This zip is a **drop-in overlay of the 5 changed files** (paths are repo-relative,
so you can unzip it straight over your TetraTrades checkout).

## Files in this zip

| File | Change |
|---|---|
| `src/lib/i18n.ts` | +9 language codes (17 total) |
| `src/lib/translate-server.ts` | +1 line: MyMemory codes for the new pairs |
| `src/lib/i18n-dictionaries.ts` | **New** - 154 hand-written Polish strings |
| `src/components/i18n-provider.tsx` | `t()` resolves override -> MT cache -> English |
| `README.md` | Docs updated to match |
| `tetratrades-add-european-languages.patch` | Same changes as a git patch, if you prefer that |

## Option A - copy the files over (simplest)

From the root of your local TetraTrades checkout:

    unzip -o /path/to/TetraTrades-languages.zip
    git status
    git add -A
    git commit -m "Add 9 European languages + hand-written Polish dictionary"
    git push

`-o` overwrites the existing files. Since this zip contains only these 5 files,
nothing else in your repo is touched.

## Option B - apply the patch instead

    git apply tetratrades-add-european-languages.patch

## Verify

    npm install
    npx tsc --noEmit     # exits clean
    npx next build       # succeeds

Then open the app, click the globe icon in the topbar, and pick Polski.

## Notes

- No database migration is needed. `translation_cache` is keyed per
  `(language, sourceHash)`, so new languages populate themselves on first use.
- Polish renders entirely from the hand-written dictionary - it needs no
  translation API call at all (verified: 0 English fallbacks with the API down).
- The other 8 new languages use MyMemory machine translation, exactly like the
  existing 8. Their MyMemory pairs were live-tested and all return 200.
- Based on upstream HEAD `81bde47`. If you've since edited these same files,
  prefer `git apply --3way` with the patch, or re-apply manually.

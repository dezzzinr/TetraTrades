import type { LanguageCode } from "@/lib/i18n";

// Hand-written translation overrides for a subset of UI_STRINGS.
//
// The app's translation layer is otherwise fully machine-generated (see
// src/lib/translate-server.ts + /api/translate): English source strings are
// sent to MyMemory once per language and cached forever in `translation_cache`.
// That keeps adding a language nearly free, but short UI labels are exactly
// where machine translation is weakest - Polish in particular has seven
// grammatical cases, so a lookup engine often returns the wrong inflection for
// strings like "Trade History" or "Withdraw" that have no surrounding sentence
// to disambiguate them.
//
// Anything listed here is used verbatim and skips the API entirely; any string
// NOT listed still falls back to the machine translation, then to the English
// original. So a dictionary can be partial - it's a quality layer on top of the
// existing pipeline, not a replacement for it. `t()` resolves in this order:
//
//   1. OVERRIDES[language][text]   (this file - hand-written, best quality)
//   2. machine translation cache   (translation_cache / localStorage)
//   3. the English source text     (last-resort fallback)
//
// Keys MUST match the strings in src/lib/ui-strings.ts exactly (including
// punctuation, capitalisation, and the em dashes) or they'll never be hit.
//
// Add a language here whenever a native speaker - or a careful review - can
// cover its most-seen chrome. The rest keeps machine-translating for free.

export const TRANSLATION_OVERRIDES: Partial<Record<LanguageCode, Record<string, string>>> = {
  pl: {
    // Nav groups
    "WORKSPACE": "PRZESTRZEŃ ROBOCZA",
    "GROW YOUR WEALTH": "POWIĘKSZAJ SWÓJ MAJĄTEK",
    "ACCOUNT": "KONTO",

    // Nav items
    "Overview": "Przegląd",
    "Portfolio": "Portfel",
    "Trade": "Handel",
    "Markets": "Rynki",
    "Trading Bot": "Bot handlowy",
    "Copy Trading": "Kopiowanie transakcji",
    "Trading Signals": "Sygnały handlowe",
    "Plans": "Plany",
    "Profile": "Profil",
    "Deposit": "Wpłata",
    "Withdraw": "Wypłata",
    "Transactions": "Transakcje",
    "Trade History": "Historia handlu",
    "NEW": "NOWE",

    // Sidebar footer
    "Need a hand?": "Potrzebujesz pomocy?",
    "Explore the platform with your free demo account.": "Poznaj platformę dzięki darmowemu kontu demonstracyjnemu.",
    "Explore signals": "Przeglądaj sygnały",
    "Secure paper trading platform": "Bezpieczna platforma handlu symulowanego",

    // Topbar
    "Workspace": "Przestrzeń robocza",
    "Search markets...": "Szukaj rynków...",
    "Notifications": "Powiadomienia",
    "No notifications yet": "Brak powiadomień",
    "Admin panel": "Panel administratora",
    "View profile": "Zobacz profil",
    "Create an account": "Utwórz konto",
    "Sign in": "Zaloguj się",
    "Log out": "Wyloguj się",
    "Demo account": "Konto demo",
    "Exploring in demo mode": "Przeglądanie w trybie demo",
    "No active plan": "Brak aktywnego planu",
    "member": "członek",

    // Overview page
    "Good to see you,": "Dobrze Cię widzieć,",
    "Here's what's happening with your portfolio today.": "Oto co dzieje się dziś z Twoim portfelem.",
    "Paper trading": "Handel symulowany",
    "Add funds": "Dodaj środki",

    // Common buttons / actions
    "Save": "Zapisz",
    "Cancel": "Anuluj",
    "Submit": "Wyślij",
    "Close": "Zamknij",
    "Continue": "Kontynuuj",
    "Back": "Wstecz",
    "Next": "Dalej",
    "Confirm": "Potwierdź",
    "Buy": "Kup",
    "Sell": "Sprzedaj",
    "Place trade": "Złóż transakcję",
    "Place order": "Złóż zlecenie",
    "Place position": "Otwórz pozycję",

    // Auth modals
    "Welcome back": "Witamy ponownie",
    "Sign in to pick up right where you left off.": "Zaloguj się, aby kontynuować od miejsca, w którym skończyłeś.",
    "Email or username": "E-mail lub nazwa użytkownika",
    "Password": "Hasło",
    "Forgot password?": "Nie pamiętasz hasła?",
    "Please wait...": "Proszę czekać...",
    "New to Tetratrades?": "Pierwszy raz w Tetratrades?",
    "Your account is secured with encrypted credentials": "Twoje konto jest chronione zaszyfrowanymi danymi logowania",
    "Don't have an account?": "Nie masz konta?",
    "Sign up": "Zarejestruj się",
    "Already have an account?": "Masz już konto?",
    "Full Name": "Imię i nazwisko",
    "Date of Birth": "Data urodzenia",
    "Gender": "Płeć",
    "Country": "Kraj",
    "State/Province": "Województwo/region",
    "City": "Miasto",
    "Residential Address": "Adres zamieszkania",
    "Phone Number": "Numer telefonu",
    "Email Address": "Adres e-mail",
    "Profile Photo": "Zdjęcie profilowe",
    "Username": "Nazwa użytkownika",
    "Confirm Password": "Potwierdź hasło",
    "Referral/Promo Code": "Kod polecający/promocyjny",
    "Security Question": "Pytanie zabezpieczające",
    "Security Answer": "Odpowiedź zabezpieczająca",
    "I agree to the": "Akceptuję",
    "Terms & Conditions": "Regulamin",
    "Privacy Policy": "Politykę prywatności",
    "Personal Information": "Dane osobowe",
    "Account Setup": "Konfiguracja konta",
    "Create account": "Utwórz konto",

    // Forgot password flow
    "Reset your password": "Zresetuj hasło",
    "Enter your email or username": "Podaj adres e-mail lub nazwę użytkownika",
    "What's your security question answer?": "Jaka jest odpowiedź na Twoje pytanie zabezpieczające?",
    "New password": "Nowe hasło",
    "Confirm new password": "Potwierdź nowe hasło",
    "Reset password": "Zresetuj hasło",
    "Forgot your password?": "Nie pamiętasz hasła?",
    "Enter your email or username and we'll ask your security question.": "Podaj adres e-mail lub nazwę użytkownika, a wyświetlimy Twoje pytanie zabezpieczające.",
    "Looking up...": "Wyszukiwanie...",
    "Answer your security question": "Odpowiedz na pytanie zabezpieczające",
    "Your answer": "Twoja odpowiedź",
    "Resetting...": "Resetowanie...",
    "Password updated": "Hasło zaktualizowane",
    "Your password has been reset. You can now sign in with your new password.": "Hasło zostało zresetowane. Możesz teraz zalogować się nowym hasłem.",

    // Demo upgrade gate
    "Create a free account to continue": "Utwórz darmowe konto, aby kontynuować",
    "Sign up free": "Zarejestruj się za darmo",
    "Maybe later": "Może później",
    "Your demo trades, deposits, and subscriptions won't be saved until you create a free account.": "Twoje transakcje demo, wpłaty i subskrypcje nie zostaną zapisane, dopóki nie utworzysz darmowego konta.",
    "Keep exploring": "Kontynuuj przeglądanie",

    // Language selector
    "Language": "Język",

    // Page headings
    "My portfolio": "Mój portfel",
    "Your holdings valued against current market prices.": "Twoje aktywa wycenione według aktualnych cen rynkowych.",
    "Trade crypto": "Handluj kryptowalutami",
    "Live candlestick charts, full order types, and leveraged positions — no fees, no slippage.": "Wykresy świecowe na żywo, wszystkie typy zleceń i pozycje z dźwignią — bez prowizji i poślizgu.",
    "Explore markets": "Przeglądaj rynki",
    "Discover assets and find your next opportunity using CoinGecko market data.": "Odkrywaj aktywa i znajdź swoją kolejną okazję dzięki danym rynkowym CoinGecko.",
    "Trading bots": "Boty handlowe",
    "Subscribe to an admin-managed bot strategy for 7 days, then configure it to trade.": "Subskrybuj zarządzaną przez administratora strategię bota na 7 dni, a następnie skonfiguruj go do handlu.",
    "Copy trading": "Kopiowanie transakcji",
    "Subscribe to a trader's strategy for 7 days and track your subscription history.": "Subskrybuj strategię tradera na 7 dni i śledź historię subskrypcji.",
    "Market signals": "Sygnały rynkowe",
    "A clearer look at price momentum and today's trading range. Not financial advice.": "Przejrzysty obraz dynamiki cen i dzisiejszego zakresu handlu. To nie jest porada finansowa.",
    "Choose your plan": "Wybierz swój plan",
    "Subscribe weekly to unlock more of the platform. No auto-renewal — resubscribe (or switch) once your week is up.": "Subskrybuj tygodniowo, aby odblokować więcej możliwości platformy. Bez automatycznego odnawiania — przedłuż subskrypcję (lub zmień plan), gdy tydzień dobiegnie końca.",
    "Send a payment from outside Tetratrades using one of the methods below, then submit your receipt for admin review.": "Wyślij płatność spoza Tetratrades jedną z metod poniżej, a następnie prześlij potwierdzenie do weryfikacji przez administratora.",
    "Withdraw funds": "Wypłać środki",
    "Request a payout to any platform you choose. An admin reviews and sends it before it's final.": "Zamów wypłatę na dowolną wybraną platformę. Administrator weryfikuje ją i realizuje przed finalizacją.",
    "Keep track of every deposit, withdrawal, and plan charge.": "Śledź każdą wpłatę, wypłatę i opłatę za plan.",
    "Trade history": "Historia handlu",
    "Review every spot trade, order, and leveraged position in your paper-trading account.": "Przeglądaj każdą transakcję spot, zlecenie i pozycję z dźwignią na swoim koncie handlu symulowanego.",

    // Registration modal
    "Create your account": "Utwórz swoje konto",
    "Join Tetratrades": "Dołącz do Tetratrades",
    "Your trading journey starts here. Deposit paper funds anytime to start trading. Fields marked * are required.": "Twoja przygoda z handlem zaczyna się tutaj. W dowolnym momencie wpłać środki wirtualne, aby zacząć handlować. Pola oznaczone * są wymagane.",
    "Prefer not to specify": "Wolę nie podawać",
    "Select your country": "Wybierz swój kraj",
    "Optional": "Opcjonalne",
    "Your balances will display in": "Domyślna waluta Twoich sald to",
    "by default — you can change this later in your profile.": "— możesz ją zmienić później w swoim profilu.",
    "Replace photo": "Zmień zdjęcie",
    "Upload photo": "Prześlij zdjęcie",
    "Remove": "Usuń",
    "Optional · JPG, PNG, WEBP, or GIF · Max 2MB · can be added later": "Opcjonalne · JPG, PNG, WEBP lub GIF · Maks. 2 MB · można dodać później",
    "Re-enter your password": "Ponownie wpisz hasło",
    "Optional — e.g. favorite teacher's name": "Opcjonalne — np. imię ulubionego nauczyciela",
    "Setting a security question lets you reset your password later without email access.": "Ustawienie pytania zabezpieczającego pozwala później zresetować hasło bez dostępu do poczty e-mail.",
    "Creating account...": "Tworzenie konta...",
    "Upload a JPG, PNG, WEBP, or GIF image.": "Prześlij obraz w formacie JPG, PNG, WEBP lub GIF.",
    "File is too large. Max size is": "Plik jest za duży. Maksymalny rozmiar to",
    "Could not read that file. Please try again.": "Nie udało się odczytać pliku. Spróbuj ponownie.",
    "Enter your full name.": "Podaj imię i nazwisko.",
    "Enter your date of birth.": "Podaj datę urodzenia.",
    "Select your country.": "Wybierz swój kraj.",
    "Enter your phone number.": "Podaj numer telefonu.",
    "Enter your email address.": "Podaj adres e-mail.",
    "Choose a username.": "Wybierz nazwę użytkownika.",
    "Password must be at least 8 characters.": "Hasło musi mieć co najmniej 8 znaków.",
    "Password and confirm password do not match.": "Hasło i potwierdzenie hasła nie są zgodne.",
    "Enter both a security question and an answer, or leave both blank.": "Podaj pytanie zabezpieczające i odpowiedź lub pozostaw oba pola puste.",
    "You must agree to the Terms & Conditions.": "Musisz zaakceptować Regulamin.",
    "You must agree to the Privacy Policy.": "Musisz zaakceptować Politykę prywatności.",
    "Registration failed.": "Rejestracja nie powiodła się.",
  },
};

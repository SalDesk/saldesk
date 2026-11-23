# Operator panel fully in English (and German and Dutch kept in step)

Date: 2026-11-22. Owner: Rits Delgado.

## Intent

An operator who does not read Portuguese can run their business from the SalDesk panel in English, using the PT/EN switch that already sits in the top bar (`components/shared/LanguageToggle.jsx`). This opens SalDesk to the many foreign-run operators in Cape Verde (Italian, Portuguese, British and others).

## Owner decision (2026-11-22)

**(a) Four languages, as before.** Every new text gets PT, EN, DE and NL entries, keeping the rule enforced by `frontend/src/__tests__/i18nParity.test.js`: same keys, no empty texts, same `{placeholders}`.
- The switch keeps showing only PT/EN.
- DE/NL stay ready for when the owner turns them on.
- Turning them on is a non-goal of this work.

The owner handed the rest of the how to the builder (see "Builder calls").

## How it works today

- **Translation calls:** `frontend/src/i18n/index.js` exposes `useT()` (a hook) and `getT(lang)`. Texts live in `frontend/src/i18n/{pt,en,de,nl}.json` (about 800 keys), and `uiStore.lang` holds the current language.
- **Already translated:** 24 operator screens use `useT()`. Examples are Settings, shared components, Calendar, Customers, Financial (parts) and Messages.
- **Still hard-coded:** about 1,000 Portuguese texts are written straight into JSX or strings, across about 127 files. This was measured on 2026-11-22. The largest are:
  - `pages/Automations.jsx`, `components/units/forms/TourForm.jsx`;
  - `pages/PageEditor.jsx`, `pages/MenuDigital.jsx`, `pages/Groups.jsx`;
  - `pages/financial/ObrigacoesTab.jsx`, `pages/Partners.jsx`, `pages/StaffDetail.jsx`;
  - `components/units/forms/RentacarVehicleForm.jsx`, `pages/Affiliates.jsx`, `pages/StaffPortal.jsx`;
  - `components/automations/AutomationForm.jsx`, `components/units/forms/RestaurantTableForm.jsx`, `hooks/usePlan.js`;
  - `pages/Profile.jsx`, `pages/Vouchers.jsx`, `pages/Analytics.jsx`, `pages/Guides.jsx`;
  - `components/layout/navConfig.js`, `components/layout/Topbar.jsx`.
- **Formatting:** about 111 places format dates and numbers with a fixed `'pt-PT'` locale.
- **Server errors:** the backend returns errors as `{ error: '<Portuguese text>', code: 'SOME_CODE' }`, with about 80 distinct codes. About 64 places in the frontend show `err.response.data.error` directly, so an English operator sees Portuguese error messages.
- **Accents test:** `__tests__/acentosPainelOperador.test.js` (with the shared detector in `__tests__/helpers/detectorAcentos.js`) keeps Portuguese texts accented. Translated texts move into `pt.json`, which that test also checks.

## Goals

1. **Every operator-facing screen and message is translated.** In English mode, an operator sees no Portuguese text on any operator screen. This covers the layout shell (menu, top bar, command palette), the dashboard, reservations, calendar and units, plus customers, marketing, automations and the beach seller. It also covers staff, the staff portal, fleet, maintenance, finance, analytics, profile and the affiliate portal.
   - The texts come from the translation files through `useT()` / `getT()`.
   - PT, EN, DE and NL are filled for every key, and the parity test stays green.
2. **Dates and numbers follow the language.** All operator-side date, month and number formatting uses the current language's locale:
   - PT: `pt-PT`;
   - EN: `en-GB`;
   - DE: `de-DE`;
   - NL: `nl-NL`.

   This goes through one shared helper, not 111 local choices. Currency symbols and amounts are unchanged.
3. **Server errors in the operator's language.** The frontend translates a server error by its `code` when the translation files have it (`errors.<CODE>`), and falls back to the server's text when they do not. This goes through one shared helper used by the places that show server errors.
   - The backend is not changed in this work.
   - Unknown codes keep today's behaviour.
4. **It never comes back.** A test fails when a hard-coded Portuguese text appears in an operator file that has been converted. Converted files are listed, and the list grows phase by phase until it covers the whole panel. The final phase switches the test to "every operator file except an explicit, justified allowlist".

## Phases (each shipped on its own)

1. **Shell and dashboard:**
   - `components/layout/*` (navConfig, Topbar, sidebar, MoreDrawer, CommandPalette);
   - `hooks/usePlan.js` (plan feature texts);
   - `components/dashboard/*`;
   - the shared date/number helper (Goal 2);
   - the server-error helper (Goal 3);
   - the guard test (Goal 4).
2. **Reservations and units:**
   - `pages/reservations/*` and `components/reservations/*`;
   - `pages/BeachSale.jsx`, `pages/BeachSeller.jsx`;
   - `components/units/**` (the forms, editors, options/surcharge/offers editors, meeting point) and `pages/Units.jsx`.
3. **Customers, sales and communication:**
   - `pages/Automations.jsx`, `components/automations/*`;
   - `pages/Feedback.jsx`, `pages/Loyalty.jsx`, `pages/Vouchers.jsx`;
   - `pages/Affiliates.jsx`, `pages/AffiliatePortal.jsx`, `pages/Partners.jsx`;
   - `pages/Packages.jsx`, `pages/Groups.jsx`;
   - `pages/marketing/*`, `pages/PageEditor.jsx`, `pages/MenuDigital.jsx`;
   - `pages/Reviews.jsx`, `pages/Messages.jsx`, the rest of CRM.
4. **Operations, staff and finance:**
   - staff: `pages/staff/*`, `pages/StaffDetail.jsx`, `pages/StaffPortal.jsx`, RH, `pages/Guides.jsx`;
   - operations: `pages/Fleet.jsx`, `pages/Maintenance.jsx`, `pages/Occurrences.jsx`, `pages/Weather.jsx`;
   - finance: `pages/financial/*`, `pages/Analytics.jsx`, `pages/Demand.jsx`;
   - account: `pages/Profile.jsx`, billing pages, `pages/Register.jsx`, onboarding;
   - anything left. The guard test becomes "the whole panel".

## Non-goals

- Turning on DE/NL in the switch.
- The founder's panel (`pages/admin/*`). Only the owner uses it.
- The public pages and the traveller area. They are already bilingual.
- Backend changes: server texts, emails and WhatsApp messages sent to operators stay Portuguese. An operator-language preference on the server is not added.
- Content the operator writes or sends to customers is not translated. This covers default message templates (automations, review request, chat auto-reply), unit names and descriptions. Their PT defaults stay as defaults.
- Stored values. Categories, statuses, roles, difficulty and maintenance types that are stored or compared keep their stored Portuguese values. Only their labels are translated. This is the lesson from the accents work, where the stored values `Facil`, `Manutencao` and `Guia Turistico Certificado` had to be put back.

## Anti-goals

- **Changing a stored or compared value** while translating its label.
- **Breaking Portuguese:** the PT screens must read exactly as today, with accents, after each phase.
- **A key without all four languages,** or an empty text.
- **Machine-garbled English.** Texts are written by hand in plain operator language, consistent across screens: one term per concept, e.g. "Booking" (not "Reservation" in one place and "Booking" in another), "Unit", "Guest".

## Constraints

- **App:**
  - React 18, vitest; `components/ui/*` never changes.
  - Keys are grouped by area (e.g. `nav.*`, `units.*`, `automations.*`), following the existing structure of `pt.json`.
  - Comments stay without accents (codebase style).
  - Keep each file's line endings.
- **Tests:**
  - the parity test;
  - the accents test (PT values);
  - the guard test (Goal 4);
  - the existing tests, updated only where they assert a text that moved into the translation files. They should then read the PT value, so PT behaviour is still pinned.
  - Each phase adds at least one EN render test per main screen it converts.
- **Deploy:** each phase is frontend-only and ships as its own deploy with the usual app backup.

## Approaches considered

- **(a) Move texts into the existing translation files, phase by phase, with a guard test (chosen).** It is the mechanism the app already uses, needs no new library, and each phase is shippable and reviewable.
- **(b) Adopt an i18n library (react-i18next) and auto-extract strings.** Rejected. It means a second mechanism next to `useT()`, a migration of the 800 existing keys, and extraction tools that do not handle mixed PT code with stored values safely.
- **(c) Translate only the top screens and leave the rest Portuguese.** Rejected. An English operator would still hit Portuguese in everyday screens (units, automations, finance). The guard test could not hold either.

## Builder calls (made by me; the owner can overrule)

- **Server errors are translated in the frontend by `code`.** Backend messages stay Portuguese, and unknown codes fall back to the server text.
- **Dates and numbers follow the language** through one helper.
- **DE and NL texts are written by the builder,** because the switch does not show them yet. They are reviewed for consistency, not by a native speaker.
- **Four phases, in the order above.** The shell goes first, because every screen shows it.
- **The founder's panel stays Portuguese.**

## Owner answer to the builder check (2026-11-22)

**`components/ui/*`: minimal change allowed, only for this.** The owner's standing rule is that these components never change. The owner makes one exception: `ConfirmDialog.jsx` ("Cancelar" and the default "Confirmar"), `Modal.jsx` and `Toast.jsx` (`aria-label="Fechar"`) may show those texts in the panel language.
- Nothing else in those components changes: no look, behaviour or other props.
- The cleanest form is optional props with today's PT text as the default, filled by callers or by `useT()`, so every existing use stays identical in PT.
- After this work, the standing rule applies again.

## Builder-check rulings (2026-11-22, my calls)

1. **Screens outside the main layout get the language switch.** The beach seller (`/vendedor/*`), the staff portal (`/staff/*`) and the affiliate portal (`/afiliado/:codigo`) get the same `LanguageToggle` in their header. The affiliate portal starts from the browser language (`initialLang`, like the public pages), and the switch then sets `uiStore.lang`. Without this, those screens could never reach English.
2. **Server errors:**
   - In PT, the server's own text is always shown, exactly as today.
   - In EN/DE/NL, the helper shows a translation from `errors.code.<CODE>` when one exists, else the server text.
   - Codes that the backend reuses with many meanings (`NOT_FOUND`, `MISSING_FIELDS`, `INVALID_TRANSITION`, `UNAVAILABLE` and similar) get a plain generic translation, e.g. "Not found", "Some required fields are missing". Codes with one meaning get a specific translation.
   - Responses without a code keep the server text.
   - The new keys go under `errors.code.*`, so they do not clash with the existing `errors.generic` / `errors.network`.
   - Accepted cost: an English operator sometimes sees a generic message where Portuguese has detail. Making every backend message specific is a backend task, outside this work.
3. **Money follows the language too.** In EN an amount reads "€1,234" (PT keeps "€1 234"), through the same helper as dates and numbers. Tests that pin the pt-PT form keep doing so in PT and gain an EN case where they render money.
4. **Exports and printouts follow the panel language.** This covers the PDF report ("Gerado em…"), the customers CSV headers, the QR code tab and the explanations in the fiscal obligations tab.
   - Official Cape Verdean names (tax, form and institution names such as INPS, IUR, DNRE) stay as they are in every language.
   - A CSV header that another tool reads back is not translated. Check for readers before changing one.
5. **Date and number calls in scope:** only display formatting on operator screens.
   - The `en-CA` calls that build `YYYY-MM-DD` keys stay exactly as they are.
   - Public, traveller and `services/weatherService.js` formatting is out of scope.
   - Bare `toLocaleString()` calls on operator screens move to the helper.

## Left to the builder

- Exact key names and grouping inside each area.
- The English glossary (Booking, Unit, Guest, Operator, Voucher…). Write it once in phase 1 and follow it after.
- The form of the guard test's converted-files list.

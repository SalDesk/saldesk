# Operator panel in English — Phase 1 (foundations and shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundations that phases 2–4 reuse, and finish translating the panel shell. The foundations are:
- language-aware date, number and money formatting;
- translated server errors;
- the three `components/ui` texts;
- a guard test against hard-coded Portuguese.

The shell is the menu, top bar, command palette, layout and plan texts.

**Architecture:**
- Two small utils: `utils/formatoLingua.js` and `utils/mensagemErro.js`. Both read the current language from `uiStore` when no language is passed.
- The existing `useT()` / translation files carry the texts.
- A guard test reuses the accents detector's visible-text extraction and fails on Portuguese text in a growing list of converted files.

**Tech Stack:** React 18, vitest, existing `frontend/src/i18n` (pt/en/de/nl json).

**Spec:** `docs/superpowers/specs/2026-11-22-painel-ingles-design.md`. Its "Owner answer" and "Builder-check rulings" sections are binding.

## Global Constraints

- **Four languages for every new key:** PT, EN, DE, NL. `__tests__/i18nParity.test.js` stays green: same keys, no empty texts, same `{placeholders}` (the interpolation syntax is `{{name}}`).
- **PT must read exactly as today,** with accents (`__tests__/acentosPainelOperador.test.js` checks `pt.json`). Existing tests that assert a PT text keep asserting the same PT text.
- **Stored or compared values never change.** Only labels are translated. Examples of values that must keep their exact Portuguese: payment-method and status keys, categories, roles, difficulty (`Facil`), maintenance types.
- **Locales:**

  | Language | Locale |
  |---|---|
  | pt | `pt-PT` |
  | en | `en-GB` |
  | de | `de-DE` |
  | nl | `nl-NL` |

  Calls that build `YYYY-MM-DD` keys (`en-CA`) stay untouched. Public, traveller and `services/weatherService.js` formatting is out of scope.
- **Money:** PT reads `€1 234` / `1 234 CVE` exactly as today; EN reads `€1,234` / `1,234 CVE`. Currency symbols and rounding are unchanged.
- **Server errors:**
  - PT always shows the server's own text.
  - EN/DE/NL show `errors.code.<CODE>` when present, otherwise the server text.
  - Codes reused with many meanings get a generic translation; codes with one meaning get a specific one.
  - A response without a code shows the server text.
  - No network response: `errors.network`. Nothing usable: the caller's fallback, else `errors.generic`.
- **`components/ui/*`:** only `ConfirmDialog.jsx` ("Cancelar", default "Confirmar"), `Modal.jsx` and `Toast.jsx` (`aria-label="Fechar"`) may change, and only so those texts follow the language. PT output must stay identical, and nothing else in those files changes.
- **Out of scope:** the founder's panel (`pages/admin/*`, `components/layout/AdminLayout.jsx`). The backend is unchanged.
- **English glossary** (written in Task 4, followed everywhere): Booking, Unit, Guest, Customer, Operator, Voucher, Affiliate, Staff, Dashboard, Settings, Automations, Integrations, Fleet, Plan.
- **Code style:**
  - comments in Portuguese without accents;
  - keep each file's line endings (CRLF in many; use the Edit tool or a Python script that preserves `\r\n`);
  - no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Commands:**
  - `cd frontend && npx vitest run <file>`;
  - full suite `cd frontend && npx vitest run`;
  - build `cd frontend && npm run build`.

## Review Focus

1. **A PT screen that changes text or format.** Any rendered PT string or PT-formatted amount or date differing from today is a regression. Tests: each task pins its PT output alongside EN.
2. **A server error in PT that loses its detail** (e.g. "Unidade não encontrada" becoming a generic "Não encontrado"). Test: Task 3 "pt mostra sempre o texto do servidor".
3. **A key present in PT/EN but missing or empty in DE/NL.** Test: the parity test, run in every task.
4. **The language switch not re-rendering a formatted value.** For example, the dashboard amount stays "€1 234" after switching to EN. Test: Task 1 "muda de lingua e o valor muda".
5. **The guard test passing vacuously,** e.g. a file listed but its text hidden behind a template, or a file with only `t()` keys flagged. Tests: Task 4 detector self-tests.

---

### Task 1: Language-aware formatting

**Files:**
- Create: `frontend/src/utils/formatoLingua.js`
- Modify:
  - `frontend/src/pages/financial/shared.jsx`: `fmtDate`, `fmtMoney`, `fmtEixo`, `fmtDica` use the util;
  - `frontend/src/components/financial/KpiCard.jsx` (its local `fmtMoney`);
  - `frontend/src/components/dashboard/HeroCard.jsx`;
  - every `toLocaleDateString` / `toLocaleString` / `Intl.*` display call in `components/layout/*` and `components/dashboard/*`, except `en-CA` key builders.
- Test: `frontend/src/__tests__/formatoLingua.test.js`, plus extend the existing dashboard/financial tests that pin money with an EN case.

**Interfaces:**
- Produces (`utils/formatoLingua.js`):
  - `LOCALES = { pt: 'pt-PT', en: 'en-GB', de: 'de-DE', nl: 'nl-NL' }`.
  - `linguaActual() -> 'pt'|'en'|'de'|'nl'`: from `useUiStore.getState().lang`, defaulting to `'pt'`.
  - `localeDe(lang = linguaActual()) -> string`.
  - `formatarNumero(n, opcoes = {}, lang = linguaActual()) -> string`: `Number(n).toLocaleString(localeDe(lang), opcoes)`.
  - `formatarData(valor, opcoes = {}, lang = linguaActual()) -> string`: accepts a Date or a date string. A `YYYY-MM-DD` string is read as a local date (no UTC shift). Uses `toLocaleDateString(localeDe(lang), opcoes)`.
- Components that show formatted values must re-render on a language change: subscribe to `uiStore.lang` (or `useT()`) where they don't already.

- [ ] **Step 1: Write the failing tests:**
  - `formatarNumero(1234, {}, 'pt') === (1234).toLocaleString('pt-PT')` and `formatarNumero(1234, {}, 'en') === '1,234'`.
  - `formatarData('2026-12-05', { day:'numeric', month:'short' }, 'en')` contains `Dec`. The `'pt'` result contains `dez`, and the day is 5 (no UTC shift).
  - `fmtMoney(1234.4)` in PT equals today's output (`'€' + (1234).toLocaleString('pt-PT')`). In EN it is `'€1,234'`, and `fmtMoney(10, 'CVE')` in EN is `'1,100 CVE'`.
  - `linguaActual()` falls back to `'pt'` for an unknown language.
  - "muda de lingua e o valor muda": render the HeroCard (or KpiCard) with an amount, switch `uiStore` to `'en'`, and the text becomes `€1,234`.
- [ ] **Step 2: Run them and see them fail.** Run `cd frontend && npx vitest run formatoLingua`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the util and convert the listed calls.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS. Existing PT money and date assertions are unchanged.
- [ ] **Step 5: Commit.** Message: `feat: datas, numeros e valores do painel seguem a lingua`.

### Task 2: `components/ui` texts follow the language

**Files:**
- Modify:
  - `frontend/src/components/ui/ConfirmDialog.jsx`: "Cancelar" and the default `labelConfirmar` come from `useT()` (`common.cancel`, `common.confirm`). An explicit `labelConfirmar` prop still wins.
  - `frontend/src/components/ui/Modal.jsx` and `Toast.jsx`: `aria-label` from `t('common.close')`.
- Modify: `frontend/src/i18n/{pt,en,de,nl}.json`. Add `common.close`: PT "Fechar", EN "Close", DE "Schließen", NL "Sluiten".
- Test: `frontend/src/__tests__/uiTextosLingua.test.jsx`

**Interfaces:**
- Consumes: `useT()` from `frontend/src/i18n`.

- [ ] **Step 1: Write the failing tests:**
  - in PT, ConfirmDialog shows "Cancelar" and "Confirmar", and Modal/Toast close buttons have `aria-label="Fechar"` (identical to today);
  - in EN, "Cancel", "Confirm" and `aria-label="Close"`;
  - an explicit `labelConfirmar="Eliminar"` still shows "Eliminar" in both languages.
- [ ] **Step 2: Run them and see them fail.** Run `cd frontend && npx vitest run uiTextosLingua`. Expected: FAIL (EN cases).
- [ ] **Step 3: Implement** it. No other change in those three files.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: botoes de confirmar, cancelar e fechar seguem a lingua do painel`.

### Task 3: Server errors in the operator's language

**Files:**
- Create: `frontend/src/utils/mensagemErro.js`
- Modify: `frontend/src/i18n/{pt,en,de,nl}.json`. Add `errors.code.<CODE>` for every code the backend sends:
  - get the list with `grep -rhoE "code: '[A-Z_]+'" backend/src --include=*.js` (excluding tests); there are 107 codes;
  - PT values are a short generic Portuguese text (only used for parity; PT never reads them);
  - codes reused for many situations (`NOT_FOUND`, `MISSING_FIELDS`, `INVALID_TRANSITION`, `UNAVAILABLE`, `VALIDATION_ERROR`, `FORBIDDEN` and any other used with more than one distinct message) get a generic text, e.g. EN "Not found." / "Some required fields are missing." / "This change is not allowed in the current state.";
  - single-meaning codes get a specific text, e.g. `HOLD_EXPIRED`, `ALREADY_PAID`, `INVALID_VOUCHER`, `OPTION_REQUIRED`, `MIN_ADULTS`, `CAPACITY_EXCEEDED`.
- Modify: the operator-side places that show a server error, i.e. the 27 files outside `pages/admin`, the traveller area and the public pages that read `err.response?.data?.error` (or `.response.data.error` / `data?.error`). They show `mensagemErro(err, t, fallback)` instead.
- Test: `frontend/src/__tests__/mensagemErro.test.js`, plus one existing screen test per kind (toast and inline) with an EN case.

**Interfaces:**
- Produces: `mensagemErro(err, t, fallback?, lang = linguaActual()) -> string`.
  - `err` is an axios error, or a `{ error, code }` object, or a thrown `Error`.
  - The rules are exactly those in Global Constraints "Server errors".

- [ ] **Step 1: Write the failing tests:**
  - "pt mostra sempre o texto do servidor": `{response:{data:{error:'Unidade não encontrada', code:'NOT_FOUND'}}}` in PT gives 'Unidade não encontrada'.
  - The same in EN gives `t('errors.code.NOT_FOUND')` ('Not found.').
  - An EN response with an unknown code `'XPTO'` gives the server text.
  - An EN response without a code gives the server text.
  - No `response` (network) gives `errors.network` in both languages.
  - An empty error with fallback 'Falhou' gives 'Falhou'; without a fallback it gives `errors.generic`.
  - Every code found in the backend exists under `errors.code` (the test reads `backend/src` with fs and compares).
- [ ] **Step 2: Run them and see them fail.** Run `cd frontend && npx vitest run mensagemErro`. Expected: FAIL.
- [ ] **Step 3: Implement** the helper and the keys, then convert the 27 files.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite (existing PT error assertions unchanged). Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: erros do servidor traduzidos pelo codigo no painel em ingles`.

### Task 4: Guard test, glossary and the panel shell

**Files:**
- Create: `frontend/src/__tests__/painelSemPortuguesFixo.test.js` (the guard).
- Create: `docs/glossario-ingles-painel.md`, the glossary from Global Constraints with one line of usage each.
- Modify (translate every visible text through `useT()` / `getT()`, with new keys in all four json files):
  - `frontend/src/components/layout/navConfig.js` (menu labels). It is a plain module, so it either stores keys and the components translate them, or exposes a function that takes `t`.
  - `Topbar.jsx`, `Sidebar.jsx`, `BottomNav.jsx`, `MoreDrawer.jsx`, `CommandPalette.jsx`, `Layout.jsx`, `PageHeader.jsx`.
  - `frontend/src/hooks/usePlan.js` (`FEATURE_DESCRIPTIONS` and any plan texts; the feature keys stay as they are).
  - `frontend/src/components/dashboard/*` (any remaining text).

**Interfaces:**
- Produces: the guard test's exported or inline list `FICHEIROS_CONVERTIDOS` (paths relative to `frontend/src`). It holds the files above plus every file already fully on `useT()` that the guard finds clean. Phases 2–4 append to it.
- Produces: the guard detector. It reuses `semComentarios` / `trechosVisiveis` (or `textosVisiveis`) and `pareceCodigo` from `__tests__/helpers/detectorAcentos.js`.
  - It flags a visible text containing Portuguese: an accented letter, or a word from a short list of unmistakably Portuguese words (`de`, `do`, `da`, `para`, `com`, `não`, `sem`, `uma`, `os`, `as`, `ao`, `em`, `no`, `na`, `por`, `que`, `ou`, `Guardar`, `Cancelar`, `Eliminar`, `Editar`, `Novo`, `Nova`, `Adicionar`, `Fechar`, `Pesquisar`, `Reservas`, `Clientes`, `Unidades`).
  - It ignores i18n keys, code fragments, brand names (SalDesk, PayPal, SISP, Vinti4, Viator, GetYourGuide, WhatsApp, Booking.com, Airbnb) and the stored values listed in a per-file allowlist with a reason.

- [ ] **Step 1: Write the failing tests:**
  - **Detector self-tests:**
    - `"<p>Guardar alterações</p>"` is flagged;
    - `"t('nav.dashboard')"` is not flagged;
    - `"className='bg-ocean-50'"` is not flagged;
    - `"'SalDesk'"` is not flagged;
    - a value in the allowlist is not flagged.
  - **Guard:** every file in `FICHEIROS_CONVERTIDOS` has no flagged text (fails now for the shell files).
  - **EN render tests:**
    - Topbar and Sidebar in EN show "Bookings", "Customers", "Settings" (whatever the glossary terms are) and no Portuguese menu label;
    - in PT they show today's labels exactly;
    - CommandPalette in EN finds "Bookings".
- [ ] **Step 2: Run them and see them fail.** Run `cd frontend && npx vitest run painelSemPortuguesFixo Topbar Sidebar`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite, then the build. Expected: PASS, build OK.
- [ ] **Step 5: Commit.** Message: `feat: menu, barra de topo e textos dos planos em ingles; teste contra portugues fixo`.

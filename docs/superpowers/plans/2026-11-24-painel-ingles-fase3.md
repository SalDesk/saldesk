# Operator panel in English — Phase 3 (customers, sales, communication, and the whole-panel guard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the last operator screens into English, keeping DE and NL in step:
- customers, automations, feedback and reviews;
- messages, chats and orders;
- vouchers, loyalty, packages, groups and partners;
- affiliates, the affiliate portal and marketing;
- the page editor and the digital menu.

Then switch the guard test to "every operator file except an explicit, justified list".

**Architecture:**
- Reuse the foundations of phases 1, 2 and 4:
  - `useT()` / `getT()`;
  - `utils/formatoLingua.js`;
  - `utils/mensagemErro.js`;
  - `utils/rotuloMes.js`;
  - the label helpers keyed by stored value, for example `pages/reservations/shared.jsx` and `components/units/rotulosUnidades.js`;
  - the glossary;
  - the guard `__tests__/painelSemPortuguesFixo.test.js` with its `PERMITIDOS` list;
  - `components/shared/LanguageToggle.jsx`.
- Tasks 1-5 each convert one area, add its files to `FICHEIROS_CONVERTIDOS`, and pin PT next to EN.
- Task 6 replaces the list with a walk of the whole `src` tree and a short, justified exclusion list. This is spec Goal 4's final step; phase 3 is the last phase executed.

**Tech Stack:** React 18, vitest, existing `frontend/src/i18n` (pt/en/de/nl json).

**Spec:** `docs/superpowers/specs/2026-11-22-painel-ingles-design.md`. Its "Non-goals", "Owner answer" and "Builder-check rulings" sections are binding, in particular:
- ruling 1: the affiliate portal (`/afiliado/:codigo`) gets the `LanguageToggle` and starts from the browser language (`utils/initialLang.js`, as the public pages do). The switch then sets `uiStore.lang`.
- ruling 4: printouts and exports (the customers CSV headers, the QR code tab) follow the panel language. A CSV header that another tool reads back is not translated; check for readers first.
- Non-goal: content the operator writes or sends to customers is not translated. This includes:
  - default message templates (automations, review request, chat auto-reply);
  - WhatsApp texts sent to a customer;
  - the operator's public page and menu content.

  Phase 2 kept the beach seller's customer WhatsApp texts fixed in PT with `getT('pt')`; follow the same pattern.

## Global Constraints

- **Work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`.** Never touch the old `C:\Users\RITS DELGADO\saldesk` folder.
- **Four languages for every new key:** PT, EN, DE, NL. `i18nParity.test.js` stays green (same keys, no empty texts, same `{{placeholders}}`).
- **PT must read exactly as today,** with accents (`acentosPainelOperador.test.js`). Existing tests asserting PT keep asserting the same PT. Existing PT quirks stay unless they are accent fixes.
- **Stored or compared values never change; only their labels are translated.** Examples in this zone:
  - automation triggers, actions and channels;
  - voucher types and statuses;
  - loyalty tiers and reward types;
  - package and group statuses;
  - partner types and commission modes;
  - affiliate statuses;
  - marketing post statuses and networks;
  - order statuses (`Pedidos.jsx`);
  - customer tags and sources;
  - review sources;
  - `utils/userRoles.js` role values such as `'FUNDADOR'`.
- **Customer-facing content stays PT,** whatever the panel language: message templates and their defaults, WhatsApp and email texts sent to a customer, and texts the operator publishes (page editor content, menu dishes). The editor's own labels, buttons and help texts are translated. When the guard flags a fixed customer text, add a `PERMITIDOS` entry with the reason "mensagem enviada ao cliente, fica em portugues (nao-objectivo da especificacao)".
- **Out of scope:**
  - the founder panel (`pages/admin/*`, `components/layout/AdminLayout.jsx`);
  - public and traveller pages, which are already bilingual by their own `lang`: `PublicBooking`, `ServiceDetail`, `BookingSuccess`, `BookingCancel`, `ReviewPage`, `components/servico/*`, `components/restaurant/RestaurantReservationWidget.jsx`, `components/shared/SiteComplianceFooter.jsx`, `pages/traveler/*`, `components/traveler/*`;
  - their helpers `utils/paginaActividade.js`, `utils/politicaCancelamento.js`, `utils/opcoesActividade.js`, `utils/pessoas.js`;
  - the backend.
- **Formatting:**
  - every display date, number and money call in converted files goes through `formatoLingua.js`;
  - PT keeps today's exact output;
  - no hard-coded `'pt-PT'` remains;
  - `en-CA` `YYYY-MM-DD` key builders stay as they are.
- **Server errors:** shown through `mensagemErro`; PT fallback texts become keys.
- **Glossary:** English follows `docs/glossario-ingles-painel.md` (Booking, Unit, Guest, Customer, Voucher, Affiliate, Automations…). Add new terms one line each, e.g. Loyalty, Reward, Tier, Package, Group booking, Partner, Commission, Campaign, Post, Order.
- **`components/ui/*` must not change.**
- **Code style:**
  - comments in Portuguese without accents;
  - keep each file's line endings (CRLF in many; use the Edit tool or Python preserving `\r\n`);
  - no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `C:\Users\RITS DELGADO\saldesk-recuperacao\frontend`): `npx vitest run <file>`; full suite `npx vitest run`; build `npm run build`.

## Review Focus

1. **A customer-facing text that starts following the panel language.** For example:
   - an automation default template;
   - a review request;
   - a WhatsApp text from `WhatsAppSend`;
   - a voucher or loyalty message sent to a customer.

   Test per task: with the panel in EN, the text sent or saved is the same PT text as with the panel in PT.
2. **A label translated together with its stored value.** For example, an automation saved with an English trigger name, or a voucher status saved as "Active". Test per task: choose in EN and assert the saved value is the stored PT or id value.
3. **PT text or format changed** on any of these screens. Test: each task pins PT next to EN.
4. **The affiliate portal stuck in PT, or ignoring the browser language.** Test: Task 4 opens the portal with an English browser and gets EN, and switches with the toggle.
5. **The whole-panel guard passing by exclusion.** A screen that still has Portuguese could be left out silently. Test: Task 6 asserts every exclusion has a reason and that operator files outside it are scanned.

---

### Task 1: Automations, feedback and reviews

**Files:**
- Modify: `frontend/src/pages/Automations.jsx`, `frontend/src/components/automations/*` (`AutomationForm`, `AutomationCard`), `pages/Feedback.jsx`, `pages/Reviews.jsx`.
- Modify: the i18n json files, the guard list and the glossary.
- Test: extend `Automations.test.jsx`, `Feedback.test.jsx`, `Reviews.test.jsx`.

- [ ] **Step 1: Write the failing tests:**
  - in EN these screens show English labels and no Portuguese, apart from the customer templates; in PT they are unchanged;
  - an automation created in EN saves the stored trigger, action and channel ids, and its default message template is the same PT text as in PT;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Automations Feedback Reviews`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: automacoes, feedback e avaliacoes em ingles`.

### Task 2: Customers, messages, chats and orders

**Files:**
- Modify: `pages/Customers.jsx`, `components/crm/*` (`CustomerDetail` and the rest), `pages/Messages.jsx`, `components/messaging/*` (`WhatsAppSend`, `WhatsAppPendentes`), `components/shared/StaffChat.jsx`, `pages/FounderChat.jsx`, `pages/Pedidos.jsx`.
- Modify: the i18n json files, the guard list and the glossary.
- Test: extend `Customers.test.jsx`, `CustomerDetail.test.jsx`, `Messages.test.jsx`, `StaffChat.test.jsx`, `FounderChat.test.jsx`, `Pedidos.test.jsx`.

- [ ] **Step 1: Write the failing tests:**
  - in EN these screens show English labels and no Portuguese, apart from customer texts; in PT they are unchanged;
  - the customers CSV export has English column headers in EN and today's headers in PT. Before translating, grep for any CSV import that reads them back; if one exists, keep those headers and note it;
  - with the panel in EN, the texts `WhatsAppSend` puts in the wa.me link are the same PT texts as with the panel in PT;
  - changing an order status in EN sends the stored status value;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Customers CustomerDetail Messages StaffChat FounderChat Pedidos`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: clientes, mensagens, chats e pedidos em ingles`.

### Task 3: Vouchers, loyalty, packages, groups and partners

**Files:**
- Modify: `pages/Vouchers.jsx`, `pages/Loyalty.jsx`, `pages/Packages.jsx`, `pages/Groups.jsx`, `pages/Partners.jsx`.
- Modify: the i18n json files, the guard list and the glossary.
- Test: extend `Vouchers.test.jsx`, `Loyalty.test.jsx`, `Packages.test.jsx`, `Groups.test.jsx`, `Partners.test.jsx`.

- [ ] **Step 1: Write the failing tests:**
  - in EN these screens show English labels and no Portuguese; in PT they are unchanged;
  - creating a voucher, a loyalty reward, a package, a group booking and a partner in EN saves the stored type and status values;
  - amounts and dates follow the language (EN `€1,234`; PT as today);
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Vouchers Loyalty Packages Groups Partners`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: vouchers, fidelizacao, pacotes, grupos e parceiros em ingles`.

### Task 4: Affiliates, affiliate portal, marketing and integrations

**Files:**
- Modify: `pages/Affiliates.jsx`, `pages/AffiliatePortal.jsx` (header gets `LanguageToggle`; first render uses `initialLang()` until the toggle is used, spec ruling 1), `pages/Marketing.jsx`, `pages/marketing/*` (`PostModal`, `SocialPlanner`, `StatsTab`, `WidgetTab`, `ReferralsTab`, `QrCodeTab`, `shared.jsx`), `pages/Integrations.jsx`.
- Modify: the i18n json files, the guard list and the glossary.
- Test: extend `Affiliates.test.jsx`, `Marketing.test.jsx`, `MarketingPlanner.test.jsx`, `Integrations.test.jsx`; add an EN render test for `AffiliatePortal`.

- [ ] **Step 1: Write the failing tests:**
  - in EN these screens show English labels and no Portuguese; in PT they are unchanged;
  - the affiliate portal opened with an English browser (`navigator.language = 'en-GB'`, no stored choice) shows EN. With a Portuguese browser it shows PT. The toggle switches it;
  - the QR code tab texts follow the panel language (ruling 4);
  - a marketing post created in EN saves the stored status and network values;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Affiliates AffiliatePortal Marketing MarketingPlanner Integrations`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: afiliados, portal de afiliados, marketing e integracoes em ingles`.

### Task 5: Page editor, digital menu and the remaining small screens

**Files:**
- Modify:
  - `pages/PageEditor.jsx` and `pages/MenuDigital.jsx`: the editor labels only; the operator's page and menu content stays as written;
  - `pages/settings/PerfilPublicoTab.jsx`;
  - `pages/ResetPassword.jsx`, `pages/DemoEntry.jsx`, `pages/ImpersonateCallback.jsx`, `components/ErrorBoundary.jsx`;
  - `services/api.js`: the demo read-only message goes through `getT(linguaActual())`.
- Modify: the guard list, adding these files plus `components/units/rotulosUnidades.js`, which phase 2 left out. Accented map keys there get `PERMITIDOS` entries with reasons.
- Modify: the i18n json files.
- Test: extend `PageEditor.test.jsx`, `MenuDigital.test.jsx`; add EN render tests for `ResetPassword` and `ErrorBoundary`, and a test for the demo read-only message in EN and PT.

- [ ] **Step 1: Write the failing tests:**
  - in EN these screens show English labels and no Portuguese, apart from operator content; in PT they are unchanged;
  - in EN, a menu dish and a page section the operator wrote in PT show exactly as written;
  - the demo read-only message follows the language;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo PageEditor MenuDigital ResetPassword ErrorBoundary`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: editor de pagina, menu digital e ecras restantes em ingles`.

### Task 6: The guard covers the whole panel

**Files:**
- Modify: `frontend/src/__tests__/painelSemPortuguesFixo.test.js`.
- Modify: `docs/glossario-ingles-painel.md`. Add a short note at the end saying the whole panel is covered and where the exclusions live.

**Interfaces:**
- Produces: `EXCLUIDOS` (exported), an object `{ '<path or folder prefix>': '<reason in Portuguese>' }`. It replaces `FICHEIROS_CONVERTIDOS` as the source of truth.
  - **Every `.js`/`.jsx` file under `frontend/src` is scanned** except `__tests__`, test files and the `EXCLUIDOS` entries.
  - **`EXCLUIDOS` holds exactly these entries:** the founder panel, the public and traveller files, and their helpers (the out-of-scope list in Global Constraints); `components/ui/` (never changes, owner rule); `i18n/` (translation files); and `main.jsx`.
  - **Any other entry needs a reason** a reviewer can check.
  - **`PERMITIDOS` stays** for single texts inside scanned files.

- [ ] **Step 1: Write the failing tests:**
  - the guard scans every operator file. A test plants a temporary PT text in a file that is not in `EXCLUIDOS` (in memory, through the guard's scan function, not on disk) and the guard reports it;
  - every `EXCLUIDOS` entry has a non-empty reason and points to an existing path;
  - the hard-coded `'pt-PT'` check also runs on every scanned file (only the `LOCALES` line is allowed);
  - no file under `pages/` or `components/` outside `EXCLUIDOS` is skipped. Assert the scanned set includes, for example, `pages/Dashboard.jsx`, `pages/Settings.jsx` and `pages/Login.jsx`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Files that now fail the wider scan and are operator files get converted in this task if the text is small (a label or two). If one needs more, stop and report it. Do not add it to `EXCLUIDOS` to make the test pass.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and the build. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `test: teste de guarda cobre todo o painel do operador`.

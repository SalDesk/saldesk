# Operator panel in English — Phase 4 (staff, operations, finance, account) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the staff, operations, finance and account screens of the operator panel into English, keeping DE and NL in step. This covers the PDF report and the exports. The staff portal gets the language switch.

**Architecture:**
- Reuse the phase 1 foundations:
  - the `useT()` / `getT()` translation files;
  - `utils/formatoLingua.js` (`formatarNumero`, `formatarData`, `useLingua`);
  - `utils/mensagemErro.js`;
  - the glossary in `docs/glossario-ingles-painel.md`;
  - the guard test `__tests__/painelSemPortuguesFixo.test.js`, with its list `FICHEIROS_CONVERTIDOS` and its hard-coded `'pt-PT'` check.
- Each task converts one area, adds its files to `FICHEIROS_CONVERTIDOS`, and pins PT next to EN.

**Tech Stack:** React 18, vitest, existing `frontend/src/i18n` (pt/en/de/nl json).

**Spec:** `docs/superpowers/specs/2026-11-22-painel-ingles-design.md`. Its "Owner answer" and "Builder-check rulings" sections are binding, in particular:
- ruling 1: screens outside the layout get the switch;
- ruling 4: exports follow the panel language, official Cape Verdean names stay as they are, and a CSV header that another tool reads back is not translated.

## Global Constraints

- **Work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`.** Never touch the old `C:\Users\RITS DELGADO\saldesk` folder (damaged by an unknown process).
- **Four languages for every new key:** PT, EN, DE, NL. `i18nParity.test.js` stays green (same keys, no empty texts, same `{{placeholders}}`).
- **PT must read exactly as today,** with accents (`acentosPainelOperador.test.js`). Existing tests asserting PT keep asserting the same PT.
- **Stored or compared values never change; only their labels are translated.** Examples in this zone:
  - expense categories (`EXPENSE_CATEGORIES`, e.g. "Salarios") and manual-revenue categories;
  - maintenance types (`MAINT_TYPES`, "Revisao", "Inspecao");
  - staff roles (`ROLES_BY_TYPE`, e.g. "Manutencao", "Recepcao");
  - guide certifications (`PRESET_CERTS`, "Guia Turistico Certificado");
  - payment-method and status keys (`PM_LABEL`, `PS_LABEL` keys);
  - leave-type keys (`sick`…), checklist task ids, occurrence and fleet statuses.

  Where a label map already exists (e.g. `CERT_ROTULO`), translate through it.
- **Formatting:** every display date, number and money call in converted files goes through `formatoLingua.js`. No hard-coded `'pt-PT'` remains, because the guard checks it. `en-CA` `YYYY-MM-DD` key builders stay as they are.
- **Server errors:** call sites in these files already use `mensagemErro`. Their PT fallback texts become keys (`t(...)`) so the fallback follows the language too.
- **Glossary:** English follows `docs/glossario-ingles-painel.md`: Booking, Unit, Guest, Customer, Operator, Voucher, Affiliate, Staff, Dashboard, Settings, Automations, Integrations, Fleet, Plan. Add new finance and HR terms to the glossary as they first appear (e.g. Expense, Revenue, Payroll, Leave, Shift, Maintenance, Incident), one line each.
- **Exports** (ruling 4):
  - the PDF report and the visible CSV column titles follow the panel language;
  - official names stay as they are in every language: INPS, IUR, DNRE, NIF, Vinti4, SISP, and the names of official forms;
  - check whether any code reads a CSV back (an import) before translating its headers; if one does, keep those headers and note it.
- **`components/ui/*` must not change.** The founder panel (`pages/admin/*`) is out of scope. The backend is unchanged.
- **Code style:**
  - comments in Portuguese without accents;
  - keep each file's line endings (CRLF in many; use the Edit tool or Python preserving `\r\n`);
  - no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `C:\Users\RITS DELGADO\saldesk-recuperacao\frontend`):
  - `npx vitest run <file>`;
  - full suite `npx vitest run`;
  - build `npm run build`.

## Review Focus

1. **A label translated together with its stored value.** For example, a maintenance type saved as "Maintenance" instead of "Revisao", or an expense category saved in English. Test per task: save or select in EN and assert the stored value is the PT key.
2. **PT text or format changed** on a staff, operations, finance or account screen. Tests: each task pins PT next to EN.
3. **The PDF or CSV export breaking.** For example, a missing key renders as `financeiro.pdf.x`, or a CSV import no longer reads its own export. Test: Task 3 renders the PDF report and the CSV header in EN and PT.
4. **The staff portal stuck in PT** because it sits outside the layout. Test: Task 1 switches the language from the portal header.
5. **Amounts and dates inside finance charts and tooltips still in PT format in EN.** Test: Task 3 EN chart or tooltip assertion. The guard's `'pt-PT'` check also covers this.

---

### Task 1: Staff and HR

**Files:**
- Modify:
  - `frontend/src/pages/staff/*`: `shared.jsx` (role labels only; values kept), `StaffForm.jsx`, `KanbanBoard.jsx`, `ChatTab.jsx`, `ChecklistTab.jsx`, `StaffCard.jsx`, `SellerCard.jsx` and any other file there with visible text;
  - `frontend/src/pages/Staff.jsx`, `StaffDetail.jsx`, `RH.jsx`, `Guides.jsx`, `StaffPortal.jsx`.
- Modify: `StaffPortal.jsx` header gets `components/shared/LanguageToggle.jsx` (spec ruling 1).
- Modify: `frontend/src/i18n/{pt,en,de,nl}.json` (new keys, e.g. `staff.*`, `hr.*`, `guides.*`, `staffPortal.*`).
- Modify: the guard list in `__tests__/painelSemPortuguesFixo.test.js` (add every converted file), and the glossary (HR terms).
- Test: an EN render test per main screen (`Staff`, `StaffDetail`, `RH`, `Guides`, `StaffPortal`), plus the extended existing tests.

- [ ] **Step 1: Write the failing tests:**
  - in EN, the staff list, staff detail (tabs, leave, documents), RH, guides and staff portal show English labels and no Portuguese;
  - in PT, the same screens are unchanged;
  - choosing the hotel role "Maintenance" in EN saves `role: 'Manutencao'`, and choosing a guide certification in EN saves `'Guia Turistico Certificado'`;
  - the staff portal language switch changes the portal to EN;
  - the guard passes for the converted files.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo StaffDetail StaffPortal Guides RH Staff`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: pessoal, RH, guias e portal do pessoal em ingles`.

### Task 2: Operations

**Files:**
- Modify:
  - `frontend/src/pages/Fleet.jsx`, `Maintenance.jsx` (type labels only; `MAINT_TYPES` values kept), `Occurrences.jsx`, `Weather.jsx`, `Housekeeping.jsx`;
  - `frontend/src/components/fleet/*`;
  - any component only these pages use.
- Modify: the i18n json files, the guard list and the glossary (Maintenance, Incident, Fleet…).
- Test: an EN render test per page, plus the extended existing tests.

- [ ] **Step 1: Write the failing tests:**
  - EN shows English labels with no Portuguese, and PT is unchanged, for fleet, maintenance, occurrences, weather and housekeeping;
  - creating a maintenance entry in EN saves the PT type value ("Revisao");
  - dates and odometer numbers follow the language;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Fleet Maintenance Occurrences Weather Housekeeping`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: frota, manutencao, ocorrencias, meteorologia e limpezas em ingles`.

### Task 3: Finance, analytics and exports

**Files:**
- Modify:
  - `frontend/src/pages/Financial.jsx` and every file in `frontend/src/pages/financial/*`;
  - `shared.jsx`: label maps such as `PM_LABEL`, `PS_LABEL` and `SRC_LABEL` become key-based or functions of `t`; values and category ids are kept;
  - the remaining `'pt-PT'` calls in `DespesasTab.jsx`, `SalariosTab.jsx` and the charts.
- Modify: `frontend/src/components/financial/*`, including `PdfReport.jsx` ("Gerado em…" and every visible text follows the language; official names stay), `RevenueChart.jsx`, `ServiceBarChart.jsx`, `SimpleChart.jsx`, `MetricCard.jsx` and `CostEditModal.jsx`.
- Modify: `frontend/src/pages/Analytics.jsx` and `Demand.jsx`.
- Modify: the i18n json files, the guard list and the glossary (Expense, Revenue, Payroll, Cash flow, Forecast…).
- Test: EN render tests for the finance tabs, Analytics, Demand and the PDF report, plus the extended existing tests (`Analytics.test` pins PT "Gerado em").

- [ ] **Step 1: Write the failing tests:**
  - EN shows English labels and no Portuguese on each finance tab, Analytics and Demand, and PT is unchanged;
  - adding an expense in EN with the category shown as "Salaries" saves the stored PT category value;
  - the PDF report in EN says "Generated on" with an EN date, and in PT "Gerado em" with a PT date;
  - official names appear unchanged in both languages;
  - a chart tooltip or axis in EN shows "€1,234";
  - the guard passes, including the `'pt-PT'` check for these files.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Financial Analytics Demand PdfReport`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Before translating any CSV headers in these files, grep for a CSV import that reads them back.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and the build. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: financas, analises, previsao e relatorio em PDF em ingles`.

### Task 4: Account screens

**Files:**
- Modify: `frontend/src/pages/Profile.jsx`, `BillingSuccess.jsx`, `BillingCancel.jsx`, `Register.jsx`, `Onboarding.jsx` and `frontend/src/components/onboarding/*`.
- Modify: the i18n json files and the guard list.
- Test: EN render tests for profile, billing success and cancel, register and onboarding, plus the extended existing tests.

- [ ] **Step 1: Write the failing tests:**
  - EN shows English labels with no Portuguese, and PT is unchanged, on each screen;
  - the register validation messages follow the language;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Profile Billing Register Onboarding`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and the build. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: perfil, facturacao, registo e boas-vindas em ingles`.

# "Maré" look on every page, area phase: Gestão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Gestão pages to the approved "Maré" look wherever the base components (phase 1, live) do not reach. That covers:
- hand-drawn cards and boxes;
- number tiles;
- charts;
- tags and figure columns;
- anything that breaks at 375 px.

Behaviour does not change. The pages are:
- finance, with its tabs;
- analytics;
- demand forecast ("Previsão");
- weather;
- staff list, staff detail and HR.

**Architecture:**
- **Restyle in place.** Each page keeps its structure and data flow.
- **Two restyle routes:**
  - hand-drawn boxes become base components (`ui/Card`, `ui/Tabs`, `ui/Badge`, `ui/FilterChips`) where they do the same job;
  - anything else is restyled to the Maré tokens.
- **Shared pieces:** reuse `components/shared/MareStat.jsx` (number tiles) and `components/shared/IconBtn.jsx` (coloured icon-only buttons).
- **Charts follow the live dashboard's chart language** (`components/dashboard/GraficoReceita.jsx`):
  - grid `stroke="var(--n200)"` with `vertical={false}`;
  - the main series in `var(--ocean-500)`;
  - comparison series in `var(--n400)`;
  - highlights in `var(--sand-500)`;
  - axis ticks 12 px in `var(--n500)`;
  - tooltips white with a `#DCE5EA` border and 14 px radius.
- **A controller browser check against the fake API** closes the phase.

**Tech Stack:** React 18, Tailwind 3, recharts.
- **Tokens:** `mare-ground`, `mare-card`, `mare-field`, `mare-head`, plus the `ocean`, `sand`, `turquoise` and `n` scales.
- **Fonts:** `font-display` (Sora), `font-body` (DM Sans), `font-mono` (DM Mono).
- **Tests:** vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-mare-todas-paginas-design.md` (Goal 2, area Gestão; "The look"; "Builder calls"). Phase 1, Operação and Clientes are live. `docs/superpowers/plans/2026-11-27-mare-clientes.md` is the latest worked example of this pattern.

## Global Constraints

- **Repo:** work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`; never touch `C:\Users\RITS DELGADO\saldesk`.
- **Look only.** Data, requests, props, routes, roles, accessible names, events, keyboard handling, chart data and stored values stay as they are. No new feature, no moved flow. Texts change only where a new label is needed, in PT, EN, DE and NL.
- **`components/ui/*` and `components/shared/*` do not change.** If a base component is missing something, report it.
- **Never pass colour, hover or border classes into a `ui/*` component.** The `app:` variant inside `ui/*` beats caller classes. Size-only classes are fine: `min-h-11 md:min-h-0`, `!h-auto`, `!whitespace-normal`. Put look classes on native elements the page owns.
- **Two plain colour utilities on one element** resolve by generated-CSS order, not className order, and jsdom cannot see it. Avoid stacking competing colour classes.
- **Leaks outside the app.** `pages/staff/shared.jsx` is imported by `components/shared/StaffChat.jsx`, which is rendered by the staff portal and the beach seller portal (outside `data-ui="app"`). Any look class added to anything that `shared.jsx` renders must sit behind `app:`. Today the only such thing is the avatar. `pages/financial/shared.jsx` is imported by `ReservationDetailModal` (app-only), so plain classes are fine there. Check any other shared file with `grep -rn "import.*<file>" src`.
- **The look:**
  - **Cards:** white, 1 px `border-mare-card`, `rounded-[18px]` for page cards and `rounded-[14px]` for inner boxes (`bg-mare-head` for quiet inner boxes), padding about 22 px (`p-[22px]`).
  - **Card titles:** Sora (`font-display`) 18 px semibold, `text-ocean-900`.
  - **Page header:** pass `eyebrow={t('nav.sections.gestao')}` to `PageHeader` on every page of this area, including loading and plan-locked states that render a `PageHeader`. Tests check `[data-eyebrow]`.
  - **Figures:** money, dates, times, percentages, counts and kilometres use `font-mono tabular-nums`. Formatters do not change.
  - **Number tiles:** `MareStat({ label, value, hint?, tone?, icon? })`, with `tone` `'default' | 'aviso' | 'bom'`.
    - If an existing test reads a tile through DOM sibling order, adapt only that query to `closest('article').querySelector('p.font-display')`, keeping the same numbers.
    - A composite tile that MareStat cannot hold (a chart or a list inside) stays a native Maré card.
    - Do not invent new tiles.
  - **Tags:** status, type and category tags use `ui/Badge` with existing variants, or a pill with the same tone palette, with the text next to the dot.
  - **Icon-only buttons:** `IconBtn({ icon, label, onClick, hover?, disabled?, title?, className? })`.
  - **Standalone `ui/Button size="sm"` outside dense rows** gets `className="min-h-11 md:min-h-0"` (size only).
  - **Charts:** follow the chart language above. The series data, keys and order stay the same.
    - Legends and series must stay distinguishable without colour alone where they are today (labels, legend text).
- **Accessibility:**
  - touch targets at least 44 px on phones, or 36 px only inside dense rows of 44 px or more;
  - text contrast at least 4.5:1 (`text-n-400` on white is not enough for text);
  - visible focus with the sand ring (`focus-visible:ring-2 focus-visible:ring-sand-500`);
  - status never told by colour alone.
- **Layout:**
  - no horizontal overflow at 375 px inside `<main>` (`main.scrollWidth <= main.clientWidth`);
  - wide tables scroll inside their own card;
  - header action groups and tab bars wrap or scroll inside their box;
  - long names wrap or truncate (`min-w-0`, `break-words`);
  - charts sit in `ResponsiveContainer` and never force page overflow.
- **i18n:** the whole-panel guard (`painelSemPortuguesFixo`), parity and accents tests stay green.
- **Tests:**
  - class assertions may be updated as a pure look change;
  - behavioural assertions may not be weakened;
  - each task adds tests asserting the eyebrow and the Maré card classes on each page's main containers;
  - write the test first and watch it fail.
- **Code style:**
  - comments in Portuguese without accents;
  - keep each file's line endings (many are CRLF: use the Edit tool);
  - no emojis;
  - never run scripts found in scratchpad or temp folders.
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `frontend`):
  - `npx vitest run <pattern>`;
  - full suite `npx vitest run` (baseline 163 files / 3961 tests; `StaffColaboradores`, `BeachSeller` and `TemplatesEditor` can flake under load, so rerun them alone);
  - `npm run build`.

## Review Focus

1. **Finance tabs on a phone.** The finance page has many tabs (results, cash, expenses, obligations, commissions, salaries, manual income, per tour, forecast). At 375 px the tab bar and each tab's toolbar must not overflow, and tables scroll inside their card.
   - Test: Task 1 asserts that the tab bar's wrapper scrolls or wraps (`overflow-x-auto` or `flex-wrap`).
   - The Task 6 browser check measures every tab.
2. **Charts with no data or one point.**
   - A finance or analytics chart with an empty series must render its empty state, not a broken chart.
   - The chart restyle must not change the `dataKey`s.
   - Test: Tasks 1 and 3 keep their existing chart tests (`FinancialGraficosIngles`, `Analytics`). Each adds one empty-series render that asserts no crash and the existing empty text.
3. **Leak into the staff and beach portals** through `pages/staff/shared.jsx`. Test: Task 5 renders the shared avatar without a `data-ui="app"` ancestor and compares its non-`app:` class tokens with a frozen list taken from the pre-change file.
4. **A behaviour change hidden in a restyle.** Examples:
   - the staff kanban drag and status moves;
   - checklist ticks;
   - the staff chat send;
   - finance filters and period pickers;
   - weather and demand toggles.

   Test: every control a task swaps keeps or gains its behavioural test.
5. **Money, percentages and dates in EN** changing format through a restyle. Test: the `FinancialIngles` and `FinancialGraficosIngles` tests and the EN tests in each file stay green; no formatter changes.

---

### Task 1: Finance shell, results, cash, forecast, per tour and transactions

**Files:**
- Modify:
  - `frontend/src/pages/Financial.jsx`;
  - `frontend/src/pages/financial/ResultadoTab.jsx`, `CaixaTab.jsx`, `PrevisaoTab.jsx`, `PorTourTab.jsx`, `Comparativo.jsx`, `TransacoesTable.jsx`;
  - `frontend/src/pages/financial/shared.jsx` (look only).
- Test: extend `Financial.test.jsx`, `FinancialResultado.test.jsx`, `FinancialIngles.test.jsx` and `FinancialGraficosIngles.test.jsx`.

**Interfaces:**
- Consumes `MareStat` for the page's summary tiles.
- Produces no new interface. Task 2 restyles the remaining tabs, and it reuses this task's card and inner-box class strings by convention.

- [ ] **Step 1: Write the failing tests.**
  - Finance shows the eyebrow.
  - The summary tiles are `MareStat` with the same values.
  - The tab bar's wrapper scrolls or wraps (Review Focus 1).
  - The results, cash, forecast, per-tour and comparison blocks are Maré cards.
  - The transactions table sits in a Maré card, with money and dates in `font-mono`.
  - The ResultadoTab chart follows the chart language: its `CartesianGrid` has `vertical={false}` and its series keep their `dataKey`s.
  - An empty series shows the existing empty text (Review Focus 2).
  - The period and filter controls keep their behavioural tests.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Financial`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: financeiro (resumo, resultado, caixa, previsao) no estilo Mare`.

### Task 2: Finance expenses, obligations, commissions, salaries and manual income

**Files:**
- Modify: `frontend/src/pages/financial/DespesasTab.jsx`, `ObrigacoesTab.jsx`, `ComissoesTab.jsx`, `SalariosTab.jsx`, `ReceitasManuaisTab.jsx` and `CostEditModal.jsx`.
- Test: extend `FinancialDespesas.test.jsx`, `FinancialObrigacoes.test.jsx`, `FinancialPessoal.test.jsx`, `FinancialReceitas.test.jsx` and `FinancialReceitasManuais.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Each tab's lists and forms sit in Maré cards and inner boxes.
  - Money and dates use `font-mono`.
  - Status tags (paid, due, overdue) are `Badge` with their text.
  - Hand-made icon-only actions are `IconBtn` with the same accessible names.
  - The DespesasTab chart follows the chart language with the same `dataKey`s.
  - Standalone sm Buttons get `min-h-11 md:min-h-0`.
  - The cost modal's inner boxes use `rounded-[14px] border-mare-card`.
  - Every existing behavioural assertion stays.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run FinancialDespesas FinancialObrigacoes FinancialPessoal FinancialReceitas`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: despesas, obrigacoes, comissoes, salarios e receitas no estilo Mare`.

### Task 3: Analytics

**Files:**
- Modify: `frontend/src/pages/Analytics.jsx`.
- Test: extend `Analytics.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - The page shows the eyebrow.
  - The summary tiles are `MareStat` with the same values.
  - The chart cards are Maré cards with Sora 18 px titles.
  - Charts follow the chart language with the same `dataKey`s.
  - An empty series shows the existing empty text.
  - Tables and ranked lists use `font-mono` for figures.
  - Any period toggle keeps its behaviour test.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Analytics`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: analytics no estilo Mare`.

### Task 4: Demand forecast and weather

**Files:**
- Modify: `frontend/src/pages/Demand.jsx` and `frontend/src/pages/Weather.jsx`.
- Test: extend `Demand.test.jsx` and `Weather.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow.
  - Summary tiles are `MareStat`, where tiles exist, with the same values.
  - Forecast and day cards are Maré cards.
  - Temperatures, wind, percentages and dates use `font-mono`.
  - Demand's `ui/Tabs` still switch.
  - The Demand chart follows the chart language with the same `dataKey`s.
  - Weather alerts keep their text, and their tone is not colour alone.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Demand Weather`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: previsao e meteorologia no estilo Mare`.

### Task 5: Staff list, staff cards, staff form and HR

**Files:**
- Modify: `frontend/src/pages/Staff.jsx`, `frontend/src/pages/RH.jsx`, and in `frontend/src/pages/staff/`: `StaffCard.jsx`, `SellerCard.jsx`, `StaffForm.jsx` and `shared.jsx` (the avatar; every new class behind `app:`).
- Test: extend `Staff.test.jsx`, `StaffColaboradores.test.jsx`, `StaffForm.test.jsx` and `RH.test.jsx`, plus a frozen outside-app test for the shared avatar (Review Focus 3).

- [ ] **Step 1: Write the failing tests.**
  - Staff and RH show the eyebrow.
  - Staff and seller cards are Maré cards.
  - Role and status tags are `Badge` or Maré pills with the same text.
  - The RH summary tiles are `MareStat` with the same values.
  - The staff form's sections are Maré inner boxes.
  - The shared avatar rendered without a `data-ui="app"` ancestor has exactly today's non-`app:` class tokens, frozen from `git show HEAD:frontend/src/pages/staff/shared.jsx`.
  - The Staff `ui/Tabs` still switch.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Staff RH StaffForm`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: colaboradores e RH no estilo Mare`.

### Task 6: Staff detail, kanban, checklist and staff chat tab

**Files:**
- Modify: `frontend/src/pages/StaffDetail.jsx`, `frontend/src/pages/staff/KanbanBoard.jsx`, `ChecklistTab.jsx` and `ChatTab.jsx`.
- Test: extend `StaffDetail.test.jsx`, `StaffTarefas.test.jsx`, `StaffChecklist.test.jsx` and `StaffChat.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - StaffDetail shows the eyebrow, and its sections are Maré cards.
  - Kanban columns are Maré inner boxes and the task cards are Maré cards. Moving a task keeps its behaviour test.
  - Checklist items keep their tick behaviour, with figures and dates in `font-mono`.
  - The staff chat tab: bubbles carry `break-words`, times use `font-mono`, and the composer sits in a Maré inner box. Sending keeps its test.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run StaffDetail StaffTarefas StaffChecklist StaffChat`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: ficha do colaborador no estilo Mare`.

### Task 7: Browser check (controller task)

The controller does this itself, with the browser preview tools and the fake API (`verif/mock-api.js` with the `MOCK_TIPO` launchers). It extends the API with finance, analytics, demand, weather, staff-detail and HR data where it is missing.

- [ ] **Step 1: Check every Gestão page** with the activity operator (business plan) at 1280 px and 375 px, including every finance tab. Also check finance and staff at 768 px.
- [ ] **Step 2: Check each page for:**
  - no console errors;
  - `main.scrollWidth <= main.clientWidth`;
  - the Maré look on cards, tiles, charts, tags and figures;
  - touch targets under 44 px, listed per page;
  - chart colours verified in the browser.
- [ ] **Step 3: Check the staff portal's chat** (`/staff` portal route, outside the app) still renders the avatar as before.
- [ ] **Step 4: Record what was found.** Anything found goes to the final review and its single fix wave.

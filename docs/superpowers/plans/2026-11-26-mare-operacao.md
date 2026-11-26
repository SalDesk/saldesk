# "Maré" look on every page, area phase: Operação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Operação pages to the approved "Maré" look, everywhere the base components (phase 1, live) do not reach. That means hand-drawn cards and boxes, page-level number tiles, page-specific toggles and tags, figure columns, and layouts that break at 375 px. Behaviour does not change. The pages are bookings, calendar, units, fleet, guides, maintenance, housekeeping, orders and the digital menu.

**Architecture:**
- **Restyle in place.** Each page keeps its structure and data flow.
- **Two restyle routes:**
  - hand-drawn boxes become the base components (`ui/Card`, `ui/Tabs`, `ui/Badge`, `ui/FilterChips`) where they do the same job;
  - anything else is restyled to the Maré tokens.
- **One new shared piece:** `components/shared/MareStat.jsx`, a page-level number tile. Later area phases reuse it.
- **A browser check against the fake API** closes the phase, covering activity, hotel, rent-a-car and restaurant operators.

**Tech Stack:** React 18, Tailwind 3 (tokens `mare-ground`, `mare-card`, `mare-field`, `mare-head`, plus the `ocean`, `sand`, `turquoise` and `n` scales; fonts `font-display` Sora, `font-body` DM Sans, `font-mono` DM Mono), vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-mare-todas-paginas-design.md` (Goal 2, area Operação; "The look"; "Builder calls"). Phase 1 is live: base components, shell and `PageHeader` with the optional `eyebrow`.

**Visual reference:** the approved canvas artboards. The controller copies them into the plan workspace as `proposta/`:
- `Reservas.dc.html`, the typical list page and the target for every page here;
- `Componentes.dc.html`;
- `Main.dc.html` (cards, number tiles, chips).

## Global Constraints

- **Repo:** work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`. Never touch `C:\Users\RITS DELGADO\saldesk`.
- **Look only.** No change to what a page does:
  - data, requests, props, routes, roles, accessible names, events, keyboard handling and stored values stay as they are;
  - no new feature, no moved flow;
  - texts change only where a new label is needed, in PT, EN, DE and NL.
- **`components/ui/*` does not change** in this phase. The owner's exception covered phase 1. If a base component is missing something, report it; do not patch it.
- **Leaks outside the app:**
  - files used only by the operator app may use plain classes;
  - shared files also rendered outside `data-ui="app"` must put every new look class behind `app:`. In this area that means `components/fleet/FleetSelector.jsx`, which `pages/BeachSale.jsx` (beach seller portal) imports.
  - Check each file you touch with `grep -rn "import.*<file>" src/pages` and apply the rule.
- **The look:**
  - **Cards:** white, 1 px `border-mare-card`, `rounded-[18px]` for page cards and `rounded-[14px]` for inner boxes, padding about 22 px (`p-[22px]`).
  - **Card titles:** Sora (`font-display`) 18 px semibold, `text-ocean-900`.
  - **Page header:** pass `eyebrow={t('nav.sections.operacao')}` to `PageHeader` on every page of this area.
  - **Figures:** dates, times, money, counts in tables, references and plates use `font-mono` with `tabular-nums`.
  - **Toggles:** page-specific segmented toggles (for example the calendar's Mês/Semana/Dia) use `ui/Tabs` or the identical pill-in-track look.
  - **Tags:** status, origin and type tags use `ui/Badge`, or a pill with the same tone palette.
  - **Number tiles** use `MareStat` (Task 1).
- **Formats** go through `utils/formatoLingua.js` and the existing money helpers. PT keeps today's money form (`€1860`). No hard-coded `'pt-PT'`.
- **Accessibility:**
  - touch targets at least 44 px, or 36 px only inside dense rows that are themselves at least 44 px;
  - text contrast at least 4.5:1;
  - visible focus;
  - status never told by colour alone.
- **Layout:** no horizontal overflow at 375 px inside `<main>` (measure `main.scrollWidth <= main.clientWidth`; the document never overflows because `<main>` scrolls). Wide tables scroll inside their own card. Header action groups wrap (`flex-wrap`).
- **i18n:** the whole-panel guard, the parity test and the accents test stay green.
- **Tests:**
  - class assertions may be updated as a pure look change;
  - behavioural assertions may not be weakened;
  - each task adds at least one test per page asserting the new look on its main container (the Maré card classes), and asserting the `eyebrow`.
- **Code style:**
  - comments in Portuguese without accents;
  - keep each file's line endings (many are CRLF: use the Edit tool, or Python preserving `\r\n`);
  - no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `frontend`):
  - `npx vitest run <pattern>`;
  - full suite `npx vitest run` (baseline 161 files / 3823 tests; `StaffColaboradores`, `BeachSeller` and `TemplatesEditor` can flake under load, so rerun them alone);
  - `npm run build`.

## Review Focus

1. **A behaviour change hidden in a restyle.** Swapping a hand-made toggle or tag for a base component can change roles, names, values or click targets. Examples:
   - the calendar Mês/Semana/Dia toggle must still switch the view and expose its state;
   - an origin tag must not become a button.

   Test: each task keeps or adds the behavioural test for every control it swaps.
2. **A leak into the beach seller portal** through `FleetSelector`. Test: Task 4 renders `FleetSelector` without a `data-ui="app"` ancestor and compares its non-`app:` class tokens with a frozen list taken from the pre-change file.
3. **A page that still overflows at 375 px**, or a toolbar that wraps badly. Test: the Task 6 browser check measures `main` on every page of the area, for each operator type.
4. **Figures in the wrong format in EN:** a `font-mono` change that also changes the formatter. Test: each task's existing EN tests stay green; no formatter changes.
5. **Pages reachable only by other operator types** (housekeeping for hotel, orders and digital menu for restaurant, fleet and guides for activity, the rent-a-car table) going unchecked. Test: the Task 6 browser check switches the fake operator's type to reach each one.

---

### Task 1: Bookings and the shared number tile

**Files:**
- Create: `frontend/src/components/shared/MareStat.jsx`.
- Modify:
  - `frontend/src/pages/Reservations.jsx`;
  - every file in `frontend/src/pages/reservations/*`: the tables, the column cards, the manifest, the pick-up, return, no-show, reschedule and restaurant-create modals, and `shared.jsx` (look only);
  - `frontend/src/components/reservations/*`: card, detail modal, form, status badge.
- Test:
  - `frontend/src/__tests__/MareStat.test.jsx` (new);
  - extend `Reservations.test.jsx`, `ReservationsActivityTable.test.jsx`, `ReservationsRentacarTable.test.jsx`, `ReservationsRestaurantTable.test.jsx`, `ReservationsMobileCards.test.jsx`, `ReservationsModals.test.jsx` and `ReservationDetailModal` / `ReservationForm` tests where present.

**Interfaces:**
- Produces `MareStat({ label, value, hint?, tone?, icon? })`:
  - a white card with `border-mare-card` and `rounded-[18px]`;
  - the label at 13 px semibold `text-n-600`;
  - the value in Sora 28–30 px bold `text-ocean-900` with `tabular-nums`;
  - an optional hint at 12 px `text-n-500`;
  - `tone` is `'default' | 'aviso' | 'bom'`, which tints only a small badge or icon box, never the value text;
  - renders as `<article>`, with no new role.

  Tasks 3–5 use it for their number tiles.

- [ ] **Step 1: Write the failing tests.**
  - `MareStat` renders the label, value and hint with the classes above, and `tone` changes only the badge or icon colour.
  - Reservas:
    - `PageHeader` shows the eyebrow "Operação" (EN "Operations");
    - the list sits in a Maré card (`rounded-[18px]` and `border-mare-card`);
    - the date, time and total cells use `font-mono`;
    - the origin tag renders as a `Badge` or Maré pill with the same text.
  - The modals keep every existing behavioural assertion.
  - The mobile cards use the Maré card classes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run MareStat Reservations ReservationForm ReservationDetail`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Follow `proposta/Reservas.dc.html` for the list page.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: reservas e quadro de numeros no estilo Mare`.

### Task 2: Calendar

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx` and `frontend/src/components/calendar/CalendarView.jsx` (`reservationCoversDay.js` is logic, so it is not touched).
- Test: extend `Calendar.test.jsx` and the `CalendarView` tests.

- [ ] **Step 1: Write the failing tests.**
  - The eyebrow shows.
  - The Mês/Semana/Dia toggle:
    - uses `ui/Tabs` or the pill-in-track look;
    - still switches the view;
    - exposes the selected state (`aria-selected` or `aria-pressed`, keeping whatever the test asserts today).
  - The legend and the guide filter sit in a Maré card or toolbar.
  - The month grid's cells use the Maré card border token.
  - Today's cell is marked in sand or ocean with a non-colour cue (bold or a ring).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Calendar CalendarView`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: calendario no estilo Mare`.

### Task 3: Units and unit forms

**Files:**
- Modify:
  - `frontend/src/pages/Units.jsx`;
  - `frontend/src/components/units/UnitList.jsx`;
  - `frontend/src/components/units/UnitForm.jsx`;
  - `frontend/src/components/units/forms/*`: the tour, hotel room, rent-a-car vehicle, restaurant table and generic forms, plus `editors.jsx`, `OpcoesActividade.jsx` and `LocalizacaoPontoEncontro.jsx`.
- Test: extend `Units.test.jsx`, `UnitForm.test.jsx`, `UnitFormsResponsive.test.jsx` and `TourFormOpcoes.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Units shows the eyebrow.
  - The "Total / Activas" counters use `MareStat`, or Maré pills with the same numbers.
  - Unit cards use the Maré card classes.
  - The price is in `font-mono`.
  - The status tags are `Badge`.
  - The form sections are Maré inner boxes (`rounded-[14px]`, `border-mare-card`).
  - The options editor rows and the meeting-point map frame use the inner-box look.
  - At 375 px nothing in the forms is wider than its container (keep today's responsive tests).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Units UnitForm UnitFormsResponsive TourFormOpcoes`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: unidades e formularios no estilo Mare`.

### Task 4: Fleet, guides and maintenance

**Files:**
- Modify:
  - `frontend/src/pages/Fleet.jsx`;
  - `frontend/src/components/fleet/FleetSelector.jsx`: shared with the beach seller portal, so every new class goes behind `app:`;
  - `frontend/src/pages/Guides.jsx`;
  - `frontend/src/pages/Maintenance.jsx`.
- Test: extend `Fleet.test.jsx`, the `FleetSelector` tests, `Guides.test.jsx` and `Maintenance.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Each page shows the eyebrow.
  - KPI tiles use `MareStat`.
  - Lists and cards use the Maré card classes.
  - Plates, kilometres, dates and costs are in `font-mono`.
  - Status tags are `Badge`.
  - `FleetSelector` rendered without `data-ui="app"` has exactly today's non-`app:` class tokens. Take the frozen list from `git show HEAD:frontend/src/components/fleet/FleetSelector.jsx` before editing.
  - The existing behavioural tests of the three pages stay intact.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Fleet FleetSelector Guides Maintenance`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: frota, guias e manutencao no estilo Mare`.

### Task 5: Housekeeping, orders and the digital menu

**Files:**
- Modify:
  - `frontend/src/pages/Housekeeping.jsx`;
  - `frontend/src/pages/Pedidos.jsx`;
  - `frontend/src/pages/MenuDigital.jsx`. Its header action group (around line 481) must wrap (`flex-wrap`), because it overflows at 375 px today.
- Test: extend `Housekeeping.test.jsx`, `Pedidos.test.jsx` and `MenuDigital.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Each page shows the eyebrow.
  - Room, order and dish cards use the Maré card classes.
  - Order and room statuses are `Badge`.
  - Prices, times and table numbers are in `font-mono`.
  - The MenuDigital header action group has `flex-wrap`.
  - Existing behavioural tests stay intact.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Housekeeping Pedidos MenuDigital`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: limpezas, pedidos e menu digital no estilo Mare`.

### Task 6: Browser check across operator types (controller task)

The controller does this itself, with the browser preview tools and the fake API from phase 1. The fake API needs a small extension: an operator-type switch, plus a few rooms, vehicles, tables, orders and dishes.

- [ ] **Step 1: Set the fake operator type** to `activity`, `hotel`, `rentacar` and `restaurant` in turn.
- [ ] **Step 2: Check every Operação page** that type can reach, at 1280 px and 375 px:
  - no console errors;
  - `main.scrollWidth <= main.clientWidth`;
  - the Maré look on cards, tiles, toggles, tags and figures;
  - nothing cut or overlapping.
- [ ] **Step 3: Fix or record.**
  - One-line layout fixes go in, test first, then the full suite and the build.
  - Anything larger is recorded for the report.
- [ ] **Step 4: Commit any fixes.** Message: `fix: acertos de layout da fase Operacao`. Share screenshots with the owner.

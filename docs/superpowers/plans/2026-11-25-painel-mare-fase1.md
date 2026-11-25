# Dashboard "Maré", phase 1 (activity Hoje and Resumo for all types) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the activity operator's "Hoje" dashboard and the shared "Resumo" view in the approved "Maré" design, frontend only, with real data.

**Architecture:**
- Pure data functions live in two new logic files, each test-first:
  - `pages/dashboard/mareLogic.js` for Hoje;
  - `pages/dashboard/resumoLogic.js` for Resumo.
- Each widget is its own component in `components/dashboard/`, and loads, empties and fails on its own.
- `ActivityDashboard.jsx` and `ResumoView.jsx` keep fetching with the existing services and hand data to the widgets.
- The tide curve and sparklines are hand-drawn SVG; Resumo's line chart uses the existing `recharts`.

**Tech Stack:** React 18, Vite, Tailwind (tokens `ocean`, `sand`, `turquoise`, `n`; fonts `font-display` Sora, `font-body` DM Sans, `font-mono` DM Mono), recharts, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-25-painel-mare-design.md`. Its "Owner answer" and "Builder calls" are binding.

**Visual reference:** the approved proposal's three artboards:
- `Main.dc.html` (Hoje on desktop);
- `Resumo.dc.html`;
- `Movel.dc.html` (Hoje on the phone).

The controller copies them into the plan workspace as `proposta/` and gives implementers the path. Their numbers are sample data; match their layout, hierarchy, colours and interactions, not their figures.

## Global Constraints

- **Work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`.** Never touch `C:\Users\RITS DELGADO\saldesk`.
- **Frontend only.** No backend, database or new-endpoint change, and no new npm dependency.
- **`components/ui/*` never changes.**
- **Every new visible text is an i18n key in PT, EN, DE and NL.** `i18nParity.test.js`, `acentosPainelOperador.test.js` and the whole-panel guard `painelSemPortuguesFixo.test.js` stay green, and PT text is written with accents.
- **Formats:**
  - dates and numbers go through `utils/formatoLingua.js`;
  - PT money keeps today's form (`€1860`, no thousands separator), via the existing `pages/reservations/shared.jsx` helpers (`eurosInteiros`, `eurosDecimais`);
  - no hard-coded `'pt-PT'`.
- **"Today"** is the operator's local day: `TODAY` from `pages/dashboard/shared.jsx`.
- **An activity reservation belongs to the day of its `check_in`.**
- **The Hoje money tile is "Valor do dia":** the sum of `total_price` of the day's reservations whose status is not `cancelled`. It is never called "Receita". Resumo's "Receita" stays the finance rule from `/financeiro/resumo`.
- **Stored values and request payloads are unchanged.**
- **Accessibility:**
  - charts are SVG with `role="img"` and an `aria-label` summary;
  - the heat-map is a `<table>` with a caption;
  - selectable rows are `<button aria-pressed>`;
  - touch targets are at least 44 px;
  - figures use `tabular-nums`;
  - animation respects `prefers-reduced-motion`.
- **Layout:** works from 375 px. Nothing scrolls the page sideways; the heat-map scrolls inside its card.
- **Code style:**
  - comments in Portuguese without accents;
  - keep each file's line endings (many are CRLF: use the Edit tool, or Python preserving `\r\n`);
  - no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `frontend`):
  - `npx vitest run <pattern>`;
  - full suite `npx vitest run` (baseline 151 files / 3590 tests; `StaffColaboradores` and `BeachSeller` can flake under load, so rerun them alone);
  - `npm run build`.

## Review Focus

1. **Tours with missing data** (no `start_time`, no `duration`, no `time_slots` and no `capacity`, or `guests` null). The tide, agenda and heat-map must show sensible fallbacks (default duration, guests counted as 1, a neutral cell), never `NaN`, `undefined` or a crash. Test: Task 1.
2. **Activities outside 07:00–20:00, or a day with no activities at all.** The tide axis widens to include them. An empty day shows the calm empty state, not a flat line. Test: Task 1 (widening) and Task 2 (empty state).
3. **"Valor do dia" on a day where nothing is checked out.** The tile shows the booked total, not €0, while Resumo's "Receita" still shows the finance figure. Test: Task 1 (`valorDoDia`) and Task 5 (Resumo tile reads `resumo.atual.receita`).
4. **One request failing.** Reservations load but weather, finance or assignments fail. Every other widget still renders; the failed one shows its inline message or empty state. Test: Tasks 3, 4, 5 and 6.
5. **English operator.** Each new widget renders in EN with no Portuguese and no raw keys (`portuguesNoEcra` and `chavesCruas` empty), and month, weekday and country names follow the language. Test: every task's EN render test.

---

### Task 1: Hoje data logic

**Files:**
- Create: `frontend/src/pages/dashboard/mareLogic.js`.
- Test: `frontend/src/__tests__/mareLogic.test.js`.

**Interfaces:**
- Consumes the existing `pages/dashboard/agendaLogic.js`: `paraMinutos`, `DURACAO_POR_OMISSAO_MIN`, `porReceber` and its tour-meta/duration/capacity helpers. Export any helper you need from there instead of copying it.
- Produces, all pure, with no React and no `Date.now`:
  - `curvaMare(reservas, tours)` returns `{ inicioHora, fimHora, pontos, pico, saidas }`:
    - `pontos` is `[{ hora, pessoas }]`, one per whole hour from `inicioHora` to `fimHora` inclusive;
    - `pico` is `{ hora, pessoas } | null`;
    - `saidas` is `[{ inicio, titulo }]`, sorted.
  - `pessoasAs(curva, minutos)` returns a number: guests out at that minute.
  - `serieDias(reservas, fimData, n, medida)` returns `number[]` of length `n`. It covers the days ending at `fimData` (YYYY-MM-DD), oldest first. `medida` is `'reservas' | 'pessoas' | 'valor'`.
  - `valorDoDia(reservas)` returns a number.
  - `variacaoSemana(hoje, semanaPassada)` returns `string | null`, e.g. `'+3'` for counts, or a percentage string when called through `variacaoSemanaPct`, which has the same signature.
  - `detalheSaida(evento, reservasHoje)` returns `{ checkin, total, porReceber }`.
  - `ocupacaoDias(reservas, tours, dias)` returns `[{ tourId, nome, celulas: [{ data, pessoas, capacidade, pct }] }]`, where `pct` is a whole percentage or `null` when there is no capacity.
  - `diasSeguintes(inicio, n)` returns `string[]` of YYYY-MM-DD.

- [ ] **Step 1: Write the failing tests.**
  - `curvaMare_conta_pessoas_por_hora`:
    - tour A has `duration` 3 h and two reservations at 08:30 with 2 and 4 guests;
    - tour B has no duration and one reservation at 10:00 with `guests` null;
    - expect hour 9 = 6, hour 10 = 7, hour 11 = 6, and `pico` = `{ hora: 10, pessoas: 7 }`.

    A guest counts in an hour when the activity overlaps that hour. `guests` null counts as 1. A missing duration uses `DURACAO_POR_OMISSAO_MIN`.
  - `curvaMare_ignora_canceladas_e_alarga_o_eixo`:
    - a cancelled reservation does not count;
    - with a 06:00 and a 21:30 activity, `inicioHora` is 6 and `fimHora` is 22;
    - with no reservations, `pontos` covers 7 to 20 with zeros and `pico` is `null`.
  - `curvaMare_saidas_uma_por_tour_e_hora`: two reservations of the same tour at the same time give one `saida`.
  - `serieDias_e_valorDoDia`: `valorDoDia` sums `total_price` of non-cancelled reservations, including those in `confirmed` or `pending` with nothing checked out. `serieDias(..., '2026-11-25', 7, 'valor')` returns 7 values, oldest first, grouped by `check_in`.
  - `variacaoSemana_sem_base_devolve_null`:
    - `variacaoSemana(14, 11)` is `'+3'`;
    - `variacaoSemana(5, 0)` is `null`;
    - `variacaoSemanaPct(1860, 1720)` is `'+8%'`;
    - `variacaoSemanaPct(10, 0)` is `null`.
  - `detalheSaida_conta_checkins_e_por_receber`: across three reservations of the event's tour and time, in `checked_in`, `checked_out` and `confirmed`, `checkin` is the guests of the first two and `total` is all guests. `porReceber` equals `porReceber` from `agendaLogic` applied to those reservations.
  - `ocupacaoDias_usa_capacidade_dos_horarios_ou_do_tour`:
    - a tour with `time_slots` 8 + 8 and 12 guests on day 1 gives `pct` 75;
    - a tour with only `capacity` 10 and 10 guests gives 100;
    - a tour with neither gives `pct: null` and `pessoas` set;
    - a day without bookings gives 0.
  - `diasSeguintes_atravessa_o_mes`: `diasSeguintes('2026-11-29', 3)` is `['2026-11-29', '2026-11-30', '2026-12-01']`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run mareLogic`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** them in `mareLogic.js`. Only `pending`, `confirmed`, `checked_in` and `checked_out` count as active, the same set `eventosAtividades` uses.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run mareLogic`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: logica do painel Mare (mare do dia, series, ocupacao)`.

### Task 2: Trend tiles and the tide card on the activity Hoje

**Files:**
- Create:
  - `frontend/src/components/dashboard/Sparkline.jsx`;
  - `frontend/src/components/dashboard/TilesTendencia.jsx`;
  - `frontend/src/components/dashboard/MareDoDia.jsx`.
- Modify: `frontend/src/pages/dashboard/ActivityDashboard.jsx`:
  - add one more `listReservations` range covering the 13 days before `TODAY`, with the same failure-to-empty pattern;
  - replace `HeroCard` and `StatTiles` with the new tiles and the tide card.
- Modify: the i18n json files (keys under `dashboard.mare.*`). The guard test already scans every file, so nothing needs adding to it.
- Test: `frontend/src/__tests__/MareDoDia.test.jsx`; update `ActivityDashboard.test.jsx` and `ActivityDashboard.firstOfMonth.test.jsx` where they assert the removed hero and tiles.

**Interfaces:**
- Consumes from Task 1: `curvaMare`, `pessoasAs`, `serieDias`, `valorDoDia`, `variacaoSemana`, `variacaoSemanaPct`.
- Produces:
  - `<Sparkline valores={number[]} rotulo={string} />` (SVG 112×36, last point marked in sand);
  - `<TilesTendencia tiles={[{ id, label, value, delta, deltaTom: 'bom'|'aviso'|null, nota, serie }]} />`;
  - `<MareDoDia curva agoraMin />`.

- [ ] **Step 1: Write the failing tests.**
  - The four tiles, in this order with these PT labels:
    - "Reservas hoje";
    - "Pessoas em actividade";
    - "Valor do dia";
    - "Por receber".
  - "Valor do dia" shows the booked total of today's non-cancelled reservations (fixture with nothing checked out: `€320`, not `€0`).
  - Each tile has a sparkline `role="img"` with an aria-label.
  - With last week's value 0, the tile shows no delta badge.
  - `MareDoDia`:
    - renders `role="img"` with an aria-label naming the peak and the current count;
    - shows the peak hour, "agora" (now) and the departures count, and one chip per departure;
    - with no reservations it shows the empty-state text instead of the chart.
  - In EN, the tiles and tide card show English (`portuguesNoEcra` and `chavesCruas` empty), and "Value of the day" is shown.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run MareDoDia ActivityDashboard`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
  - Tide card: dark `bg-ocean-900`, curve area in `ocean-600` and line in `ocean-300`, a dashed `sand-500` now line and dot, hour labels in DM Mono.
  - Draw the curve with a smooth cubic path. Add a subtle draw-in, disabled under `prefers-reduced-motion`.
  - Layout follows `proposta/Main.dc.html` on desktop and `Movel.dc.html` on the phone (tiles 2×2 there).
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: numeros com tendencia e mare do dia no painel de actividades`.

### Task 3: Agenda with departure detail, and the attention list restyle

**Files:**
- Create: `frontend/src/components/dashboard/AgendaSaidas.jsx` (list plus detail panel).
- Modify:
  - `frontend/src/pages/dashboard/ActivityDashboard.jsx`: replace `DayAgenda` with `AgendaSaidas`, and wire `ManifestoModal` from `pages/reservations/ManifestoModal.jsx` (`open`, `onClose`, `reservations` set to the departure's reservations, `units` set to the tours).
  - `frontend/src/components/dashboard/AttentionPanel.jsx`: restyle as in the proposal (rounded card, severity square, count badge, per-item action link). It is shared by every operator type, so the restyle is cosmetic for all.
- Modify: the i18n json files.
- Test: `frontend/src/__tests__/AgendaSaidas.test.jsx`; update `dashboardUi.test.jsx` and the per-type dashboard tests only where they assert the old attention markup.

**Interfaces:**
- Consumes: `eventosAtividades`, `estadoDoEvento` and `ordenarAgenda` from `agendaLogic`; `detalheSaida` from Task 1.
- Produces:
  - `<AgendaSaidas eventos reservasHoje tours agoraMin onAbrirManifesto={(evento) => void} />`;
  - `AttentionPanel` keeps its props (`items` of `{ id, severity, title, detail?, to }`).
- Action label per item: chosen in the panel from the item id prefix. `unconfirmed` and `pending` give "Confirmar"; `unpaid` gives "Cobrar"; weather gives "Ver"; anything else gives the existing `dashboard.attention.open`.

- [ ] **Step 1: Write the failing tests.**
  - Each departure is a `<button aria-pressed>` showing time, tour, guests and guide, plus a status pill: "A decorrer", "A seguir", "Concluída", or "Sem guia" when it has no guide.
  - The first departure that has not ended is selected by default. Clicking another selects it (`aria-pressed="true"`) and updates the detail panel.
  - The detail panel shows:
    - check-ins as "3 / 4" with a bar;
    - the guide, or "Por atribuir";
    - the meeting point when the tour has one;
    - "Por receber" from `detalheSaida`.
  - Clicking "Abrir manifesto" calls `onAbrirManifesto` with the selected event.
  - In `ActivityDashboard`, clicking "Abrir manifesto" opens the manifest dialog with that departure's customers.
  - `AttentionPanel` shows the count badge and one action link per item with the label above. It still navigates to `item.to`. With no items it keeps the "all clear" text.
  - In EN the agenda and panel show English.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run AgendaSaidas ActivityDashboard dashboardUi`. Expected: FAIL.
- [ ] **Step 3: Implement** it. On the phone the detail panel sits below the list.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: agenda com detalhe da saida e lista de atencao renovada`.

### Task 4: Wind and sea, 14-day occupancy, and the Hoje header

**Files:**
- Modify: `frontend/src/services/weatherService.js`. Add `wind_speed_10m_max` and `wind_direction_10m_dominant` to the daily request, and `ventoKmh` and `ventoDirecao` to each day. Existing fields and consumers stay unchanged.
- Create:
  - `frontend/src/components/dashboard/VentoEMar.jsx`;
  - `frontend/src/components/dashboard/OcupacaoDias.jsx`.
- Modify `frontend/src/pages/dashboard/ActivityDashboard.jsx`:
  - replace the weather alert tile and `NextDaysStrip` with the new widgets;
  - drop `Shortcuts` (builder call in the spec);
  - fetch reservations for the next 14 days. This replaces the 7-day fetch, and the attention logic that used `weekRes` reads the first 7 days of it.
- Modify `frontend/src/components/dashboard/DashboardHeader.jsx`, which is shared by all types (cosmetic only):
  - date in DM Mono;
  - Hoje/Resumo as a pill tab;
  - sand "Nova reserva" button to `/reservas`;
  - on screens under 768 px, that button becomes a floating round button bottom-right with an aria-label.
- Modify: the i18n json files.
- Test: `frontend/src/__tests__/VentoEMar.test.jsx` and `frontend/src/__tests__/OcupacaoDias.test.jsx`; update the `weatherService` tests and `dashboardMoldura.test.jsx` / header tests where they assert old markup.

**Interfaces:**
- Consumes from Task 1: `ocupacaoDias` and `diasSeguintes`.
- Produces:
  - `ventoForte(dia, limite = 35)` returns a boolean, exported from `weatherService.js`;
  - `<VentoEMar dias={forecast.slice(0, 5)} estado="ok"|"erro"|"vazio" />`;
  - `<OcupacaoDias linhas dias compacto={boolean} />`. With `compacto`, it renders the phone's "Próximos 7 dias" bars: one bar per day, all tours together.

- [ ] **Step 1: Write the failing tests.**
  - `weatherService` maps the two new fields.
  - `ventoForte({ ventoKmh: 35 })` is true and 34 is false.
  - `VentoEMar`:
    - shows 5 rows with weekday (in the panel language), km/h and a direction arrow rotated by the degrees;
    - shows the warning line only when a day is at or over 35 km/h;
    - shows an inline message when `estado="erro"`, and the rest of the dashboard still renders.
  - `OcupacaoDias`:
    - renders a `<table>` with a caption, one row per active tour and 14 day columns;
    - shows a cell's text as "75%", and a neutral cell with the guest count when `pct` is null;
    - has a legend;
    - in `compacto` mode renders 7 bars with weekday labels.
  - `DashboardHeader`: the tab pill keeps `onViewChange`; "Nova reserva" navigates to `/reservas`.
  - In EN every new widget shows English, and weekday names are English.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run VentoEMar OcupacaoDias weatherService ActivityDashboard dashboardMoldura`. Expected: FAIL.
- [ ] **Step 3: Implement** it. The heat-map uses four ocean steps (`ocean-50`, `ocean-200`, `ocean-400`, `ocean-700`), with text colour chosen for contrast. Weekend day labels are darker. The table sits in an `overflow-x-auto` box.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: vento e mar, ocupacao de 14 dias e cabecalho do painel`.

### Task 5: Resumo data logic, period chips, tiles and revenue chart

**Files:**
- Create: `frontend/src/pages/dashboard/resumoLogic.js`.
- Modify: `frontend/src/pages/dashboard/ResumoView.jsx`. Rebuild its top half: period chips, four tiles, revenue chart.
- Modify: the i18n json files (`dashboard.resumo.*`).
- Test: `frontend/src/__tests__/resumoLogic.test.js`; update the existing Resumo tests (`dashboard.smoke.test.jsx` and any `ResumoView` assertions).

**Interfaces:**
- Produces in `resumoLogic.js`:
  - `periodoResumo(chave, hoje)`, where `chave` is `'7d' | '30d' | '12m'`. It returns `{ inicio, fim, anteriorInicio, anteriorFim, granularidade }`:
    - 7d and 30d end at `hoje`, with `granularidade` `'day'`;
    - 12m runs from the first day of the month 11 months back to `hoje`, with `granularidade` `'month'`;
    - the previous period is the same number of days immediately before `inicio`, as `/financeiro/resumo` computes it.
  - `alinharSeries(actual, anterior)` returns `[{ rotulo, actual, anterior }]`. It aligns by position, and the shorter series is padded with `null`.
  - `melhorPonto(series)` returns `{ indice, rotulo, valor } | null`.
  - `ocupacaoActividades(reservas, tours, inicio, fim)` returns a whole percentage or `null`. It uses the capacity fallback from Task 1.

- [ ] **Step 1: Write the failing tests.**
  - `periodoResumo`:
    - `('30d', '2026-11-25')` returns `inicio` `'2026-10-27'`, `fim` `'2026-11-25'`, `anteriorFim` `'2026-10-26'`, `anteriorInicio` `'2026-09-27'`;
    - `('12m', '2026-11-25')` returns `inicio` `'2025-12-01'` and `granularidade` `'month'`.
  - `alinharSeries` pads with `null`.
  - `melhorPonto` returns the highest value.
  - `ocupacaoActividades` returns `null` with no capacity.
  - `ResumoView`:
    - shows chips "7 dias", "30 dias" (pressed by default) and "12 meses";
    - clicking "12 meses" refetches `getResumo` and `getReceita` with the 12-month ranges and `'month'`;
    - shows the tiles "Receita", "Reservas", "Valor médio por reserva" and "Ocupação", each with a delta badge from `resumo.atual` vs `resumo.anterior`. "Receita" reads `resumo.atual.receita`;
    - shows "Ocupação" for `hotel` and `rentacar` (from `taxa_ocupacao`) and for `activity` (from `ocupacaoActividades`), and not for `restaurant` or `generic`;
    - draws the chart with an aria-label naming the total and the best point;
    - shows an empty state when there is no revenue;
    - in EN, shows English month names on the axis.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run resumoLogic ResumoView dashboard.smoke`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
  - Chart with `recharts`: `AreaChart`, with the current series as an ocean line and 12% fill, the previous series dashed `n-400`, and the best point as a sand dot with a dark label.
  - Operator type comes from the same source `pages/Dashboard.jsx` uses.
  - Activity occupancy needs the period's reservations; fetch them once here, because Task 6 reuses them.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: resumo com periodo, numeros e grafico de receita comparado`.

### Task 6: Resumo channels, top services and customers

**Files:**
- Create:
  - `frontend/src/components/dashboard/CanaisDonut.jsx`;
  - `frontend/src/components/dashboard/TopServicos.jsx`;
  - `frontend/src/components/dashboard/QuemSaoClientes.jsx`.
- Modify: `frontend/src/pages/dashboard/ResumoView.jsx`. Add the bottom row and replace the old top-services and recent-bookings blocks.
- Modify: `resumoLogic.js`:
  - `quotaDirectas(canais)` returns a whole percentage or `null`. Direct is `direct`, `public` and `admin`, counted by `num_reservas`;
  - `topPaises(reservas, n = 5)` returns `[{ codigo, pct }]` from `customer_country`. Codes are upper-cased, and empty ones are ignored.
- Modify: the i18n json files.
- Test: `frontend/src/__tests__/ResumoBlocos.test.jsx`; extend `resumoLogic.test.js`.

**Interfaces:**
- Consumes:
  - `getCanais`, `getUnidades` and `/reviews/stats` (as `ActivityDashboard` reads it);
  - `rotuloOrigem` from `pages/reservations/shared.jsx`;
  - the period's reservations from Task 5.
- Country names come from `Intl.DisplayNames(localeDe(lang), { type: 'region' })`, falling back to the code.

- [ ] **Step 1: Write the failing tests.**
  - `quotaDirectas`: with `[direct: 4, public: 2, booking_com: 4]` it returns 60; an empty list returns `null`.
  - `topPaises`: `gb`, `GB`, `PT` and `''` give GB 67% and PT 33%.
  - `CanaisDonut`:
    - renders an SVG `role="img"` whose aria-label lists every channel with its share;
    - shows a legend using `rotuloOrigem` labels and the direct share in the centre;
    - with no channels, shows an empty state.
  - `TopServicos` shows at most 5 rows with money in the panel format; the first bar is sand.
  - `QuemSaoClientes`:
    - shows the average rating and the review count;
    - lists countries with names in the panel language (EN "United Kingdom", PT "Reino Unido");
    - shows no repeat-rate figure.
  - One failing request (for example `getCanais`) leaves the other blocks rendered.
  - In EN, the whole Resumo shows English.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run resumoLogic ResumoBlocos ResumoView`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Use the donut layout from `proposta/Resumo.dc.html` (SVG circles with `stroke-dasharray`, palette ocean-900, ocean-500, ocean-300, sand-500, turquoise-600). Blocks wrap to one column on the phone.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: resumo com canais, servicos que mais rendem e clientes`.

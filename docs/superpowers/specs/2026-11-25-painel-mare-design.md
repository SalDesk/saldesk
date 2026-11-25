# Operator dashboard "Maré": a more interactive, visual home screen

Date: 2026-11-25. Owner: Rits Delgado.

## Intent

The owner wants the operator dashboard (the first screen after login, `/dashboard`) to feel more interactive and professional, with charts, a strong visual identity and a design that is recognisably SalDesk's rather than a generic admin template.

The owner handed the design to the builder ("pode avançar com uma proposta"). They then approved the visual proposal and chose the build approach, A in two phases.

**Approved proposal** (the visual reference for this work): canvas "Novo painel SalDesk", https://claude.ai/artifact/6VQVVNFKj6wH8v48xcUCMJ, with three artboards:
- **Hoje (computador)**, `Main.dc.html`;
- **Resumo (computador)**, `Resumo.dc.html`;
- **Hoje (telemóvel)**, `Movel.dc.html`.

Its numbers and names are sample data. The look, layout, hierarchy and interactions are what was approved.

**The idea, "Maré" (tide):** the hero of the Today view is a tide-like curve of how many guests are out on activities hour by hour, with a gold "now" line. It is built in the SalDesk palette and type:
- palette: ocean `#062A38`…`#EBF7FB`, sand `#D4A82A`, turquoise `#0D9488`;
- type: Sora for display, DM Sans for body, DM Mono for figures.

## How it works today

- **Entry point:** `pages/Dashboard.jsx` picks a view per operator type: `pages/dashboard/ActivityDashboard.jsx`, `HotelDashboard`, `RentacarDashboard`, `RestaurantDashboard` and `GenericDashboard`. There is also a Hoje/Resumo switch; Resumo is `pages/dashboard/ResumoView.jsx`, the same for all types.
- **Building blocks:** `components/dashboard/*` (`DashboardHeader`, `HeroCard`, `StatTiles`, `AttentionPanel`, `DayAgenda`, `NextDaysStrip`, `Shortcuts`, `TrialStrip`). The logic lives in `pages/dashboard/dashboardLogic.js`, `agendaLogic.js`, `useMolduraComum.js` and `shared.jsx`.
- **Data, all already available to the frontend:**
  - reservations with stay ranges: `services/reservationRanges.js`, `listReservations`;
  - units, whose metadata holds `duration`, `meeting_point` and `time_slots[{time, capacity}]`;
  - assignments of guides;
  - finance: `/financeiro/resumo` (already returns the previous period), `/financeiro/receita` (per day or month), `/financeiro/unidades`, `/financeiro/canais` and `/financeiro/clientes`;
  - reviews;
  - the Open-Meteo forecast in `services/weatherService.js`, daily temperature, rain and code, with no wind yet.
- **Charts:** `recharts` is already a dependency.
- **Tests:** `ActivityDashboard.test.jsx`, `ActivityDashboard.firstOfMonth.test.jsx`, `dashboard.smoke.test.jsx`, `dashboardLogic.test.js`, `dashboardMoldura.test.jsx`, `dashboardUi.test.jsx`, `i18nDashboard.test.js` and one per other operator type.
- **Language:** the panel is fully translated (PT, EN, DE, NL). The guard test `__tests__/painelSemPortuguesFixo.test.js` now scans the whole operator panel.

## Approach (chosen by the owner: A)

- **A: renew the existing dashboard from inside (chosen).**
  - Keep the current data loading per view and the Hoje/Resumo switch.
  - Restyle it and add the new pieces: tide, agenda with detail, wind, 14-day occupancy, period choice in Resumo.
  - Line and bar charts use the existing `recharts`. The tide curve and sparklines are hand-drawn SVG, because they carry the identity.
  - Frontend only.
  - Cost: the dashboard keeps making several requests on open, as today.
- **B: new dashboard from scratch with one aggregated backend endpoint.** Rejected: it needs a new backend endpoint deployed by hand on the VPS, and all dashboard tests rebuilt. That is more time and risk for a load-time difference operators barely notice.

**Phasing (chosen):**
- **Phase 1:** the activity operator's Hoje, plus Resumo for every operator type.
- **Phase 2:** Hoje for hotel, rent-a-car, restaurant and generic, each with its own "tide": rooms occupied, cars out, tables seated, bookings.
- Each phase ships on its own. Phase 2 gets its own plan after the owner has seen phase 1 live.

## Phase 1 goals

### Hoje (activity operator), desktop and phone, as in the proposal

1. **Header.** It is shared by every operator type (`DashboardHeader` sits in `pages/Dashboard.jsx`), so the restyle is cosmetic for all types; this is accepted.
   - The date in DM Mono. The town is dropped: no operator town field exists, and the backend is out of scope.
   - A greeting by time of day with the user's first name (the existing `saudacao`).
   - The Hoje/Resumo switch as a pill tab.
   - A sand "Nova reserva" button that goes where the header's existing button goes (`/reservas`). On the phone it is a floating round button.
2. **Four number tiles,** each with a 7-day sparkline and a delta badge against the same weekday last week:
   - bookings today;
   - guests on activities today;
   - **value of the day** (PT "Valor do dia");
   - to be received, with the badge giving the count of unpaid bookings.

   **Value of the day (owner's answer, 2026-11-25):** the sum of `total_price` of the day's non-cancelled reservations, by activity date. It is NOT the finance "revenue" rule, which counts only `checked_out`; activity operators rarely check out, so that rule reads €0 on full days. The tile is labelled "Valor do dia", not "Receita", so it never clashes with Resumo and Financeiro, which keep the word "Receita" for the completed-revenue rule.

   **Other definitions:**
   - bookings, guests and to-be-received reuse the existing logic (`porReceber`, `unpaidReservations`), so those numbers match what the operator sees today;
   - sparklines and deltas come from one extra reservations range request covering the 13 days before today;
   - when last week's value is 0, no delta badge is shown, instead of "+∞%".
3. **Maré do dia (hero, dark ocean card).**
   - Guests out per hour, from each of today's non-cancelled reservations: start time, plus the tour's `duration`, else the existing `DURACAO_POR_OMISSAO_MIN`.
   - The x axis covers 07:00–20:00, widened to include any earlier or later activity.
   - A gold dashed "now" line and dot from `useAgora`.
   - Three figures: peak (value and hour), now, and the number of departures today.
   - Departure chips (time and tour) under the chart.
   - Empty day: a calm empty state, not a flat line.
4. **Requer atenção.**
   - The existing `buildAttentionItems`, restyled as in the proposal.
   - A severity square (red for urgent, sand for money or confirmation, ocean for information) and an action link per item to the existing target.
   - A count badge.
5. **Agenda de hoje.**
   - The existing `eventosAtividades`, one row per departure (tour and time). Each row shows the time, a status dot, the tour, the guests and guide, and a status pill.
   - Rows are buttons. Selecting one fills a detail panel beside it (below it on the phone):
     - time and duration;
     - check-ins done over guests, as a bar: guests of the departure's reservations in `checked_in` or `checked_out` over all its guests. Status is per reservation, not per guest;
     - guide, or "Por atribuir";
     - meeting point from the unit, when set;
     - amount still to receive for that departure: the existing `porReceber` rule applied to that departure's reservations only;
     - "Abrir manifesto", which opens the existing `ManifestoModal` for that departure.

     The first departure that has not finished is selected by default.
   - The proposal's "Mensagem ao grupo" is dropped, because no such feature exists yet.
6. **Vento e mar.**
   - Five days with wind speed and direction. `weatherService` adds `wind_speed_10m_max` and `wind_direction_10m_dominant` to the Open-Meteo request.
   - A sand warning line when a day reaches 35 km/h or more.
   - This replaces today's weather tile on the activity Hoje.
7. **Ocupação dos próximos 14 dias.**
   - A heat-map table: one row per active tour, one column per day.
   - A cell shows booked guests over the day's capacity as a percentage, in four ocean steps with a legend. Capacity follows the same fallback as `agendaLogic`: the sum of the tour's slot capacities, else the tour's `capacity`.
   - A tour with neither shows the guest count in a neutral cell.
   - There is no availability or blackout concept to respect, so a day with no bookings simply shows 0%.
   - Weekends get a darker day label.
   - It scrolls sideways inside its card on small screens.
   - On the phone it becomes "Próximos 7 dias", one bar per day for all tours together.
   - This replaces `NextDaysStrip` on the activity Hoje.

`TrialStrip` keeps showing above everything when it applies.

### Resumo (all operator types), as in the proposal

1. **Period chips:** 7 dias, 30 dias (default) and 12 meses. Everything below follows the choice. The period is local to the page and not saved.
   - 7 and 30 days end today.
   - 12 months is rolling: the last 12 months including the current partial month.
   - The previous period is the same number of days immediately before, which is how `/financeiro/resumo` computes it. The frontend computes the same range for the second `receita` call and aligns the two series by position.
2. **Four tiles:** revenue, bookings, average value per booking and occupancy. Each has a delta badge against the previous period. Revenue keeps the finance rule (completed revenue, as in Financeiro).
   - Revenue, bookings and average come from `/financeiro/resumo`, which already computes the previous period.
   - Occupancy depends on the operator type:
     - hotel and rent-a-car: `taxa_ocupacao` from `/financeiro/resumo`;
     - activity: guests over seat capacity for the period, computed from the period's reservations, which are already fetched for the countries list, with the same capacity fallback as the heat-map;
     - restaurant and generic: the tile is hidden.
3. **Revenue chart** (`recharts` area plus line):
   - this period, a solid ocean line with a soft fill;
   - the previous period, dashed grey;
   - the best day or month marked with a sand dot and a dark label;
   - per day for 7 and 30 days, per month for 12 months;
   - two `/financeiro/receita` calls, one per period.
4. **De onde vêm as reservas.**
   - A donut and legend from `/financeiro/canais`, sized by `num_reservas` (that endpoint gives revenue only for checked-out bookings). Channel labels come from the existing `rotuloOrigem`.
   - The centre shows the share of direct bookings. "Direct" is the backend's own set: `direct`, `public` and `admin`.
   - A one-line note on why direct bookings matter.
5. **Serviços que mais rendem:** horizontal bars from `/financeiro/unidades`, top 5, with the first in sand.
6. **Quem são os clientes:**
   - the average review rating and review count;
   - top 5 guest countries from the period's reservations (`customer_country`), with names in the panel language;
   - the proposal's "voltam a reservar" (repeat rate) is left out of phase 1. Matching customers by email is not reliable enough.

### Throughout

- **One component per widget** under `components/dashboard/`, each loading and failing independently: a skeleton while loading, an empty state on no data, an inline message on error. One failing request never blanks the page.
- **Accessibility and figures:**
  - every chart is an SVG with `role="img"` and an `aria-label` summarising it;
  - the heat-map is a real `<table>` with a caption;
  - interactive rows are real buttons with `aria-pressed`;
  - touch targets are at least 44 px;
  - figures use tabular numerals.
- **Language and formats:**
  - all new text goes in PT, EN, DE and NL (`i18nParity` stays green);
  - formats go through `utils/formatoLingua.js`;
  - PT money keeps today's form (`€1860`);
  - the whole-panel guard test stays green.
- **Layout:** works from 375 px to wide desktops, following the proposal's desktop and phone layouts.

## Non-goals

- Hoje for hotel, rent-a-car, restaurant and generic operators. That is phase 2; they keep today's views in phase 1, apart from the shared Resumo.
- Dark mode for the dashboard. The dashboard does not support it today and still won't.
- Any backend change or new endpoint, and any database change.
- The founder panel, public pages, other operator screens and the sidebar. The proposal's sidebar is only context.
- Customisable or drag-and-drop widgets, and saved period preferences.

## Anti-goals

- **Invented or placeholder numbers in production.** Every figure comes from the operator's data, and missing data shows an empty state. Analytics once shipped `Math.random()` popularity; that must never happen here.
- **A slower or blanker first screen.** Widgets render progressively, and the header and tiles appear first.
- **Changing stored data** or any value sent to the server.
- **Breaking the other operator types** while their Hoje is untouched.
- **Losing what operators rely on today:** the attention list, the agenda and the unpaid-bookings signal stay, only better.

## Constraints

- **Stack:** React 18, Vite, Tailwind with the existing tokens (`ocean`, `sand`, `turquoise`, `n`, fonts `display`/`body`/`mono`), vitest. No new dependencies.
- `components/ui/*` never changes (owner rule).
- **Comments and files:** comments in Portuguese without accents; keep each file's line endings; no emojis.
- **Dates:** "today" is the operator's local day, as the existing `TODAY` note in `pages/dashboard/shared.jsx` explains. Activity dates follow the existing reservation-range helpers.
- **Tests:** existing dashboard tests are updated where they assert removed or renamed UI. New widgets get render and logic tests, including EN render tests.
- **Deploy:** frontend only, the usual way with an app backup first.

## Owner answer (2026-11-25)

- The Hoje money tile shows the booked value of the day ("Valor do dia"), not completed revenue. Resumo and Financeiro keep "Receita" for completed revenue.

## Builder calls (owner can overrule)

- Wind warning threshold: 35 km/h. Wind is shown in km/h, the Open-Meteo default.
- Default Resumo period: 30 days. The 12 months are rolling, including the current month.
- `Shortcuts` on the activity Hoje is replaced by the header's "Nova reserva" button. The other shortcuts are reachable from the menu.
- "Mensagem ao grupo" is dropped from the agenda detail.
- The operator's town is dropped from the header, because no field exists for it.
- "Voltam a reservar" is left out of phase 1.
- Occupancy in Resumo: hotel and rent-a-car from the backend, activity computed in the frontend, hidden for restaurant and generic.
- The channel donut counts bookings; "direct" means `direct`, `public` and `admin`.
- Check-in progress counts reservations in `checked_in` or `checked_out`.
- No delta badge when the comparison value is 0.

## Left to the builder

- Exact component split, file names and i18n key names.
- Animation, if any: a subtle draw-in of the tide curve, respecting `prefers-reduced-motion`.
- Exact colour steps for the heat-map and severity squares, within the palette and with readable contrast.

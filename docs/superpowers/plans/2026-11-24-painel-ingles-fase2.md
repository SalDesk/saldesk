# Operator panel in English — Phase 2 (bookings, calendar, units, beach seller) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the bookings, calendar, units and beach-seller screens of the operator panel into English, keeping DE and NL in step. The beach seller's screens (`/vendedor/*`) get the language switch.

**Architecture:**
- Reuse the phase 1 and phase 4 foundations:
  - `useT()` / `getT()` and the translation files;
  - `utils/formatoLingua.js` (`formatarNumero`, `formatarData`, `useLingua`);
  - `utils/mensagemErro.js`;
  - `utils/rotuloMes.js`;
  - the label helpers in `pages/financial/shared.jsx` (`rotuloMetodo`, `rotuloEstadoPagamento`, `rotuloCanal`);
  - the glossary in `docs/glossario-ingles-painel.md`;
  - the guard test `__tests__/painelSemPortuguesFixo.test.js` with `FICHEIROS_CONVERTIDOS` and its hard-coded `'pt-PT'` check;
  - `components/shared/LanguageToggle.jsx` (`variant="white"` as in `StaffPortal.jsx`).
- Each task converts one area, adds its files to `FICHEIROS_CONVERTIDOS`, and pins PT next to EN.
- Label helpers are keyed by the stored value, the pattern phase 4 used (`rotuloCargo`, `rotuloTipo`). In PT they return today's text exactly.

**Tech Stack:** React 18, vitest, existing `frontend/src/i18n` (pt/en/de/nl json).

**Spec:** `docs/superpowers/specs/2026-11-22-painel-ingles-design.md`. Its "Owner answer" and "Builder-check rulings" sections are binding, in particular:
- ruling 1: the beach seller (`/vendedor/*`) gets the `LanguageToggle` in its header;
- ruling 4: printouts follow the panel language.

## Global Constraints

- **Work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`.** Never touch the old `C:\Users\RITS DELGADO\saldesk` folder.
- **Four languages for every new key:** PT, EN, DE, NL. `i18nParity.test.js` stays green (same keys, no empty texts, same `{{placeholders}}`).
- **PT must read exactly as today,** with accents (`acentosPainelOperador.test.js`). Existing tests asserting PT keep asserting the same PT.
- **Stored or compared values never change; only their labels are translated.** Examples in this zone:
  - tour difficulty `'Facil'`, `'Moderado'`, `'Dificil'` (`TourForm.jsx`, `UnitList.jsx` `DIFFICULTY_ROTULO`);
  - amenity lists `ROOM_AMENS` (`HotelRoomForm.jsx`), `CAR_AMENS` (`RentacarVehicleForm.jsx`), `RESTAURANT_AMENS` and `TABLE_ZONES` (`RestaurantTableForm.jsx`). These strings are saved in unit metadata and shown on the public pages, so they stay exactly as they are; a stored amenity that has no label (typed by the operator) shows as stored;
  - language codes `LANGUAGES` (`editors.jsx`) and option types `TIPOS` (`OpcoesActividade.jsx`);
  - booking statuses, payment status and method keys, channel/source keys, `FUEL_LEVELS` values (`pages/reservations/shared.jsx`: the numeric `value` stays, the `'Vazio'`/`'Cheio'` labels become keys).
- **Out of scope:**
  - content the operator writes (unit names, descriptions, default message templates) — spec non-goal;
  - the public-side helpers `utils/opcoesActividade.js`, `utils/politicaCancelamento.js`, `utils/pessoas.js`, `services/reservationRanges.js` and `components/servico/*` (public pages, already bilingual by their own `lang` argument);
  - `components/shared/StaffChat.jsx`, `components/messaging/*` and `pages/Pedidos.jsx` (phase 3).
- **Formatting:** every display date, number and money call in converted files goes through `formatoLingua.js`. No hard-coded `'pt-PT'` remains (the guard checks it). `en-CA` `YYYY-MM-DD` key builders stay as they are. Month-name arrays such as `MONTHS_PT` in `BeachSale.jsx` and `BeachSeller.jsx` go through `rotuloMes` or `formatarData`.
- **Server errors:** call sites that show server errors use `mensagemErro`; their PT fallback texts become keys.
- **Glossary:** English follows `docs/glossario-ingles-painel.md` (Booking, Unit, Guest, Customer, Operator, Voucher, Affiliate, Staff, Dashboard, Settings, Fleet, Plan…). Add new terms as they first appear, one line each (e.g. Beach seller, Meeting point, Pick-up, Drop-off, No-show, Manifest, Amenities, Difficulty, Option, Surcharge, Offer).
- **`components/ui/*` must not change.** The founder panel (`pages/admin/*`) and the backend are out of scope.
- **Code style:** comments in Portuguese without accents; keep each file's line endings (CRLF in many; use the Edit tool or Python preserving `\r\n`); no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `C:\Users\RITS DELGADO\saldesk-recuperacao\frontend`): `npx vitest run <file>`; full suite `npx vitest run`; build `npm run build`.

## Review Focus

1. **A label translated together with its stored value.** For example, a tour saved with `difficulty: 'Easy'`, an amenity saved as `'Sea view'`, or a fuel level saved as a label. Test per task: choose in EN and assert the saved value is the PT value.
2. **PT text or format changed** on a booking, calendar, unit or beach-seller screen. Tests: each task pins PT next to EN.
3. **The beach seller stuck in PT,** because `/vendedor/*` sits outside the layout. Test: Task 5 switches the language from the seller header, and the new-sale steps follow it.
4. **The printed manifest half translated:** the title and column headers in EN but dates or amounts in PT format, or the other way round. Test: Task 1 renders `ManifestoModal` in EN and PT.
5. **Booking amounts and dates still in PT format in EN** (booking detail, car-rental table, return modal, calendar). Test: Task 1 and Task 2 EN assertions on one amount and one date. The guard's `'pt-PT'` check covers the rest.

---

### Task 1: Bookings

**Files:**
- Modify: `frontend/src/pages/Reservations.jsx` and every file in `frontend/src/pages/reservations/*` (`ActivityTable`, `RestaurantTable`, `RentacarTable`, `ColumnCards`, `shared.jsx`, and the modals `DevolucaoModal`, `LevantamentoModal`, `NoShowModal`, `RescheduleModal`, `RestaurantCreateModal`, `ManifestoModal`).
- Modify: `frontend/src/components/reservations/*` (`ReservationForm`, `ReservationCard`, `ReservationDetailModal`, `StatusBadge`) and `frontend/src/components/assignments/AssignCompositeModal.jsx`.
- Modify: the i18n json files (e.g. `reservations.*`, extending what exists), the guard list and the glossary.
- Test: extend `Reservations.test.jsx`, `ReservationsActivityTable.test.jsx`, `ReservationsRentacarTable.test.jsx`, `ReservationsRestaurantTable.test.jsx`, `ReservationsModals.test.jsx`, `ReservationsMobileCards.test.jsx`, `ReservationForm.test.jsx`.

**Interfaces:**
- Produces: `rotuloNivelCombustivel(valor, t)` in `pages/reservations/shared.jsx` (numeric value in, label out); `FUEL_LEVELS` keeps its numeric values.

- [ ] **Step 1: Write the failing tests:**
  - in EN, the bookings list, each table, each modal and the booking form and detail show English labels and no Portuguese (`portuguesNoEcra` is empty, `chavesCruas` is empty); in PT, the same screens are unchanged;
  - in EN, recording a car return with fuel "Full" sends the stored numeric value `4`;
  - `ManifestoModal` in EN shows an English title and column headers with an `en-GB` date; in PT it shows today's text and a `pt-PT` date;
  - the booking detail in EN shows an amount as `€1,234` (PT keeps `€1 234`);
  - the guard passes for the converted files.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Reservations ReservationForm`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: reservas, modais e manifesto em ingles`.

### Task 2: Calendar

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx` and `frontend/src/components/calendar/CalendarView.jsx`.
- Modify: the i18n json files, the guard list.
- Test: extend `Calendar.test.jsx`.

- [ ] **Step 1: Write the failing tests:**
  - in EN the calendar (month and day views, legend, booking popover, filters) shows English labels and no Portuguese; in PT it is unchanged;
  - month and weekday names follow the language (EN `November`, PT `novembro` as today);
  - the guard passes, including its `'pt-PT'` check for these files.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Calendar`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: calendario em ingles`.

### Task 3: Activity unit form

**Files:**
- Modify: `frontend/src/components/units/forms/TourForm.jsx`, `editors.jsx` (itinerary, inclusions, stops, languages, templates editors), `OpcoesActividade.jsx` (options, language surcharge, offers), `LocalizacaoPontoEncontro.jsx` (meeting point map).
- Modify: the i18n json files (e.g. `units.tour.*`), the guard list and the glossary.
- Test: extend `TourFormOpcoes.test.jsx`, `UnitForm.test.jsx`, `TemplatesEditor.test.jsx`.

**Interfaces:**
- Produces: `rotuloDificuldade(valor, t)` exported from a shared place both `TourForm.jsx` and `UnitList.jsx` import (Task 4 consumes it). Unknown values return the value itself.

- [ ] **Step 1: Write the failing tests:**
  - in EN the activity form, every editor, the options/surcharge/offers block and the meeting-point map show English labels and no Portuguese; in PT they are unchanged;
  - choosing difficulty "Hard" in EN saves `difficulty: 'Dificil'`, and an existing `'Moderado'` unit shows "Moderate" in EN;
  - choosing an option type in EN saves the stored id (`'per_group'`);
  - form validation messages follow the language;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo TourFormOpcoes UnitForm TemplatesEditor`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Default message templates stay PT (operator content, spec non-goal); only the editor's own labels are translated.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: formulario de actividade, opcoes e ponto de encontro em ingles`.

### Task 4: Units page and other unit forms

**Files:**
- Modify: `frontend/src/pages/Units.jsx`, `frontend/src/components/units/UnitList.jsx`, `UnitForm.jsx`, and `forms/HotelRoomForm.jsx`, `forms/RentacarVehicleForm.jsx`, `forms/RestaurantTableForm.jsx`, `forms/GenericUnitForm.jsx`.
- Modify: the i18n json files (e.g. `units.*`, `units.amenities.*`, `units.zones.*`), the guard list.
- Test: extend `Units.test.jsx`, `UnitForm.test.jsx`, `UnitFormsResponsive.test.jsx`.

**Interfaces:**
- Consumes: `rotuloDificuldade(valor, t)` from Task 3.
- Produces: `rotuloComodidade(valor, t)` and `rotuloZonaMesa(valor, t)` (stored value in, label out; unknown values return the value).

- [ ] **Step 1: Write the failing tests:**
  - in EN the units page, the unit list and each form (hotel room, car, restaurant table, generic) show English labels and no Portuguese; in PT they are unchanged;
  - ticking the amenity shown as "Sea view" in EN saves `'Vista mar'`; ticking "Baby seat" saves `'Cadeira bebe'`; choosing zone "Terrace" saves `'terraco'`;
  - an operator-typed amenity that is not in the lists shows as stored in both languages;
  - the guard passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo Units UnitForm UnitFormsResponsive`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: unidades e formularios de quarto, viatura e mesa em ingles`.

### Task 5: Beach seller

**Files:**
- Modify: `frontend/src/pages/BeachSeller.jsx`, `BeachSale.jsx`, `VendedorPerfil.jsx`. Each header gets `LanguageToggle` (spec ruling 1).
- Modify: the i18n json files (e.g. `beachSeller.*`), the guard list and the glossary (Beach seller, Commission…).
- Test: extend `BeachSale.test.jsx`; add EN render tests for `BeachSeller` and `VendedorPerfil`.

- [ ] **Step 1: Write the failing tests:**
  - in EN the seller home, the new-sale flow (all three steps) and the seller profile show English labels and no Portuguese; in PT they are unchanged;
  - the language switch in the seller header changes the screen to EN, and the new-sale steps follow it;
  - month names and amounts follow the language (EN `€1,234`);
  - a sale made in EN sends the same payload as in PT (no translated value in it);
  - the guard passes, including its `'pt-PT'` check.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run painelSemPortuguesFixo BeachSale BeachSeller VendedorPerfil`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and the build. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: vendedor de praia em ingles, com botao de lingua`.

# Activity options, language surcharge and offers (part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** add three things to activities, all priced by the one shared server function and shown on the public column, the operator form, the operator booking screens and the Discover "desde" price:
- options (per person, per group, or per vehicle with seats);
- a fixed guide-language surcharge per booking;
- automatic date offers with the old price struck through.

**Architecture:**
- Options, surcharges and offers live in the unit's description JSON (`meta.options`, `meta.language_surcharges`, `meta.offers`). There is no migration.
- Pure helpers in `backend/src/helpers/opcoesActividade.js` decide the option, vehicles, surcharge and offer. `precoActividade` uses them for the lines.
- A new async helper `escolherDesconto` picks the better of offer and voucher, for both the quote and `criarReserva`.
- The frontend mirrors only what it needs for display (`frontend/src/utils/opcoesActividade.js`). The server is always the authority on price.

**Tech Stack:** Express + Supabase (jest), React 18 + Tailwind (vitest), static Discover site (node --test).

**Spec:** `docs/superpowers/specs/2026-11-21-opcoes-idioma-ofertas-design.md`. Its "Builder-check rulings" and "4b" override the earlier Goals where they differ.

## Global Constraints

### Data shapes (`meta`)

- **`meta.options`:** `[{ id, name_pt, name_en, type: 'per_person'|'per_group'|'per_vehicle', price, price_child, seats }]`.
  - `price` > 0.
  - `price_child` is optional and applies to `per_person` only.
  - `seats` is an integer ≥ 1 and applies to `per_vehicle` only.
- **`meta.language_surcharges`:** e.g. `{ "ES": 20 }`. The value is a fixed amount per booking; 0 or a missing key means none.
- **`meta.offers`:** `[{ percent, from, to, label_pt, label_en }]`.
  - `percent` is an integer from 1 to 90.
  - `from` and `to` are inclusive dates, `YYYY-MM-DD`, with `from` ≤ `to`.
  - Labels are optional.

### Rules

- **Options replace the price table:** `base_price`, `price_child`, `price_private`, `price_tiers` and the per-person/private toggle are ignored on the public page and in the price whenever `meta.options` is non-empty.
- **Mode follows the option type:** `per_group` is the exclusive private mode (`mode: 'private'`, `is_group_booking: true`). `per_person` and `per_vehicle` are `per_person` and count people against `unit.capacity`.
- **Vehicles:** minimum ⌈people ÷ seats⌉, maximum people. The server clamps the requested number into that range. A missing request means the minimum.
- **Guide language:**
  - "Sem preferência" (empty) is free.
  - A code the activity does not offer counts as no preference.
  - When `meta.languages` has exactly one language and it has a surcharge, the server defaults `guideLanguage` to it, in both the quote and the POST.
- **Discounts:**
  - An offer applies when `date` is within `[from, to]`; the highest percent wins.
  - An offer and a voucher never add up: the bigger discount wins.
  - The discount applies to the total including the surcharge.
  - When the code loses, the quote returns `voucher_ignored: true` and the POST ignores the code completely (no 400, no `voucher_id`, no use recorded).
  - `before` is the pre-discount total, for both offers and codes.
- **Quote lines:**
  - option `per_person`: `{ type:'option', description:<name_pt>, quantity:adults, total }`, plus `{ type:'children', … }` when there are children;
  - option `per_group`: `{ type:'option', quantity:people }`;
  - option `per_vehicle`: `{ type:'vehicles', description:<name_pt>, quantity:vehicles, total }`;
  - surcharge: `{ type:'language', description:'Suplemento de idioma (<CODE>)', quantity:1, total }`;
  - discount: `{ type:'discount', source:'offer'|'voucher', description, quantity:1, total:-x }`.
- **Booking notes,** written by the server: `Opção: <name_pt>`, plus `Veículos: N` for per-vehicle options. They are joined with `' | '` like the other notes lines. The guide language keeps its existing `Idioma:` text.

### Request fields

- **Quote:** `option`, `vehicles`, `glang`, `date` (plus the existing `adults`, `children`, `mode`, `voucher`).
- **Public POST:** `option_id`, `vehicles`, `guide_language`.
- **Operator POST:** `option_id`, `vehicles`.
- All are optional. Activities without options behave exactly as today.

### Copy (PT / EN)

| Use | PT | EN |
|---|---|---|
| `OPTION_REQUIRED` | Escolha uma opção | Choose an option |
| `voucher_ignored` message | Já existe uma oferta melhor; o código não foi aplicado | A better offer already applies; the code was not used |
| Units | por pessoa / por grupo / por veículo (N lugares) | per person / per group / per vehicle (N seats) |
| Default offer label | Oferta especial (-25%) | Special offer (-25%) |
| Offer badge | -25% de 1 a 15 dez | -25% from 1 to 15 Dec |
| Surcharge line | Suplemento de idioma (Español) | Language surcharge (Spanish) |
| Form note when options exist | As opções substituem a tabela de preços na página pública. | Options replace the price table on the public page. |

### Project rules

- Prices are in the operator's currency, as today.
- "Today" and offer dates use Cape Verde time (`hojeEHoraCaboVerde`).
- European Portuguese with accents, no emojis.
- `frontend/src/components/ui/*` must not change.
- Operator form strings go into `frontend/src/i18n/{pt,en,de,nl}.json`; `i18nParity` must stay green.
- Never start the real backend; no migration.
- Keep each file's line endings (some are CRLF; use the Edit tool).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Commands

- Backend: `cd backend && npx jest <file>`; full suite `cd backend && npx jest`.
- Frontend: `cd frontend && npx vitest run <file>`; full suite `cd frontend && npx vitest run`; build `cd frontend && npm run build`.
- Site: `node --test "tests/website/*.test.js"` (from the repo root).

## Review Focus

1. **An activity without options must price, book and display exactly as before.**
   - Per person, private, tiers, child price, the price-less activity, and old payloads with only `guests` are unchanged.
   - Tests: Task 1 "sem opcoes nada muda" and Task 2 "post antigo continua igual".
2. **A per-vehicle request out of range is clamped, never charged wrong.** For example, 5 people with 2 seats asking for 1 vehicle are charged for 3 vehicles.
   - Tests: Task 1 vehicle clamp cases, and the Task 2 quote-equals-charge pin with vehicles.
3. **A per-group option takes the whole slot.** A second booking in that slot is refused, and the calendar strikes the day, as with today's private mode.
   - Test: Task 2 "opcao por grupo ocupa o horario inteiro".
4. **An offer that ends yesterday never shows or applies.** "Today" is Cape Verde time, so an offer ending today is still current at 23:30 in Cape Verde.
   - Tests: Task 1 `melhorOferta` and `ofertaActual` boundary cases.
5. **A code that loses to an offer is not used up and does not fail an exhausted-code booking.**
   - Test: Task 2 "codigo pior que a oferta e ignorado no POST".

---

### Task 1: Pure option, surcharge and offer helpers, and `precoActividade` with options

**Files:**
- Create: `backend/src/helpers/opcoesActividade.js`
- Modify: `backend/src/helpers/bookingHelpers.js` (`precoActividade`, about line 126)
- Test: `backend/src/__tests__/opcoesActividade.test.js`, `backend/src/__tests__/precoActividadeOpcoes.test.js`

**Interfaces:**
- Produces (`opcoesActividade.js`):
  - `opcoesDaActividade(meta) -> Array`: valid options only (known type, price > 0, `seats` ≥ 1 for per vehicle), numbers coerced.
  - `opcaoEscolhida(meta, optionId) -> option | null`.
  - `opcaoMaisBarata(meta) -> option | null`.
  - `limitarVeiculos(seats, pessoas, pedido) -> number`.
  - `idiomaEfectivo(meta, codigo) -> string | null`: applies the "unknown = none" and "single language with surcharge = default" rules.
  - `suplementoIdioma(meta, codigo) -> number`.
  - `melhorOferta(meta, date) -> offer | null`.
  - `ofertaActual(meta, hoje) -> offer | null`: among offers with `to` ≥ `hoje`, the one ending first.
- Produces (`bookingHelpers.js`):
  - Signature: `precoActividade(unit, meta, { adults, children, mode, optionId, vehicles, guideLanguage }) -> { total, lines, error, mode, vehicles, option, guideLanguage }`.
  - With options it ignores the table and the `mode` argument. The returned `mode` is `'private'` for per group, else `'per_person'`. The returned `vehicles` is the clamped count.
  - A missing or unknown option gives error `OPTION_REQUIRED` with `total: 0`.
  - The surcharge line is added after the option or table lines and before the capacity check, with or without options.
  - Offers and vouchers are NOT applied here (Task 2).
  - `MIN_ADULTS` and `CAPACITY_EXCEEDED` keep working. `NO_PRICE_FOR_GROUP` stays for table-private only.

- [ ] **Step 1: Write the failing tests.**
  - **`opcoesActividade.test.js`:**
    - `limitarVeiculos(2, 5, 1) === 3`, `limitarVeiculos(2, 5, 9) === 5`, `limitarVeiculos(2, 4, undefined) === 2`, `limitarVeiculos(2, 2, 2) === 2`.
    - `opcoesDaActividade` drops `{type:'per_vehicle', price:50}` (no seats) and `{type:'per_person', price:0}`.
    - `opcaoMaisBarata` picks the lowest price.
    - `idiomaEfectivo({languages:['ES'], language_surcharges:{ES:20}}, '') === 'ES'`.
    - `idiomaEfectivo({languages:['PT','ES']}, 'XX') === null`.
    - `suplementoIdioma({language_surcharges:{ES:20}}, 'ES') === 20`.
    - `melhorOferta`: two overlapping offers 10% and 25% on `2026-12-05` give 25. `to:'2026-12-04'` does not apply on `2026-12-05`, and `from`/`to` are inclusive.
    - `ofertaActual(meta, '2026-12-05')` ignores an offer with `to:'2026-12-04'`, and returns the one ending first among two current offers.
  - **`precoActividadeOpcoes.test.js`:**
    - "sem opcoes nada muda": a snapshot of today's outputs for per person, children, private tier, `MIN_ADULTS` and `CAPACITY_EXCEEDED` equals the new outputs.
    - per person option 30 € with child price 20 €, 2 adults + 1 child: `total 80`, lines `option ×2 = 60`, `children ×1 = 20`.
    - per group option 200 €, 5 people: `total 200`, `mode 'private'`.
    - per vehicle option 90 €, 2 seats, 5 people, vehicles 1: `vehicles 3`, `total 270`, `type 'vehicles'`.
    - unknown `optionId` on an activity with options: `error.code 'OPTION_REQUIRED'` and `total 0`.
    - surcharge ES 20 € with `guideLanguage 'ES'` adds a `language` line and `total` + 20; with `guideLanguage ''` (and two languages) there is no line.
- [ ] **Step 2: See them fail.** Run `cd backend && npx jest opcoesActividade precoActividadeOpcoes`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** the helpers and extend `precoActividade`. Keep the existing branches byte-for-byte for activities without options.
- [ ] **Step 4: See them pass.** Run the same command, then the full backend suite. Expected: PASS, and the existing `precoActividade` tests are still green.
- [ ] **Step 5: Commit.** Message: `feat: opcoes e suplemento de idioma no preco partilhado das actividades`.

### Task 2: Offer and voucher choice; quote and public booking

**Files:**
- Create: `backend/src/helpers/descontoActividade.js`
- Modify: `backend/src/controllers/publicController.js`:
  - `cotarActividade` (about line 1306);
  - `criarReserva` (the activity block around line 464, the voucher block, the notes composition, and the insert's `is_group_booking`);
  - `getAvailabilityMonth` / `getSlotAvailability`, only if they need the option's mode (the column passes `mode`).
- Modify: `backend/src/helpers/lugarRetido.js` (`classificarRecentes` compares the option)
- Test: `backend/src/__tests__/descontoActividade.test.js`, `backend/src/__tests__/cotacaoOpcoes.test.js` (quote and POST together, with the mocks style of `criarReservaRetencao.test.js`), and extend `backend/src/__tests__/reservaDuplicada.test.js`

**Interfaces:**
- Consumes: Task 1 (`precoActividade` new signature and return; `melhorOferta`).
- Produces: `escolherDesconto({ operatorId, unitId, meta, total, date, voucherCode }) -> Promise<{ total, before, line, voucherId, voucherIgnored, error }>`.
  - It uses the existing `validarVoucher(operatorId, code, unitId, amount)`.
  - It never records voucher use. `criarReserva` keeps its existing voucher-use rules (immediate for cash, deferred for cards), driven by the returned `voucherId`.
  - An invalid code with no better offer gives `error { code:'INVALID_VOUCHER', … }` as today.
  - When the offer wins, `voucherId` is null and `voucherIgnored` is true, and an invalid or exhausted code produces no error.
- Quote response: `{ lines, total, before, error, voucher_ignored }`.
- `criarReserva`:
  - reads `option_id`, `vehicles` and `guide_language`;
  - for activities with options, the booking mode and `is_group_booking` come from `precoActividade`'s returned `mode`, and the `INVALID_BOOKING_MODE` / `temPrecoPrivadoConfigurado` check is skipped;
  - the slot and day availability use the returned mode and people;
  - the notes gain `Opção:` and `Veículos:` lines;
  - `Idioma:` uses the effective language when the request had none.

- [ ] **Step 1: Write the failing tests.**
  - **`descontoActividade.test.js`:**
    - offer 25% on a total of 290 gives `total 217.5`, `before 290`, and a line with `source 'offer'` and description "Oferta especial (-25%)", or the label when set;
    - a valid code worth 100 against a 25% offer on 290 (72.5): the code wins, `source 'voucher'`;
    - a code worth 50 against the same offer: the offer wins, `voucherIgnored true`, `voucherId null`;
    - an exhausted code plus an offer: the offer wins with no error;
    - an exhausted code with no offer: `INVALID_VOUCHER`.
  - **`cotacaoOpcoes.test.js`:**
    - "quote igual ao cobrado com opcao, veiculos, idioma e oferta": the same inputs to `/quote` and `criarReserva` give `quote.total === inserted.total_price`. Cases: per person, per group, and per vehicle with clamped vehicles plus the ES surcharge plus an offer on the chosen date.
    - "opcao por grupo ocupa o horario inteiro": the slot check receives `isGroupBooking true` and the insert has `is_group_booking: true`.
    - "post antigo continua igual": an activity without options and a payload with only `guests` gives today's total and notes.
    - "codigo pior que a oferta e ignorado no POST": no 400 even if the code is exhausted, `voucher_id` null, `registarUsoVoucher` not called.
    - "notas com opcao e veiculos": the insert's notes contain `Opção: Buggy 2h` and `Veículos: 3`.
    - `OPTION_REQUIRED` on POST without `option_id` for an activity with options gives 400 with the PT message.
  - **`reservaDuplicada.test.js`:** an identical booking except the option (different `Opção:` line, same price) is not returned as a duplicate.
- [ ] **Step 2: See them fail.** Run `cd backend && npx jest descontoActividade cotacaoOpcoes reservaDuplicada`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Replace the duplicated voucher code in `cotarActividade` and `criarReserva` with `escolherDesconto`.
- [ ] **Step 4: See them pass.** Run the same command, then the full backend suite, including `pagamentoValorServidor`, `criarReservaRetencao` and `reservaDuplicada`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: ofertas automaticas e opcoes na cotacao e na reserva publica`.

### Task 3: Frontend option helpers and the activity form

**Files:**
- Create: `frontend/src/utils/opcoesActividade.js`
- Modify: `frontend/src/components/units/forms/TourForm.jsx` (three new sections; on save, when options exist, `base_price` = cheapest option price)
- Modify: `frontend/src/i18n/{pt,en,de,nl}.json` (form labels)
- Test: `frontend/src/__tests__/opcoesActividadeUtil.test.js`, `frontend/src/__tests__/TourFormOpcoes.test.jsx`

**Interfaces:**
- Produces (`utils/opcoesActividade.js`):
  - `opcoesValidas(meta) -> Array`: same filter as the backend.
  - `nomeOpcao(op, lang) -> string`: EN falls back to PT.
  - `unidadeOpcao(op, lang) -> string`: the units copy.
  - `limitarVeiculos(seats, pessoas, pedido) -> number`.
  - `precoEstimado(op, { adults, children, vehicles }) -> number`: for operator previews only.
  - `opcaoMaisBarata(meta) -> option | null`.
  - `ofertaActual(meta, hoje) -> offer | null`.
  - `textoOferta(offer, lang) -> string`: the badge copy, e.g. "-25% de 1 a 15 dez".
  - `novoIdOpcao() -> string`: a short random id.
- `TourForm` writes `meta.options`, `meta.language_surcharges` and `meta.offers`. Validation errors show on the row and block saving:
  - price > 0;
  - seats ≥ 1 for per vehicle;
  - percent from 1 to 90;
  - `from` ≤ `to`.

  Option ids stay stable across edits.

- [ ] **Step 1: Write the failing tests.**
  - **Util:** each function's cases. `textoOferta({percent:25, from:'2026-12-01', to:'2026-12-15'}, 'pt') === '-25% de 1 a 15 dez'`; `'en'` gives `'-25% from 1 to 15 Dec'`. `limitarVeiculos` uses the same cases as the backend.
  - **TourForm:**
    - adding a per-vehicle option without seats shows the error and blocks save;
    - saving two options (40 and 30) writes `base_price` 30 and `meta.options` with both ids kept on re-save;
    - the surcharge field appears only for selected languages and saves `{ES:20}`;
    - an offer with `from` > `to` blocks save;
    - the "options replace the price table" note shows only when options exist.
- [ ] **Step 2: See them fail.** Run `cd frontend && npx vitest run opcoesActividadeUtil TourFormOpcoes`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: See them pass.** Run the same command, then the full frontend suite, including `i18nParity`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: formulario da actividade com opcoes, suplemento por idioma e ofertas`.

### Task 4: Public booking column and modal

**Files:**
- Modify: `frontend/src/components/servico/ReservaActividade.jsx`:
  - an option step first when options exist, replacing the per-person/private toggle;
  - the vehicle counter;
  - the surcharge in the language select;
  - the offer badge in the header;
  - the struck `before` in the price box;
  - the `voucher_ignored` message;
  - option-aware "desde";
  - `semPreco` / `temPorPessoa` checks options first;
  - the quote and calendar pass `option`, `vehicles`, `glang`, `date`, and the option's mode.
- Modify: `frontend/src/pages/ServiceDetail.jsx`:
  - `ActivityModal`: the payload gains `option_id`, `vehicles` and `guide_language`, and forwards `voucher_code` only when the winning discount line has `source === 'voucher'`;
  - `textoDaLinha` / `rotuloDaLinha` label the `option`, `vehicles`, `language` and offer-discount lines.
- Test: extend `frontend/src/__tests__/ReservaActividade.test.jsx` and `frontend/src/__tests__/ServiceDetail.test.jsx`

**Interfaces:**
- Consumes: Task 2 (quote contract and POST fields) and Task 3 (`opcoesValidas`, `nomeOpcao`, `unidadeOpcao`, `limitarVeiculos`, `ofertaActual`, `textoOferta`).
- The `onReservar` selection gains `optionId`, `vehicles` and `guideLanguage`. The existing `language` is kept for the notes text.

- [ ] **Step 1: Write the failing tests:**
  - the option step lists the options with their unit text, the first is selected, and the toggle is absent;
  - choosing a per-vehicle option shows "Veículos" with min 3 for 5 people and 2 seats;
  - the quote URL contains `option=`, `vehicles=3`, `glang=ES` and `date=`;
  - the language select shows "Español (+20 €)";
  - an activity with one surcharged language has no "Sem preferência";
  - the offer badge shows "-25% de 1 a 15 dez" for an offer whose `to` is today or later, and nothing for an expired offer;
  - with a quote `before: 290`, the price box shows 290 struck next to the total;
  - `voucher_ignored` shows the PT message;
  - the modal POST contains `option_id`, `vehicles` and `guide_language`, and omits `voucher_code` when the discount line's source is `offer`;
  - an activity without options renders exactly as before: the existing tests stay green.
- [ ] **Step 2: See them fail.** Run `cd frontend && npx vitest run ReservaActividade ServiceDetail`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: See them pass.** Run the same command, then the full frontend suite and the build. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: coluna de reserva com opcoes, veiculos, suplemento de idioma e ofertas`.

### Task 5: Operator and beach-sale bookings

**Files:**
- Modify: `backend/src/controllers/reservationsController.js` (the create path around line 138-185):
  - read `option_id` and `vehicles`;
  - for activities with options, call `precoActividade` with the chosen option, or with `opcaoMaisBarata(meta).id` when none is sent;
  - use the returned `mode` for `is_group_booking` and the slot check;
  - append the `Opção:` and `Veículos:` notes lines;
  - never refuse because of price (ruling R1).
- Modify: `frontend/src/components/reservations/ReservationForm.jsx` (the option select and vehicle field for activities with options; the price preview via `precoEstimado`).
- Modify: `frontend/src/pages/BeachSale.jsx` (the same: option choice and vehicles; the shown price from `precoEstimado`; the list's "desde" uses the cheapest option).
- Test: `backend/src/__tests__/reservaOperadorOpcoes.test.js`, and extend `frontend/src/__tests__/ReservationForm.test.jsx` plus the BeachSale tests (find the existing file; create `BeachSaleOpcoes.test.jsx` if there is none).

**Interfaces:**
- Consumes: Task 1 (`precoActividade`, `opcaoMaisBarata`) and Task 3 (`opcoesValidas`, `nomeOpcao`, `unidadeOpcao`, `limitarVeiculos`, `precoEstimado`).

- [ ] **Step 1: Write the failing tests:**
  - **Backend:**
    - the operator POST with `option_id` for a per-vehicle option and 5 people / 2 seats saves `total_price` 270 and notes with `Veículos: 3`;
    - without `option_id` it uses the cheapest option and never answers 4xx for price;
    - a per-group option saves `is_group_booking true`.
  - **Frontend:**
    - the ReservationForm for an activity with options shows the option select and sends `option_id` and `vehicles`, and the preview equals `precoEstimado`;
    - an activity without options is unchanged;
    - BeachSale shows the options for the selected tour and sends `option_id`.
- [ ] **Step 2: See them fail.** Run `cd backend && npx jest reservaOperadorOpcoes` and `cd frontend && npx vitest run ReservationForm BeachSale`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: See them pass.** Run the same commands, then both full suites. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: reservas do operador e venda de praia escolhem a opcao da actividade`.

### Task 6: "Desde" price with options on the Discover and in the shared display price

**Files:**
- Modify: `website/discover/_cartao.js` (`precoCartao`: when `meta.options` has valid options, return the cheapest with unit `'pessoa' | 'grupo' | 'veiculo'`; bump the version string `?v=` in the pages that load it)
- Modify: the Discover card unit text where `unidade` is rendered (`website/discover/index.html` or `_cartao.js`): "por veículo" / "per vehicle"
- Modify: `backend/src/controllers/catalogImageController.js` (`displayPrice` considers the cheapest option first, so the "never differ" comment stays true)
- Test: extend the site tests in `tests/website/` that cover `precoCartao`, and the backend tests that cover `displayPrice` (find them; add `displayPriceOpcoes.test.js` if there are none)

**Interfaces:**
- Consumes: the option shape from the Global Constraints. The site cannot import the backend or frontend helpers, so the filter (known type, price > 0, `seats` ≥ 1 for per vehicle) is restated inline.

- [ ] **Step 1: Write the failing tests:**
  - `precoCartao` with options 40 per person and 120 per group returns `{ valor: 40, unidade: 'pessoa' }`;
  - only a per-vehicle option at 90 returns `unidade 'veiculo'`;
  - no options keeps today's results;
  - `displayPrice` with options returns the cheapest option price.
- [ ] **Step 2: See them fail.** Run `node --test "tests/website/*.test.js"` and `cd backend && npx jest displayPrice`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: See them pass.** Run the same commands, then the full backend suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: preco desde do Discover considera as opcoes da actividade`.

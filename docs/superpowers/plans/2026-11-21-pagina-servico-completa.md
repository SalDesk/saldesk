# Complete activity page with Logan-style booking (part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The activity service page (`/book/:slug/servico/:id`) becomes the complete Logan-style page, in the Discover's look. It has:
- every content section, each hidden when empty;
- a sticky booking column with:
  - a month calendar with struck days;
  - slots showing "Only N left";
  - a server-computed price.

**Architecture:**
- **Backend:** one shared price function, `precoActividade`, is used by `/quote`, the public POST and the operator POST, so the shown price and the charged price can never differ. Two read-only endpoints are added: `availability-month` and `quote`. `slot-availability` gains the "already started" rule.
- **Frontend:** the activity part of `ServiceDetail.jsx` is split into components under `components/servico/`. Pure rules live in `utils/paginaActividade.js`. The booking column hands its selection to the existing `ActivityModal`, which opens at the customer-details step.

**Tech Stack:**
- Backend: Express, Supabase, jest.
- Frontend: React 18, Tailwind (tokens `brand-*`, `ocean-*`, `sand-*`), vitest, react-leaflet (already used).

**Spec:** `docs/superpowers/specs/2026-11-21-pagina-servico-completa-design.md` (approved 2026-11-21, including "Owner answers" and "Builder-check rulings").

## Global Constraints

**Scope**
- Activities only (`op.operator_type === 'activity'`).
- Hotels, cars and restaurants render exactly as today: same components, same modal.

**Code rules**
- `frontend/src/components/ui/*` must not change.
- No emojis.
- European Portuguese with accents in new PT text.
- PT and EN through the page's existing `lang` variable.
- Preserve CRLF line endings where files have them.

**Price**
- Per-person total = adults × `base_price` + children × (`meta.price_child` if set, else `base_price`).
- Private total = `calcularPrecoPrivado(meta, adults+children)`.
- Round to cents.

**Refusals (both `/quote` and POST)**

| Case | Condition | Response | Message |
|---|---|---|---|
| Over capacity | adults+children > `unit.capacity` (when capacity > 0) | 400 `CAPACITY_EXCEEDED` | "Este grupo excede a lotação desta actividade" / "This group exceeds this activity's capacity" |
| Private with no price | private mode, no band covers the party and no `price_private` | 400 `NO_PRICE_FOR_GROUP` | "Para este número de pessoas, contacte o operador" / "For this group size, please contact the operator" |
| Slot already started | the slot's start time today in Cape Verde (`Atlantic/Cape_Verde`) has passed | 409 `UNAVAILABLE` on POST; listed as unavailable in `slot-availability` | (none set) |

**POST payload compatibility**
- New optional integer fields `adults` and `children`.
- When they are missing, every person (`party_size || guests || 1`) counts as an adult.
- Every existing field keeps working.

**Theming:** keep `useBrandColor(op.brand_color)` and `brand-*` classes. The call to action uses `sand-500`.

**Responsive**
- No horizontal scroll at 375 px.
- The booking column is sticky at ≥1024 px.
- Below 1024 px there is a fixed bottom bar.

**Accessibility**
- `aria-live="polite"` on the calendar, the slots and the price.
- A visible focus state.
- `motion-reduce:` variants on transitions.

**Content:** never invent content. Every section is hidden when its data is empty.

**Deploy:** backups, backend before app; usual procedure in the project memory.

## Review Focus

1. **A party whose children push it over capacity.** The quote and the POST both refuse it with `CAPACITY_EXCEEDED`. Test in Task 1: `capacidade_conta_criancas`.
2. **An old cached page or an operator's site widget that posts without `adults`/`children`.** It is charged exactly as before (all adults). Test in Task 1: `post_sem_divisao_cobra_como_hoje`.
3. **Late evening in Cape Verde (UTC already the next day).** "Today" and "started" are decided in Cape Verde time, never UTC. Test in Task 2: `comecado_usa_hora_de_cabo_verde`.
4. **The voucher applied in the column but the booking never sends it.** The POST includes `voucher_code` and the review step shows the discounted quote. Test in Task 9: `voucher_da_coluna_vai_na_reserva`.
5. **A month where every day is struck.** The calendar moves to the next month once, on its own; when that month is also empty it stops and shows "Sem datas disponíveis neste mês" instead of looping. Test in Task 8: `mes_vazio_avanca_uma_vez`.

---

### Task 1: Shared activity price and refusals (backend)

**Files:**
- Modify: `backend/src/helpers/bookingHelpers.js`, `backend/src/controllers/publicController.js` (`criarReserva`), `backend/src/controllers/reservationsController.js` (per-person and private branches around lines 170–182)
- Test: `backend/src/__tests__/precoActividade.test.js`

**Interfaces:**
- Produces `precoActividade(unit, meta, { adults, children, mode }) -> { total: number, lines: Array<{type:'tour'|'children', description:string, quantity:number, total:number}>, error: null | {code:'CAPACITY_EXCEEDED'|'NO_PRICE_FOR_GROUP', message_pt:string, message_en:string} }`:
  - `mode` is `'per_person'` or `'private'`;
  - `lines` uses Portuguese descriptions (the frontend relabels by `type`).
- `criarReserva` reads `adults`, `children` from the body. For activity units it computes `total` via `precoActividade`; on `error` it returns 400 with `{ error: message_pt, code }`.

- [ ] **Step 1: Write the failing tests** in `precoActividade.test.js`:
  - `por_pessoa_com_preco_de_crianca`: unit `base_price: 40`, meta `{price_child: 25}`, `{adults:2, children:1, mode:'per_person'}`.
    - Expect total 105.
    - Expect a `children` line of total 25.
  - `por_pessoa_sem_preco_de_crianca`: meta `{}`, `{adults:2, children:1}`. Expect total 120.
  - `privado_por_escalao`: meta `{price_tiers:[{pax_min:1,pax_max:2,price:120},{pax_min:3,pax_max:4,price:150}]}`, `{adults:3, children:0, mode:'private'}`. Expect total 150.
  - `privado_fora_dos_escaloes_recusa`: same tiers, 5 people, no `price_private`. Expect `error.code` `'NO_PRICE_FOR_GROUP'` and total 0.
  - `capacidade_conta_criancas`: `unit.capacity: 4`, `{adults:3, children:2}`. Expect `error.code` `'CAPACITY_EXCEEDED'`.
  - Using the jest supabase fake pattern from `discoverCatalog.test.js`, `criarReserva`:
    - `post_sem_divisao_cobra_como_hoje`: an activity unit `base_price 40`, `price_child 25`, body `{party_size:3}` with no adults/children. The inserted reservation has `total_price` 120.
    - `post_com_divisao_cobra_crianca`: body `{party_size:3, adults:2, children:1}`. `total_price` is 105.
    - `post_acima_da_capacidade_400`: returns 400 with code `CAPACITY_EXCEEDED`.
- [ ] **Step 2:** Run `npx jest src/__tests__/precoActividade.test.js` in `backend/`. Expected: FAIL (`precoActividade` is not a function).
- [ ] **Step 3: Implement.**
  - Add `precoActividade` to `bookingHelpers.js` and export it.
  - In `criarReserva`, activity units use `precoActividade` in place of the `isGroupBooking` / same-day `base_price * numPessoas` branches; the refusal is checked before the availability check.
  - In `reservationsController.js`, use `precoActividade(unit, meta, { adults: guests, children: 0, mode })`.
- [ ] **Step 4:** Run the file, then the full backend suite (`npx jest`). Expected: all pass.
- [ ] **Step 5: Commit:** `feat: preco de actividade partilhado (crianca, capacidade, escaloes)`.

### Task 2: Slots already started (backend)

**Files:**
- Modify: `backend/src/helpers/bookingHelpers.js`, `backend/src/controllers/publicController.js` (`getSlotAvailability`, `criarReserva`)
- Test: `backend/src/__tests__/slotsComecados.test.js`

**Interfaces:**
- Produces `hojeEHoraCaboVerde(agora: Date) -> { hoje: 'YYYY-MM-DD', hora: 'HH:MM' }`.
- Produces `slotJaComecou(date: string, time: string, agora: Date) -> boolean`. True when `date < hoje`, or when `date === hoje` and `time <= hora`.
- `getSlotAvailability` adds `started: true` and `remaining: 0` to started slots (shape otherwise unchanged).
- `criarReserva` returns 409 `UNAVAILABLE` for a started slot.

- [ ] **Step 1: Failing tests:**
  - `comecado_usa_hora_de_cabo_verde`: `agora = new Date('2026-11-21T00:30:00Z')`, which is 23:30 on 2026-11-20 in Cape Verde.
    - `slotJaComecou('2026-11-20','23:00',agora)` is true.
    - `slotJaComecou('2026-11-21','09:00',agora)` is false.
  - `slot_disponivel_marca_comecados`: with a fake clock (`jest.useFakeTimers().setSystemTime`), today's 09:00 slot at 10:00 CV returns `started: true, remaining: 0`.
  - `post_em_slot_comecado_409`.
- [ ] **Step 2:** Run the file. Expected: FAIL.
- [ ] **Step 3:** Implement with `toLocaleString('en-CA', { timeZone:'Atlantic/Cape_Verde', hour12:false })` parts. Never use the server's local time.
- [ ] **Step 4:** Run the file and the full suite. Expected: pass.
- [ ] **Step 5: Commit:** `feat: horarios ja comecados deixam de se poder reservar`.

### Task 3: `availability-month` endpoint (backend)

**Files:**
- Modify: `backend/src/helpers/bookingHelpers.js`, `backend/src/controllers/publicController.js`, `backend/src/routes/public.js` (route next to `slot-availability`, with `publicLimiter`)
- Test: `backend/src/__tests__/disponibilidadeMes.test.js`

**Interfaces:**
- Consumes `ocupacaoSlotsEmLote`, `diasBloqueadosEmLote`, `slotJaComecou` (Task 2).
- Produces `diasLivresDoMes(supabase, unit, meta, { month: 'YYYY-MM', pax: number, mode: 'per_person'|'private', agora: Date }) -> { month, days: { [date]: true } }`.
  - **With `meta.time_slots`:** a day is free when it is not blocked and some slot is not started and has room:
    - private needs occupancy 0;
    - per person needs `capacity - ocupados >= pax`.
  - **Without slots:** a day is free when it is not blocked, not past (CV date), and has no active reservation with `check_in` that day (statuses `pending`/`confirmed`/`checked_in`). This is today's one-booking-per-day rule.
- Route `GET /public/:slug/units/:unitId/availability-month?month=&pax=&mode=`:
  - 400 when `month` is not `YYYY-MM`;
  - 404 when the unit is not active.

- [ ] **Step 1: Failing tests:**
  - `dias_com_lugar_para_o_grupo`: slot 09:00 cap 4, 3 booked on the 10th, pax 2. The 10th is absent and the 11th is present.
  - `privado_precisa_de_slot_vazio`.
  - `dia_bloqueado_fica_de_fora`.
  - `sem_horarios_um_por_dia`: one booking on the 12th, so the 12th is absent.
  - `dias_passados_fora`: with the fake clock at 2026-11-20 CV, the 19th is absent.
  - `mes_invalido_400`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Make one query for the whole month; no per-day queries.
- [ ] **Step 4:** Run the file and the full suite. Expected: pass.
- [ ] **Step 5: Commit:** `feat: dias livres do mes para o calendario de reserva`.

### Task 4: `quote` endpoint and FAQ data (backend)

**Files:**
- Modify: `backend/src/controllers/publicController.js` (new `cotarActividade`; `getUnit` operator select gains `custom_faqs`), `backend/src/routes/public.js`
- Test: `backend/src/__tests__/cotacaoActividade.test.js`

**Interfaces:**
- Consumes `precoActividade` (Task 1) and `validarVoucher` (existing, same as `criarReserva`).
- Route `GET /public/:slug/units/:unitId/quote?adults=&children=&mode=&voucher=`.
- Response:
  - success: `{ lines, total, before: null, error: null }`;
  - voucher valid: a `{type:'discount', description:'Código <CODE>', quantity:1, total:-discount}` line, with `total` reduced and `before` set to the pre-discount total;
  - voucher invalid: `error: { code:'INVALID_VOUCHER', message_pt, message_en }`, and the lines are still returned without the discount;
  - price refusals: `error` from `precoActividade`, total 0.

- [ ] **Step 1: Failing tests:**
  - `cotacao_igual_ao_cobrado`: for three selections (per person with a child, private band, voucher), call `/quote` and then `criarReserva` with the same selection. Assert `quote.total === inserted.total_price`.
  - `voucher_invalido_mantem_preco_e_avisa`.
  - `capacidade_excedida_devolve_erro`.
  - `getunit_traz_faqs_do_operador`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the file and the full suite. Expected: pass.
- [ ] **Step 5: Commit:** `feat: cotacao da reserva de actividade calculada no servidor`.

### Task 5: Highlights and What to bring in the activity form

**Files:**
- Modify: `frontend/src/components/units/forms/TourForm.jsx`
- Test: `frontend/src/__tests__/UnitForm.test.jsx`

**Interfaces:** produces meta fields `highlights_pt`, `highlights_en`, `what_to_bring_pt`, `what_to_bring_en` (strings; highlights are one per line). Empty saves `null`.

- [ ] **Step 1: Failing test** `destaques_e_o_que_levar_gravam`: type into "Destaques (PT)" two lines and into "O que levar (PT)". Saving produces `highlights_pt: 'A\nB'` and `what_to_bring_pt`. Empty fields produce `null`.
- [ ] **Step 2:** `npx vitest run src/__tests__/UnitForm.test.jsx` in `frontend/`. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Add four `Textarea`s right after the long descriptions.
  - Labels: "Destaques (PT) — um por linha", "Destaques (EN) — one per line", "O que levar (PT)", "O que levar (EN)".
  - Place them under a "Destaques e o que levar" sub-heading.
- [ ] **Step 4:** Run the file. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: destaques e o que levar no formulario de actividade`.

### Task 6: Pure rules for the activity page

**Files:**
- Create: `frontend/src/utils/paginaActividade.js`
- Test: `frontend/src/__tests__/paginaActividade.test.js`

**Interfaces (produces):**
- `textoEmBlocos(texto) -> Array<{tipo:'p', texto} | {tipo:'lista', itens:string[]}>`. A blank line separates blocks; consecutive lines starting with `- ` form a list.
- `linhasDestaques(meta, lang) -> string[]`. Uses the EN field in `'en'` and falls back to PT; empty lines are removed.
- `oQueLevar(meta, lang) -> string`. Order: `what_to_bring_<lang>` → the other language → `important_info` → `''`.
- `incluidos(meta, lang) -> { sim:string[], nao:string[] }`. Reads `included_items` objects `{label, included}` and legacy strings (strings count as `sim`).
- `factosActividade(unit, meta, lang) -> Array<{chave:'duracao'|'formato'|'linguas'|'recolha'|'saidas'|'grupo', valor:string}>`. Only facts with data. `saidas` joins `time_slots` times with " · ".
- `seccoesActividade({ meta, op, reviews, related, lang }) -> string[]`. The ids, in spec order, of the sections that have data:
  - `destaques`, `descricao`, `incluido`, `itinerario`, `levar`, `encontro`, `politicas`, `avaliacoes`, `perguntas`, `outros`.
- `precisaLerTudo(texto, limite = 600) -> boolean`.

- [ ] **Step 1: Failing tests:** one per function. Assert the exact outputs, including:
  - the empty-data cases: everything empty means `seccoesActividade` is `[]`;
  - EN falling back to PT;
  - legacy `included_items` strings counting as included.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: regras da pagina completa de actividade`.

### Task 7: Page sections for activities

**Files:**
- Create `frontend/src/components/servico/`:
  - `CabecalhoActividade.jsx`;
  - `GaleriaActividade.jsx` (reuses the existing `Lightbox`, moved here from `ServiceDetail.jsx`; hotels and cars import it from here);
  - `FactosActividade.jsx`;
  - `MenuSeccoes.jsx`;
  - `SeccoesActividade.jsx`, which renders highlights, description with "Ler tudo"/"Read all", included/not included, what to bring, policies and FAQ.
- Modify: `frontend/src/pages/ServiceDetail.jsx`.
  - When `isActivity`, render the new layout: a two-column grid at `lg`, with content left and an empty right column placeholder for Task 8.
  - The existing itinerary map, meeting-point section, reviews and related services move into this layout unchanged.
- Test: `frontend/src/__tests__/PaginaActividade.test.jsx` (fetch mocks as in `ServiceDetail.test.jsx`).

**Interfaces:**
- Consumes Task 6 functions and the existing page data: `unit`, `op` (now with `custom_faqs`), `reviews`, `classificacao`, `related`.
- Produces section DOM ids equal to the `seccoesActividade` ids, used by `MenuSeccoes`.

- [ ] **Step 1: Failing tests:**
  - `seccoes_sem_dados_nao_aparecem`: a unit with only a name and a price shows no "Destaques", "O que levar" or "Perguntas frequentes", and no menu entries for them.
  - `todas_as_seccoes_com_dados`: a full meta shows all headings in spec order, and the menu has one link per section.
  - `factos_mostram_saidas_e_grupo`: `time_slots` 09:00 and 14:00 and `capacity` 20 show "09:00 · 14:00" and "Até 20 pessoas".
  - `ler_tudo_abre_descricao_longa`.
  - `galeria_abre_e_fecha_com_esc`.
  - `hotel_continua_igual`: a hotel unit renders the old layout. Assert today's hotel heading and the absence of `MenuSeccoes`.
  - `perguntas_do_operador`: `op.custom_faqs` render as collapsible items.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Follow the Discover look: Sora headings (`font-display`), DM Sans body, `rounded-2xl` cards, `border-n-200`, `shadow-sm`, and the section menu sticky under the header.
  - The package's `standalone/tour-page.css` (scratchpad copy) is the visual reference only; do not import it.
- [ ] **Step 4:** Run the file, then the full frontend suite (`npx vitest run`) and `npm run build`. Expected: all pass.
- [ ] **Step 5: Commit:** `feat: pagina completa de actividade (seccoes, galeria, factos, menu)`.

### Task 8: Booking column, calendar, slots, quote, mobile bar

**Files:**
- Create in `frontend/src/components/servico/`:
  - `ReservaActividade.jsx`, the column;
  - `CalendarioReserva.jsx`;
  - `HorariosReserva.jsx`;
  - `BarraReservaMovel.jsx`.
- Modify: `frontend/src/pages/ServiceDetail.jsx`, which mounts the column in the right placeholder and the mobile bar.
- Test: `frontend/src/__tests__/ReservaActividade.test.jsx`

**Interfaces:**
- Consumes `availability-month` (Task 3), `slot-availability` (Task 2 shape) and `quote` (Task 4).
- Produces the prop `onReservar(seleccao)`, where `seleccao = { date, time, adults, children, mode: 'per_person'|'private', language, voucher, quote: {lines,total,before} }`.
- Step numbers and labels:
  1. "Escolha a opção" / "Choose an option", only with both prices;
  2. "Quem vem?" / "Who's coming?";
  3. "Escolha a data e a hora" / "Choose date and time".
- Slot copy:
  - "Restam N" / "Only N left" when `remaining <= 5`;
  - "Esgotado" / "Sold out" when `remaining === 0` or `started`.
- Button: "Reservar" / "Book" (sand). Disabled until the date is chosen, and the time too when slots exist.
- Mobile bar: "Desde X €" / "From X €", and the button "Ver disponibilidade" / "Check availability" scrolls to the column.

- [ ] **Step 1: Failing tests** (mock `fetch` per URL):
  - `calendario_risca_dias_sem_lugar`: days absent from `days` render with `aria-disabled="true"` and a line-through class.
  - `mes_vazio_avanca_uma_vez`: the first month is empty and the second has days, so the second month shows. When both are empty, "Sem datas disponíveis neste mês" shows and only 2 month fetches happen.
  - `restam_n_e_esgotado`.
  - `um_so_horario_fica_escolhido`.
  - `mudar_pessoas_recarrega_calendario`.
  - `preco_vem_da_cotacao`: shows the `quote.total` formatted with the page's existing price formatter, and the `children` line.
  - `erro_da_cotacao_bloqueia_reservar`: on `CAPACITY_EXCEEDED`, the message shows and the button is disabled.
  - `reservar_entrega_a_seleccao`: `onReservar` is called with the exact `seleccao`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Debounce quote requests by 300 ms.
  - Use `aria-live="polite"` on the calendar, slots and price.
  - Keyboard: arrow keys move between days.
- [ ] **Step 4:** Run the file, the full suite and the build. Expected: pass.
- [ ] **Step 5: Commit:** `feat: coluna de reserva com calendario, horarios e preco do servidor`.

### Task 9: Hand-off to the existing checkout

**Files:**
- Modify: `frontend/src/pages/ServiceDetail.jsx` (`ActivityModal`, `BookingModal`, `ServiceDetailPagina`)
- Test: `frontend/src/__tests__/ServiceDetail.test.jsx` (add a describe block)

**Interfaces:**
- `ActivityModal` gains the prop `seleccao`, with the shape from Task 8. When present:
  - the modal opens at step 2 (customer details);
  - step 1 is skipped and "Anterior" from step 2 closes the modal;
  - the review lines and total come from `seleccao.quote`, and `rawTotal` is no longer computed;
  - `buildPayload()` sends `adults`, `children`, `tour_time`, `booking_mode`, `voucher_code` (from `seleccao.voucher`) and `guests = adults + children`;
  - the `VoucherField` is not rendered.
- Without `seleccao`, nothing changes. This is the fallback for any old entry point.

- [ ] **Step 1: Failing tests:**
  - `reservar_abre_nos_dados_do_cliente`.
  - `voucher_da_coluna_vai_na_reserva`: the posted body contains `voucher_code` and `adults`/`children`, and the review shows the quote total.
  - `sisp_e_paypal_usam_o_total_da_reserva`: the payment call uses `newRes.total_price`.
  - `sem_seleccao_modal_antigo_igual`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the file, the full suite and the build. Expected: pass.
- [ ] **Step 5: Commit:** `feat: reservar na coluna segue para os dados do cliente e pagamento`.

### Task 10: Browser check and widget mode

**Files:** none new; fixes go where the defects are, with a test each.

- [ ] **Step 1:** Run the frontend preview (`saldesk-frontend`) and mock `fetch` in the page (the backend is never started locally). Load the activity page at 1280 px and at 375 px, in PT and EN, and with `?widget=1`. Check:
  - all sections render;
  - the column is sticky at 1280 px;
  - at 375 px the bottom bar shows, nothing scrolls sideways, and the booking block comes after the facts;
  - the calendar, slots and price work;
  - Book opens the details step;
  - in widget mode it is a single column with the booking first;
  - a hotel page still looks as before.
- [ ] **Step 2:** Any defect gets a failing test first, then the fix. Re-run the full suites (`backend: npx jest`; `frontend: npx vitest run`, `npm run build`; repo root: `node --test "tests/website/*.test.js"`).
- [ ] **Step 3:** Commit each fix: `fix: <defeito>`.

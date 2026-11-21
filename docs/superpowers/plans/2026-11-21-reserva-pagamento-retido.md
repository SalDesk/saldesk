# Held place while paying (part 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public card-payment booking holds its place for 30 minutes and is then cancelled as "Pagamento não concluído" for the operator to follow up. No emails go out before payment, a late payment never takes money for a lost place, and the same booking is never created twice.

**Architecture:**
- Two new backend helpers hold the logic:
  - `helpers/lugarRetido.js`: the hold, expiry, reinstating and the re-check that the place is still free;
  - `helpers/avisosReserva.js`: the new-booking notices, extracted from `criarReserva` so they can run either at creation or at payment.
- `criarReserva` stores the hold, defers the notices and protects against duplicates.
- `paymentController` asks `lugarRetido` before every capture.
- A `node-cron` job expires holds every 5 minutes.
- The app shows the new states through one label helper and adds one filter chip.

**Tech Stack:** Express + Supabase (jest), React 18 + Tailwind (vitest), node-cron, Postgres migration.

**Spec:** `docs/superpowers/specs/2026-11-21-reserva-pagamento-retido-design.md` (read its "Builder-check rulings": they override the earlier Goals where they differ).

## Global Constraints

- **Hold:** 30 minutes (`MINUTOS_RETENCAO = 30`). The job runs every 5 minutes (`'*/5 * * * *'`), timezone `Atlantic/Cape_Verde`.
- **Migration 078** (`database/078_reserva_pagamento_retido.sql`) adds `reservations.cancel_reason text` (check: NULL, `'payment_not_completed'`, `'replaced'`, `'paid_after_expiry'`), `reservations.hold_expires_at timestamptz` and `reservations.voucher_id uuid references vouchers(id) on delete set null`.
  - `voucher_id` is needed by ruling 6, which uses up the voucher at payment; the reservation never stored it.
  - The owner must authorize the migration in chat at deploy time. Never apply it during the build.
- **`hold_expires_at` is set only on deferred bookings:** source public, method `paypal` or `sisp`, total > 0. "Not null" means "notices deferred and hold active or expired". Nothing else sets it.
- **Expiry only ever touches:** `source='public'`, `status='pending'`, `payment_status='pending'`, `payment_method in ('paypal','sisp')`, `hold_expires_at < now`.
- **Copy, verbatim:**
  - Payment step: "Guardamos o seu lugar durante 30 minutos enquanto paga." / EN "We hold your place for 30 minutes while you pay."
  - 409 `HOLD_EXPIRED`: "Este lugar já não está disponível. Não foi feita nenhuma cobrança." / EN "This place is no longer available. You have not been charged."
  - Operator notification on expiry: `Pagamento não concluído — <customer_name> — <unit name>`.
  - Operator notification and email subject for a payment with no place: `Pagamento recebido mas o lugar já foi ocupado — reembolsar ou remarcar`.
  - Underpaid suffix: `Pagamento incompleto — verificar`.
  - Labels:

    | Key | PT | EN | DE | NL |
    |---|---|---|---|---|
    | `paymentNotCompleted` | Pagamento não concluído | Payment not completed | Zahlung nicht abgeschlossen | Betaling niet voltooid |
    | `awaitingPayment` | A aguardar pagamento | Awaiting payment | Wartet auf Zahlung | Wacht op betaling |
    | `paidAfterExpiry` | Pago sem lugar — reembolsar | Paid without a place — refund | Bezahlt ohne Platz — erstatten | Betaald zonder plaats — terugbetalen |
- **European Portuguese with accents** in every user-facing string; no emojis.
- **Files that must not change:** `frontend/src/components/ui/*`.
- **i18n:** keys go into all four of `frontend/src/i18n/{pt,en,de,nl}.json`; `i18nParity.test.js` must stay green.
- **Never start the real backend.** Tests mock Supabase, as in `backend/src/__tests__/criarReservaConfirmacao.test.js`.
- **Commands:**
  - Backend tests: `cd backend && npx jest <file>`; full suite `cd backend && npx jest`.
  - Frontend: `cd frontend && npx vitest run <file>`; full suite `cd frontend && npx vitest run`; build `cd frontend && npm run build`.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Line endings:** some files are CRLF. Keep each file's existing line endings.

## Review Focus

1. **A payment arriving as the hold expires.** The customer is either charged and confirmed, or refused before any capture; never charged for a lost place. Tests: `prepararPagamento` cases in Task 4, plus the 23P01 confirm case.
2. **The operator confirms an "A aguardar pagamento" booking by hand.** The job must leave it alone, because only `status='pending'` is expired. Test: Task 1, "não expira reservas confirmadas".
3. **Older cached pages and the widget post without `payment_method`.** They are treated as cash: no hold, notices at creation. Test: Task 2.
4. **The webhook and the confirm both report the same capture.** The customer and operator get the notices once. Test: Task 4.
5. **Email matching for duplicates.**
   - Case differences match: `Ana@X.cv` equals `ana@x.cv`.
   - Wildcards never do: `ana_1@x.cv` does not match `anax1@x.cv`.

   Test: Task 3.

---

### Task 1: Migration, hold helpers and the expiry job

**Files:**
- Create: `database/078_reserva_pagamento_retido.sql`
- Create: `backend/src/helpers/lugarRetido.js`
- Modify: `backend/src/helpers/bookingHelpers.js`: `verificarDisponibilidade`, `verificarDisponibilidadeMesa`, `ocupacaoDoSlot` and `verificarDisponibilidadeSlot` accept `excluirReservaId` as a string or an array of ids. An array uses `.not('id', 'in', '(a,b)')`; an empty array or `null` adds no filter.
- Modify: `backend/src/services/cronService.js`: add `expirarRetencoes()` and schedule it, update the start log line, and export it.
- Test: `backend/src/__tests__/lugarRetido.test.js`, `backend/src/__tests__/bookingHelpersExcluir.test.js`

**Interfaces:**
- Produces (`helpers/lugarRetido.js`):
  - `MINUTOS_RETENCAO` (30).
  - `eMetodoCartao(metodo: string|null) -> boolean`: true only for `'paypal'` and `'sisp'`.
  - `fimDaRetencao(agora: Date = new Date()) -> string`: ISO string of `agora` plus 30 minutes.
  - `lugarAindaLivre(supabase, reserva, agora = new Date()) -> Promise<boolean>`.
    - `reserva` has `{ id, unit_id, check_in, check_out, start_time, duration_minutes, guests, is_group_booking }`.
    - The answer is false when `check_in` is before today in Cape Verde (`hojeEHoraCaboVerde`).
    - Otherwise the checks go in this order, always excluding `reserva.id`:
      1. With `duration_minutes` and `start_time` (a restaurant table): `verificarDisponibilidadeMesa`.
      2. Otherwise, when the unit's `parseUnitMeta(unit).time_slots` is non-empty and `start_time` is set:
         - the slot is matched on `HH:MM`;
         - a missing slot, or one where `slotJaComecou(check_in, slot.time, agora)`, means false;
         - otherwise `verificarDisponibilidadeSlot(..., guests, slot.capacity, reserva.id, is_group_booking)`.
      3. Otherwise `verificarDisponibilidade(..., check_in, check_out, reserva.id)`.
  - `expirarReservasNaoPagas(supabase, agora = new Date()) -> Promise<number>`: one conditional bulk update.
    - Filters (Global Constraints): `.eq('source','public').eq('status','pending').eq('payment_status','pending').in('payment_method',['paypal','sisp']).lt('hold_expires_at', agora.toISOString())`.
    - Sets `{ status:'cancelled', cancel_reason:'payment_not_completed', updated_at }`, and selects `id, operator_id, customer_name, units(name)`.
    - Inserts one `notifications` row per expired booking: `{ operator_id, notification_type:'payment_not_completed', content:'Pagamento não concluído — <customer_name> — <units.name>', link:'/reservas/<id>' }`.
    - Returns the count.
- Produces (`cronService.js`): `expirarRetencoes()`, scheduled `'*/5 * * * *'`. It catches and logs its own errors.

- [ ] **Step 1: Write the migration.** Follow the style of `database/077_cancelamento_confirmacao.sql`: a header comment including "ATENCAO: aplicar ANTES de implantar o backend", `add column if not exists` for the three columns, and a drop-and-add check constraint `reservations_cancel_reason_check`. Also add a partial index for the job: `create index if not exists reservations_hold_expires_idx on reservations (hold_expires_at) where status = 'pending' and hold_expires_at is not null;`.

- [ ] **Step 2: Write the failing tests.**
  - `bookingHelpersExcluir.test.js`:
    - `verificarDisponibilidade(sb, 'u1', '2026-12-01', '2026-12-01', ['a','b'])` calls `.not('id','in','(a,b)')`;
    - with `'a'` it calls `.neq('id','a')`;
    - with `[]` it calls neither.
  - `lugarRetido.test.js`, with a chainable Supabase mock like the one in `criarReservaConfirmacao.test.js`, recording the filters:
    - `fimDaRetencao(new Date('2026-12-01T10:00:00Z'))` returns `'2026-12-01T10:30:00.000Z'`.
    - `eMetodoCartao`: `'paypal'` and `'sisp'` are true; `'cash'`, `null` and `undefined` are false.
    - "expira só reservas públicas pendentes com cartão e prazo vencido": the update filters are exactly the Global Constraints list, and `status` is filtered to `'pending'`. This also pins "não expira reservas confirmadas". `cancel_reason` is `'payment_not_completed'`.
    - "cria uma notificação por reserva expirada": 2 returned rows give 2 notification inserts, the content is `'Pagamento não concluído — Ana — Volta à ilha'`, and the return value is 2.
    - `lugarAindaLivre`:
      - a past `check_in` is false and makes no query;
      - a slot unit calls `verificarDisponibilidadeSlot` with `reserva.id` as the exclusion;
      - a slot that has already started is false;
      - a no-slot unit calls `verificarDisponibilidade` with `reserva.id`.

      Mock `bookingHelpers` for these.
  - `cronService`: `expirarRetencoes` calls `expirarReservasNaoPagas` and swallows a thrown error.

- [ ] **Step 3: Run them and see them fail.** Run `cd backend && npx jest lugarRetido bookingHelpersExcluir`. Expected: FAIL, because the module is missing and the array is not supported.
- [ ] **Step 4: Implement** the migration, `lugarRetido.js`, the array exclusion and the cron entry.
- [ ] **Step 5: Run the tests again.** Run `cd backend && npx jest lugarRetido bookingHelpersExcluir`, then the full `cd backend && npx jest`. Expected: PASS, with the full suite green.
- [ ] **Step 6: Commit.** Message: `feat: lugar retido de 30 minutos e expiração das reservas com cartão não pagas`.

### Task 2: Store the hold and defer the notices in `criarReserva`

**Files:**
- Create: `backend/src/helpers/avisosReserva.js`
- Modify: `backend/src/controllers/publicController.js` (`criarReserva`: the insert at about line 532, the voucher use at about line 586, and the notification and email block from `const jaConfirmada` at about line 605 to the `return res.status(201)`)
- Test: `backend/src/__tests__/criarReservaRetencao.test.js`. Keep `criarReservaConfirmacao.test.js` green, updating its mocks only where the extraction requires it.

**Interfaces:**
- Consumes: `eMetodoCartao` and `fimDaRetencao` (Task 1).
- Produces (`helpers/avisosReserva.js`):
  - `avisarNovaReserva({ reserva, operator, unitName, totalOperador, incompleto = false }) -> Promise<void>`. It never throws (it logs instead).
    - This is the exact behaviour moved out of `criarReserva`: the operator `notifications` insert ("Nova reserva ..." with the EXECUTIVO variant and " (já confirmada)"), the customer email `confirmacaoClienteEmail`, and the operator email `notificacaoOperadorEmail`.
    - The guests come from `reserva.guests`, the customer total from `reserva.total_price`, and the operator email total from `totalOperador ?? reserva.total_price`.
    - With `incompleto: true`:
      - the notification content gets `' — Pagamento incompleto — verificar'`;
      - the customer email is skipped;
      - the operator email notes start with `'Pagamento incompleto — verificar'`.
  - `concluirReservaPaga(reserva, { incompleto = false }) -> Promise<void>`. `reserva` is a row that includes `units(name)` and `operators(...)` with the fields `criarReserva` selects.
    - When `!incompleto` and `reserva.voucher_id` is set, it calls `registarUsoVoucher(reserva.voucher_id)` (errors are logged).
    - Then it calls `avisarNovaReserva({ reserva, operator: reserva.operators, unitName: reserva.units?.name, incompleto })`.
- `criarReserva` changes:
  - `const adiar = eMetodoCartao(payment_method) && finalTotal > 0`.
  - The insert gains `voucher_id: voucherId`. When `adiar`, it also gains `payment_method` and `hold_expires_at: fimDaRetencao()`.
  - When `adiar`, `registarUsoVoucher` and `avisarNovaReserva` are not called. Otherwise both run as today: `avisarNovaReserva` with `totalOperador: total`.
  - The traveller notification for auto-confirmed bookings and `dispararSyncImediato` stay where they are.

- [ ] **Step 1: Write the failing tests** in `criarReservaRetencao.test.js`, copying the mock setup of `criarReservaConfirmacao.test.js`:
  - "PayPal com total: guarda o método e o prazo, e não avisa ninguém":
    - the insert has `payment_method:'paypal'` and `hold_expires_at` about 30 minutes ahead (within 5 seconds);
    - `enviarEmail` is not called and no `notifications` insert happens.
  - "SISP com voucher: guarda o voucher_id e não gasta o uso": `registarUsoVoucher` is not called and the insert has `voucher_id`.
  - "dinheiro: tudo como hoje": there is no `hold_expires_at` and no `payment_method` in the insert, 2 emails are sent and 1 notification is created.
  - "sem payment_method (página antiga): tratado como dinheiro": same assertions as cash.
  - "cartão com total 0: não adia": the emails are sent and there is no `hold_expires_at`.
  - `concluirReservaPaga`:
    - with a voucher and complete payment, it calls `registarUsoVoucher('v1')` and sends both emails;
    - with `incompleto: true`, there is no voucher call and no customer email, and the notification content ends with `'Pagamento incompleto — verificar'`.
- [ ] **Step 2: Run and see them fail.** Run `cd backend && npx jest criarReservaRetencao`. Expected: FAIL.
- [ ] **Step 3: Implement** `avisosReserva.js` and the `criarReserva` changes.
- [ ] **Step 4: Run the tests again.** Run `cd backend && npx jest criarReservaRetencao criarReservaConfirmacao`, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: reservas com cartão guardam o lugar e só avisam depois do pagamento`.

### Task 3: Duplicate protection in `criarReserva`

**Files:**
- Create: `backend/src/helpers/emailPadrao.js`. Move `padraoEmail` and `mesmoEmail` from `travelerController.js` here, unchanged, and import them back in `travelerController.js`.
- Modify: `backend/src/helpers/lugarRetido.js` (add the two functions below)
- Modify: `backend/src/controllers/publicController.js` (`criarReserva`)
- Test: `backend/src/__tests__/reservaDuplicada.test.js`

**Interfaces:**
- Consumes: `eMetodoCartao`, `fimDaRetencao`, and the array exclusion (Task 1).
- Produces (`helpers/lugarRetido.js`):
  - `reservasRecentesDoCliente(supabase, { operatorId, unitId, email, checkIn, agora = new Date() }) -> Promise<Array>`: `select('*')`.
    - Filters: `.eq('operator_id').eq('unit_id').eq('check_in').eq('source','public').in('status',['pending','confirmed']).gte('created_at', agora − 30 min).ilike('customer_email', padraoEmail(email))`.
    - It then keeps only the rows where `mesmoEmail(row.customer_email, email)`.
  - `classificarRecentes(recentes, nova, agora = new Date()) -> { igualSemCartao, igualCartao, retidosProprios }`. This is a pure function.
    - `nova` is `{ checkOut, startTime, guests, isGroupBooking, metodo }`. `metodo` is `payment_method` when `eMetodoCartao`, else `null`.
    - **igual:** the same `check_out`, the same `HH:MM` of `start_time` (null equals null), the same `guests`, the same `!!is_group_booking`, and the same method (the row's `payment_method` when it is a card method, else null).
    - **retidosProprios:** rows with `status 'pending'`, `payment_status 'pending'`, a card method and `hold_expires_at > agora`.
    - **igualSemCartao:** the first igual row whose method is null.
    - **igualCartao:** the first igual row that is in retidosProprios.
- `criarReserva` flow (rulings 2 and 6). This applies to the table branch and the unit branch alike:
  1. Before the branch's first availability check:
     - call `reservasRecentesDoCliente` and `classificarRecentes`;
     - if there is an `igualSemCartao`, respond `res.status(200).json({ data: row, pre_order: null, message })`, where `message` is the same text a creation with that status would get;
     - pass `retidosProprios.map(r => r.id)` as the exclusion to every availability check.
  2. After `finalTotal`: if there is an `igualCartao` with `Number(total_price) === finalTotal`, update its `hold_expires_at` to `fimDaRetencao()` and respond 200 with it. Nothing is inserted, notified or emailed.
  3. Just before the insert: if `retidosProprios` is not empty, cancel them in one update:
     - set `{ status:'cancelled', cancel_reason:'replaced', updated_at }`;
     - with `.in('id', ids).eq('status','pending').eq('payment_status','pending')`.

- [ ] **Step 1: Write the failing tests** in `reservaDuplicada.test.js`:
  - `classificarRecentes`, as pure cases:
    - an identical cash row is `igualSemCartao`;
    - an identical PayPal hold with a future hold is `igualCartao` and is in `retidosProprios`;
    - a PayPal hold with an expired `hold_expires_at` is in neither;
    - a different `start_time` ('09:00' against '14:00') is not igual, but the PayPal hold is still in `retidosProprios`;
    - a `paid` PayPal row is never in `retidosProprios`;
    - `'09:00:00'` equals `'09:00'`.
  - `reservasRecentesDoCliente`:
    - `ilike` receives an escaped pattern for `'ana_1@x.cv'` (`'ana\\_1@x.cv'`);
    - a returned row `'anax1@x.cv'` is filtered out, and `'Ana_1@X.cv'` is kept.
  - `criarReserva`:
    - "devolve a reserva igual em dinheiro com 200 e não insere nada": there is no insert and no email.
    - "devolve o lugar retido igual e renova o prazo": there is an update with `hold_expires_at` and no insert.
    - "substitui o lugar retido do mesmo cliente quando muda o grupo": an update with `cancel_reason:'replaced'` happens before the insert, and the availability check received the old id as its exclusion.
- [ ] **Step 2: Run and see them fail.** Run `cd backend && npx jest reservaDuplicada`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run the tests again.** Run `cd backend && npx jest reservaDuplicada viajanteReservas criarReserva`, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: a mesma reserva enviada duas vezes devolve a primeira e substitui o lugar retido antigo`.

### Task 4: Payments respect the hold

**Files:**
- Modify: `backend/src/helpers/lugarRetido.js` (add the two functions below)
- Modify: `backend/src/controllers/paymentController.js`: `publicCreatePaypalIntent`, `publicConfirmPaypalPayment`, `confirmarCapturaPaypal`, `paypalWebhook` and `sispCallback`
- Test: `backend/src/__tests__/pagamentoReservaRetida.test.js`. Keep `pagamentoValorServidor.test.js` green; extend its Supabase mock (`.in`, `.neq`, `.lt`, insert) only as needed.

**Interfaces:**
- Consumes: `lugarAindaLivre`, `fimDaRetencao`, `eMetodoCartao` (Task 1), and `concluirReservaPaga` (Task 2).
- Produces (`helpers/lugarRetido.js`):
  - `prepararPagamento(supabase, reservationId, agora = new Date()) -> Promise<{ ok: true } | { ok: false, code: 'NOT_FOUND' | 'HOLD_EXPIRED' }>`:
    - No row: `NOT_FOUND`.
    - `status 'pending'`: when `hold_expires_at` is set, update it to `fimDaRetencao(agora)`; then `ok`.
    - `status` `'confirmed'` or `'checked_in'`: `ok`.
    - `status 'cancelled'` with `cancel_reason 'payment_not_completed'`:
      - if `lugarAindaLivre`, run a conditional update with `.eq('status','cancelled').eq('cancel_reason','payment_not_completed')` that sets `{ status:'pending', cancel_reason:null, hold_expires_at:fimDaRetencao(agora) }`;
      - `ok` only when a row came back;
      - a `23P01` error or no row gives `HOLD_EXPIRED`.
    - Anything else: `HOLD_EXPIRED`.
  - `registarPagoSemLugar(supabase, reservationId, { metodo, valor, campos = {} }) -> Promise<void>`:
    - updates `{ status:'cancelled', payment_status:'paid', payment_method: metodo, amount_paid: valor, cancel_reason:'paid_after_expiry', updated_at, ...campos }` and selects the row with `units(name)` and `operators(name, email)`;
    - inserts a `notifications` row with `notification_type:'paid_after_expiry'` and content `'Pagamento recebido mas o lugar já foi ocupado — reembolsar ou remarcar — <customer_name> — <unit>'`;
    - emails `operators.email` with that same text as the subject (`enviarEmail`);
    - logs on error and never throws.
- **Controller rules:**
  - **`publicCreatePaypalIntent` and `publicConfirmPaypalPayment`:** call `prepararPagamento` first. `HOLD_EXPIRED` returns 409 `{ error: '<PT copy>', error_en: '<EN copy>', code: 'HOLD_EXPIRED' }` and nothing is created or captured. `NOT_FOUND` returns 404, as today.
  - **`confirmarCapturaPaypal`:**
    - The full-payment update gains `.in('status',['pending','confirmed']).neq('payment_status','paid')` and selects `*, units(name), operators(id, name, slug, address, email, phone, currency, language, logo_url, push_subscription)`.
    - If the update errors with `23P01` or returns no row while the payment was not already paid, call `registarPagoSemLugar(..., { metodo:'paypal', valor: amount, campos:{ paypal_order_id, paypal_capture_id } })` and return the row.
    - When the update succeeded and `data.hold_expires_at` is set, call `concluirReservaPaga(data)`.
    - The partial branch gains `.eq('payment_status','pending')`; when that update returns a row with `hold_expires_at`, call `concluirReservaPaga(row, { incompleto:true })`.
  - **`paypalWebhook` `PAYMENT.CAPTURE.COMPLETED`:** use the same conditional update (`.in('status',['pending','confirmed']).neq('payment_status','paid')`, selecting the row with joins). Notify the traveller and call `concluirReservaPaga` only when a row came back.
  - **`sispCallback`:**
    - Select also `status, cancel_reason, hold_expires_at, payment_status`.
    - On `paid` at or above the total, call `prepararPagamento` first. On `HOLD_EXPIRED`, call `registarPagoSemLugar(..., { metodo:'sisp', valor: resultado.amount, campos:{ sisp_transaction_id } })` and redirect to `/book/cancel?res=<id>&erro=lugar`.
    - Otherwise use the conditional update (as for PayPal), the receipt, and `concluirReservaPaga` when `hold_expires_at` is set.
    - On partial: `concluirReservaPaga(row, { incompleto:true })`, with the same `.eq('payment_status','pending')` guard.

- [ ] **Step 1: Write the failing tests** in `pagamentoReservaRetida.test.js`, using the in-memory `mockBD` style of `pagamentoValorServidor.test.js` and mocking `lugarAindaLivre`:
  - **prepararPagamento:**
    - pending with a hold: ok, and `hold_expires_at` moves forward;
    - `payment_not_completed` with the place free: ok, `status` back to `'pending'`, `cancel_reason` null;
    - `payment_not_completed` with the place taken: `HOLD_EXPIRED` and the row is unchanged;
    - `replaced`: `HOLD_EXPIRED`;
    - cancelled by the operator (`cancel_reason` null): `HOLD_EXPIRED`.
  - **PayPal:**
    - "lugar perdido: recusa antes de capturar": `captureOrder` is not called, the response is 409 `HOLD_EXPIRED`, and `error_en` is set;
    - "create-intent com lugar perdido não cria ordem": `createOrder` is not called.
    - "confirm com 23P01 regista pago sem lugar": the row ends `payment_status:'paid'`, `cancel_reason:'paid_after_expiry'`, and a `notifications` insert has `notification_type:'paid_after_expiry'`.
    - "confirmação envia os avisos adiados uma vez; webhook a seguir não repete": `enviarEmail` is called 2 times for the notices, plus the receipt, after confirm, and the count does not grow after the webhook.
  - **SISP:**
    - "pago com lugar perdido": redirect contains `erro=lugar`, and `cancel_reason` is `'paid_after_expiry'`;
    - "pago abaixo do total avisa o operador com Pagamento incompleto": a notification ends with that suffix and the customer gets no notice email.
- [ ] **Step 2: Run and see them fail.** Run `cd backend && npx jest pagamentoReservaRetida`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run the tests again.** Run `cd backend && npx jest pagamentoReservaRetida pagamentoValorServidor`, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: pagamento tardio nunca cobra um lugar perdido; avisos adiados saem ao pagar`.

### Task 5: Operator and traveller views

**Files:**
- Modify: `backend/src/controllers/reservationsController.js` (`listar`): add `q = q.or('cancel_reason.is.null,cancel_reason.neq.replaced')`.
- Modify: `backend/src/controllers/travelerController.js` (`getBookings`): drop the rows whose `cancel_reason` is `'replaced'` or `'payment_not_completed'`.
- Create: `frontend/src/utils/estadoReserva.js`
- Modify, replacing each `t(\`reservations.status.${...}\`)` badge label with `rotuloEstadoReserva(r, t)` (the `Badge` variant stays `r.status`):
  - `frontend/src/components/reservations/ReservationCard.jsx`;
  - `frontend/src/components/reservations/ReservationDetailModal.jsx`;
  - `frontend/src/pages/reservations/ActivityTable.jsx` (2 places);
  - `frontend/src/pages/reservations/RentacarTable.jsx`;
  - `frontend/src/pages/reservations/RestaurantTable.jsx`;
  - `frontend/src/components/crm/CustomerDetail.jsx`.
- Modify: `frontend/src/pages/Reservations.jsx`: add the filter chip `'payment_not_completed'` after `'cancelled'`, labelled `t('reservations.paymentNotCompleted')`. When it is selected, keep the rows with `r.cancel_reason === 'payment_not_completed'`.
- Modify: `ReservationDetailModal.jsx`: when `cancel_reason` is `'payment_not_completed'` or `'paid_after_expiry'`, show a box:
  - the hint text;
  - the customer's email as a `mailto:` link;
  - when `customer_phone` exists, a WhatsApp link `https://wa.me/<digits only>`. Reuse an existing WhatsApp link helper if the codebase has one.
- Modify: `frontend/src/i18n/{pt,en,de,nl}.json`, under `reservations`:
  - `paymentNotCompleted`, `awaitingPayment`, `paidAfterExpiry` (values in the Global Constraints table);
  - `abandonedHint`: PT "O cliente não concluiu o pagamento. Pode contactá-lo:" / EN "The customer did not complete the payment. You can contact them:" / DE "Der Kunde hat die Zahlung nicht abgeschlossen. Sie können ihn kontaktieren:" / NL "De klant heeft de betaling niet voltooid. U kunt contact opnemen:";
  - `paidAfterExpiryHint`: PT "O pagamento entrou depois de o lugar ter sido ocupado. Reembolse ou remarque com o cliente:" / EN "The payment arrived after the place was taken. Refund or rebook with the customer:" / DE "Die Zahlung kam, nachdem der Platz vergeben war. Erstatten oder mit dem Kunden umbuchen:" / NL "De betaling kwam nadat de plaats bezet was. Terugbetalen of omboeken met de klant:".
- Test: `frontend/src/utils/__tests__/estadoReserva.test.js` (or the folder the utils tests already use), `frontend/src/__tests__/Reservations.test.jsx` (extend it), `backend/src/__tests__/reservationsList.test.js` and `viajanteReservas.test.js` (extend them).

**Interfaces:**
- Produces: `rotuloEstadoReserva(r, t, agora = new Date()) -> string`. It checks in this order:
  1. `cancel_reason === 'paid_after_expiry'`: `t('reservations.paidAfterExpiry')`.
  2. `status === 'cancelled'` and `cancel_reason === 'payment_not_completed'`: `t('reservations.paymentNotCompleted')`.
  3. `status === 'pending'`, `payment_status === 'pending'`, `payment_method` is `paypal` or `sisp`, and `hold_expires_at` is after `agora`: `t('reservations.awaitingPayment')`.
  4. Otherwise: `t(\`reservations.status.${r.status}\`)`.

- [ ] **Step 1: Write the failing tests:**
  - `estadoReserva`: one case per branch above, plus "hold vencido mas ainda pending mostra Pendente" (the job has not run yet).
  - `Reservations.test.jsx`: the chip "Pagamento não concluído" shows only the row with that reason, and that row's badge reads "Pagamento não concluído".
  - `reservationsList.test.js`: `listar` calls `.or('cancel_reason.is.null,cancel_reason.neq.replaced')`.
  - `viajanteReservas.test.js`: `getBookings` hides `replaced` and `payment_not_completed` and keeps `paid_after_expiry`.
- [ ] **Step 2: Run and see them fail.** Run `cd frontend && npx vitest run estadoReserva Reservations` and `cd backend && npx jest reservationsList viajanteReservas`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run the tests again.** Run the same commands, then both full suites (including `i18nParity`). Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: operador vê pagamentos não concluídos e reservas a aguardar pagamento`.

### Task 6: Public booking page

**Files:**
- Modify: `frontend/src/pages/ServiceDetail.jsx`:
  - **`PO`:** when `v` is `'paypal'` or `'sisp'` and not `soNoLocal`, show the hold copy under the options (a small muted line).
  - **The three modals that hold `pendingRes`** (hotel at about line 607, activity at about line 670, car at about line 786): add `useEffect(() => { if (step < 3 && pendingRes) spr(null); }, [step])`, so going back from step 3 drops the old hold. The server replaces it (Task 3).
  - **`PayPalButton`:**
    - `createOrder` on a non-ok response calls `onError(msg)` before throwing;
    - `onApprove` uses `msg` too;
    - `msg = (lang === 'en' && j.error_en) ? j.error_en : (j.error || fallback)`.
- Modify: `frontend/src/pages/BookingCancel.jsx`. With `erro === 'lugar'`, show PT "O pagamento foi recebido, mas o lugar já tinha sido ocupado. O operador vai contactá-lo para o reembolso ou uma nova data." / EN "Your payment was received, but the place had already been taken. The operator will contact you about a refund or a new date." instead of the generic error text.
- Test: `frontend/src/__tests__/ServiceDetail.test.jsx` (extend it) and a new `frontend/src/__tests__/BookingCancel.test.jsx`.

**Interfaces:**
- Consumes: the 409 body `{ error, error_en, code:'HOLD_EXPIRED' }` (Task 4) and the redirect `erro=lugar` (Task 4).

- [ ] **Step 1: Write the failing tests:**
  - **ServiceDetail:**
    - "mostra o aviso dos 30 minutos ao escolher PayPal" ("Guardamos o seu lugar durante 30 minutos enquanto paga.");
    - "não mostra o aviso para pagar no local";
    - "voltar do passo 3 e regressar cria nova reserva PayPal": `fetch` to `/reservations` is called twice.
  - **BookingCancel:** `?erro=lugar` shows the refund text in PT; with lang EN it shows the EN text.
- [ ] **Step 2: Run and see them fail.** Run `cd frontend && npx vitest run ServiceDetail BookingCancel`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run the tests again.** Run the same command, then the full suite and `npm run build`. Expected: PASS, and the build succeeds.
- [ ] **Step 5: Commit.** Message: `feat: página de reserva avisa do lugar retido e trata o lugar perdido`.

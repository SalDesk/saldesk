# Held place while paying, abandoned card payments, duplicate protection (part 3 of 3)

Date: 2026-11-21. Owner: Rits Delgado.

## Intent

A customer who picks card payment (PayPal or SISP Vinti4) on a public booking page and gives up halfway must not leave the place blocked, and must not trigger "booking received" emails for a booking nobody paid. The same booking must not be created twice. While the customer pays, their place is held for them.

The owner chose option (b): an abandoned card payment is not silently erased. The place is released, but the operator sees the booking marked "Pagamento não concluído" with the customer's contact, so they can follow up. In Cape Verde many customers give up on the card because of their bank, not because they lost interest, and that contact is worth money to the operator.

## How it works today (2026-11-21)

- The booking modal (`frontend/src/pages/ServiceDetail.jsx`: hotel, activity and car modals) creates the reservation before payment:
  - **PayPal:** as soon as the customer reaches step 3 with PayPal selected (`useEffect ... postReservation`), before clicking pay. The PayPal buttons then call `create-intent` and `confirm` with that reservation id.
  - **SISP:** on "Confirmar reserva" the reservation is created, then the browser is sent to the bank (`iniciarPagamentoSisp`). The bank calls `sispCallback` back.
- `criarReserva` (`backend/src/controllers/publicController.js`) inserts with `status` from `estadoInicialReserva` (card payments are always `pending`), then immediately:
  - creates the operator's in-app notification "Nova reserva de ...";
  - emails the customer `confirmacaoClienteEmail` ("booking received");
  - emails the operator `notificacaoOperadorEmail`;
  - triggers the channel sync (`dispararSyncImediato`).
- A `pending` reservation counts as occupied everywhere: `bookingHelpers.js` availability queries (`.in('status', ['pending','confirmed','checked_in'])`) and the DB exclusion constraints `reservations_no_overlap` and `reservations_no_overlap_time`. For an activity without time slots, a single pending booking closes the whole day.
- Payment confirmation (`paymentController.js`: `confirmarCapturaPaypal`, `paypalWebhook`, `sispCallback`) sets `payment_status: 'paid'`, `status: 'confirmed'` and sends the receipt (`enviarReciboPagamento`). Since 2026-11-20 the amount comes from the saved reservation and an underpayment stays `partial`.
- There is no duplicate protection. A double click, a retry, or closing and reopening the modal after reaching the PayPal step creates another reservation, and each one holds a place.

**Live data (2026-11-21):**
- 1 of 24 operators has PayPal connected and none has SISP.
- There has never been a card payment and never a duplicated public booking.
- The only pending reservation is from August 2026, with no payment method, and already in the past.

This is prevention, before operators turn payments on.

## Goals

1. **Held place:** a public card-payment booking holds its place for **30 minutes** from creation. The payment step tells the customer: "Guardamos o seu lugar durante 30 minutos enquanto paga" (EN: "We hold your place for 30 minutes while you pay").
2. **Expiry:** a card-payment booking still unpaid after 30 minutes is cancelled automatically.
   - It gets `status: 'cancelled'` and `cancel_reason: 'payment_not_completed'`, and its place is released.
   - The operator gets one in-app notification: "Pagamento não concluído — <cliente> — <serviço>".
   - The customer gets nothing (the operator follows up; see Builder calls).
3. **No emails before payment:** for a card-payment booking with a total above 0:
   - the customer "booking received" email, the operator new-booking email and the operator's in-app "Nova reserva" notification are not sent at creation;
   - they are sent when the payment is confirmed, together with today's receipt.

   Cash and transfer bookings, and card bookings with total 0, behave exactly as today.
4. **Operator sees the abandoned bookings:**
   - The reservations list (`frontend/src/pages/Reservations.jsx`) gets a filter chip "Pagamento não concluído". The card and the detail modal show that label and the customer's contacts, with the existing email and WhatsApp actions where they exist.
   - While a card booking is still inside its 30 minutes, it shows "A aguardar pagamento" instead of plain "Pendente", so the operator does not confirm it by hand by mistake.
5. **Late payment:** a payment that arrives after expiry must never take money for a place that is gone.
   - **PayPal:** before capturing (`confirm`, and `create-intent`), if the booking was cancelled for non-payment, try to reinstate it (back to `pending`, `cancel_reason` cleared) only if the place is still free.
     - Use the same availability rules as `criarReserva`; the DB exclusion constraint is the final guard (`23P01`).
     - If it is no longer free, refuse with 409 `HOLD_EXPIRED`, "Este lugar já não está disponível. Não foi feita nenhuma cobrança." (EN: "This place is no longer available. You have not been charged."), and do not capture.
   - **SISP:** the bank has already taken the money when the callback arrives.
     - If the place is still free, reinstate and confirm as normal.
     - If not, set `payment_status: 'paid'` and leave the booking `cancelled`, with `cancel_reason: 'paid_after_expiry'`. Send the operator an urgent in-app notification and email: "Pagamento recebido mas o lugar já foi ocupado — reembolsar ou remarcar". Redirect the customer to `/book/cancel?erro=lugar`, which says the operator will contact them about a refund or a new date.
6. **Duplicate protection** in `criarReserva`, for public bookings only. It runs in this order, before the availability check:
   1. **Same booking again.** A non-cancelled public reservation created in the last 30 minutes with the same unit, customer email (case-insensitive, exact match, no wildcards), `check_in`, `check_out`, time (`start_time` / tour time), guests and total price is returned as is: HTTP 200, same response shape as a creation, no new emails or notifications. If that reservation is still unpaid, its `payment_method` is updated to the one just sent, and its status is recomputed with `estadoInicialReserva`. This covers the customer switching from PayPal to cash.
   2. **Same customer changing their mind.** Otherwise, this customer's own unpaid card holds on the same unit and the same `check_in`, created in the last 30 minutes (public, `pending`, `payment_status: 'pending'`, method `paypal` or `sisp`), are cancelled with `cancel_reason: 'replaced'` before the availability check. A customer who goes back and changes the group size is then not refused because of their own hold.
   3. Then today's flow continues unchanged.

## Non-goals

- A countdown timer on the payment step (the text in Goal 1 is enough).
- Emailing the customer when their hold expires.
- Changing how many bookings a no-slot activity day accepts.
- Operator-entered bookings, channel and OTA imports (GetYourGuide, Viator...): unchanged. Duplicate protection and expiry apply to `source = 'public'` only.
- Refunds through the app for `paid_after_expiry`: the operator handles it as today.

## Anti-goals

- **Taking money for a place that is gone** (see Goal 5).
- **Cancelling a booking that was paid, partly paid, or paid in cash.** Expiry touches only `source = 'public'`, `status = 'pending'`, `payment_status = 'pending'`, `payment_method in ('paypal','sisp')`, `created_at` older than 30 minutes. `partial` (underpaid) bookings are never expired; they are the operator's to handle.
- **Emails that announce a booking nobody paid.**
- **Breaking today's bookings:** the POST payload, older cached pages and the embeddable widget keep working; cash bookings are unchanged.
- **Losing the abandoned customer's contact:** abandoned bookings are cancelled, never deleted.

## Constraints

- **Database:** one migration, number 078, adding to `reservations`:
  - `cancel_reason text`, with a check that allows NULL, `'payment_not_completed'`, `'replaced'` and `'paid_after_expiry'`;
  - `hold_expires_at timestamptz` (NULL for anything that is not an unpaid public card booking).
  - `status` and its check constraint are unchanged; `cancelled` is already excluded from availability, the exclusion constraints and the reports.
  - The migration needs the owner's explicit authorization at deploy time.
  - Verify the column live before deploying the backend that uses it.
- **Expiry rule:** "older than 30 minutes" means `hold_expires_at < now()`, not `created_at`. Wherever this document says "created in the last 30 minutes" or "older than 30 minutes" for a hold, read `hold_expires_at`.
- **Expiry job:** `node-cron` in `backend/src/services/cronService.js`, every 5 minutes, timezone `Atlantic/Cape_Verde`. One bulk update, plus one operator notification per expired booking. The job must be safe to run twice (only `pending` rows are touched). A place can therefore stay held up to about 35 minutes; that is accepted.
- **Reservations hidden by reason:**
  - `replaced`: hidden from the operator's list and from the traveller area (`travelerController.js`). The customer re-booked, so it is noise.
  - `payment_not_completed`: shown to the operator, hidden from the traveller area (the customer never booked).
  - `paid_after_expiry`: shown to both, because there is money involved.
- **App:** React 18, Tailwind, vitest; `components/ui/*` never changes. i18n keys go into `pt/en/de/nl.json` (the parity test). European Portuguese with accents.
- **Tests:** jest on the backend:
  - expiry selection, including that `partial`, cash, non-public and young holds are left alone;
  - the deferred emails;
  - late payment for PayPal (reinstated, and refused without capture) and for SISP (reinstated, and `paid_after_expiry`);
  - the duplicate return and the replaced hold.

  Vitest for the list chip and labels and for the payment-step text.
- **Deploy:** the usual backups; migration first, then backend, then app.

## Approaches considered

- **(a) Expire holds with a scheduled job and keep `pending` counting as occupied (chosen).** It is one place to change, and the DB exclusion constraints keep working, because they cannot use `now()` and so must see real statuses.
- **(b) Ignore old pending card holds inside every availability query (`created_at > now() - 30 min`).** Rejected: the DB exclusion constraints cannot express it, so the insert would still collide; and there are six query sites to keep in sync.
- **(c) Do not create the reservation until the payment succeeds.** Rejected: SISP needs a reservation id before redirecting, there would be no held place, and two customers could pay for the same last place.
- **Marking abandoned bookings:** a new `status` value was rejected, because every status switch, report and the DB check would have to learn it. A `cancel_reason` column keeps them out of everything that already ignores `cancelled`.
- **Duplicate protection:** an idempotency key sent by the browser was rejected. It needs page changes, misses older cached pages and the widget, and does not cover "closed and reopened the modal". Matching on content in the server covers all three.

## Builder-check rulings (2026-11-21)

These answer the independent builder check. They are my calls, and the owner can overrule them.

1. **The chosen method is stored at creation.** Today `criarReserva` does not save `payment_method` on insert; only payment capture writes it.
   - From now on, a public booking that asks for `paypal` or `sisp` is saved with that `payment_method` and `hold_expires_at = now() + 30 min`.
   - Cash, transfer and a missing method (older cached pages, the widget) are saved exactly as today, with no method stored, and count as "not card".
   - The refund branch only acts on `payment_status = 'paid'`, so storing the method on unpaid bookings changes nothing there. The finance tab shows the chosen method next to the pending status.
2. **Duplicate rule 6.1 matches only when the payment method is also the same.** It returns the booking untouched: no method change, no status change, no emails.
   - A customer who switches from an unpaid card hold to cash, or from PayPal to SISP, falls into rule 6.2. The old hold is cancelled as `replaced`, and the new booking is created normally, with the emails its method calls for.
   - A cash booking is never turned into a card booking (accepted edge: cash then card for the same booking creates a second request).
3. **A reinstated or retried hold gets a fresh 30 minutes.**
   - PayPal `create-intent` refreshes `hold_expires_at` (and reinstates a `payment_not_completed` booking if the place is still free). `confirm` refreshes it again before capturing.
   - The update after a capture only confirms a booking that is still `pending`. A `23P01` there is handled like a late payment (`paid_after_expiry`), never as an unhandled error.
4. **The page clears its PayPal hold when the selection changes.** In `ServiceDetail.jsx`, `pendingRes` is cleared when the customer leaves step 3, or when the dates, people or time change. The next visit to step 3 posts a fresh booking, and rule 6.2 releases the old hold. This is the one page change in this part, besides the payment-step text and the error messages.
5. **Only `payment_not_completed` can come back.** A late payment for a `replaced` booking, or for one the operator cancelled by hand:
   - **PayPal:** refused with 409 `HOLD_EXPIRED` before any capture;
   - **SISP:** handled as `paid_after_expiry` (the money is already taken; the operator refunds).
6. **Vouchers are used up on payment for card bookings.** `registarUsoVoucher` runs when the payment is confirmed, not at creation (cash as today), so expired and replaced holds never consume a use. Rule 6.1 runs after the price and voucher computation, so it can compare the total; rule 6.2 runs before the availability check.
7. **An underpaid booking (`partial`) notifies the operator.** The deferred in-app notification and the operator email also fire on `partial`, marked "Pagamento incompleto — verificar". The customer gets nothing new; the existing redirect and error already tell them.

## Builder calls (made by me, the owner can overrule)

- Hold length 30 minutes, job every 5 minutes.
- No email to the customer on expiry; the operator follows up.
- `replaced` holds are hidden everywhere; `payment_not_completed` is hidden from the traveller area only.
- Card bookings with total 0 (free or "price agreed with the operator") never show online payment today, so they never expire. Nothing changes for them.

## Left to the builder

- The exact UI of the chip, labels and contact actions, following the existing reservation card and detail modal.
- Whether the PayPal `create-intent` also reinstates (recommended, so the customer is not sent into PayPal for a place that is gone), or only `confirm`.
- Where the late-payment availability re-check lives: a shared helper next to `criarReserva`'s checks is preferred to a copy.

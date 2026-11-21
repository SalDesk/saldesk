# Complete activity page with Logan-style booking (part 1 of 3)

Date: 2026-11-21. Owner: Rits Delgado.

## Intent

The owner wants the booking on the Discover to work like the Logan Tours site (loganislandtours.com), keep the Discover's look, and have a complete detail page.

The reference is the package `modulo-reserva-saldesk.zip`:
- `standalone/tour-page.js` and `.css` are the page;
- `standalone/booking-widget.js` and `.css` are the booking;
- `api/CONTRATO-API.md` is the API contract;
- `original-logan/` is the Logan PHP, for reference only.

Use the package as the design and behaviour reference. Do not copy it in as a second system.

**Today:**
- A Discover card opens the app's service page, `app.saldesk.cv/book/:slug/servico/:id` (`frontend/src/pages/ServiceDetail.jsx`, about 1950 lines).
- The same page serves each operator's public page and the embeddable widget (`?widget=1`, `utils/widgetMode`).
- Booking opens in a modal with steps, and the steps differ per type: hotel, activity, car, restaurant.

## Decisions taken with the owner

- **(a) One page.** The existing service page becomes the complete page; there is no second page on saldesk.cv.
- **Three parts, each shipped on its own:**
  - Part 1 is this document.
  - Part 2 adds vehicle options, a guide-language surcharge and automatic discounts.
  - Part 3 adds duplicate protection and a held place while paying.
- **Look:** the Discover's tokens:
  - Sora and DM Sans;
  - ocean `#0D5470` family;
  - sand `#D4A82A` call to action;
  - radius 14 to 24;
  - the shadows of `website/discover/index.html`.

  The package's "Tema SalDesk" already follows them.

## Scope of part 1

Activities only, meaning the activity form units (`components/units/forms/TourForm.jsx`) of `operator_type = 'activity'`. Hotels, cars and restaurants keep today's page and modal unchanged.

### Page sections, in order, with their data source

Every section is hidden when its data is empty. Never invent content.

1. **Header:**
   - breadcrumb: Discover / island / title;
   - title (`name` or `meta.name_en` in EN);
   - stars, only the unit's own rating (`unit_rating` from `GET /public/:slug/units/:id/reviews`, already scoped);
   - short summary (`meta.short_pt`/`short_en`, or the first paragraph of the description);
   - chips: duration, hotel pickup (`meta.pickup_included`), free cancellation (`operator.free_cancellation_hours`), instant confirmation (`operator.auto_confirm_bookings`);
   - Share button.
2. **Gallery:**
   - one large photo and four small ones, from `unit.images`;
   - a viewer with arrows, Esc and swipe;
   - "+N photos" on the last tile.
3. **Six facts:**
   - duration (`meta.duration` h);
   - format (`meta.tour_type`: group or private or both);
   - languages (`meta.languages`);
   - pickup (included or the meeting point text);
   - departures (`meta.time_slots` times; there are no weekdays in the data, so show only the times);
   - group size (`unit.capacity`).
4. **Sticky section menu**, under the facts, linking to the sections that exist.
5. **Highlights:** NEW optional field `meta.highlights_pt`/`highlights_en` (one per line).
6. **Description:** `meta.desc_pt`/`desc_en`. A blank line separates paragraphs and "- " lines become a list. "Read all" collapses text longer than about 600 characters.
7. **Included and not included:** `meta.included_items` (`included: true/false`); the legacy string list counts as included.
8. **Itinerary:** `meta.stops` with name and description, plus today's itinerary map, kept.
9. **What to bring:** NEW optional field `meta.what_to_bring_pt`/`what_to_bring_en`. Falls back to `meta.important_info` when the new field is empty.
10. **Meeting point and pickup:** today's section, kept, with its map and Google Maps link.
11. **Policies:** the cancellation policy text (operator's own text, else generated from `free_cancellation_hours`; `utils/politicaCancelamento`) and the confirmation rule.
12. **Reviews:** today's list, restyled.
13. **FAQ:** `operator.custom_faqs`, collapsible.
14. **Other services:** today's related cards, restyled.

### Booking column (desktop) and bottom bar (phone)

**Desktop:** a sticky right column, about 380 px wide. The header shows "From X € per person" or "per group".

**Steps, numbered like the package:**
1. **Option**, shown only when the unit has both per-person and private pricing: "Per person" or "Private / group", as today's toggle.
2. **Who's coming:**
   - adults and children (the children counter is always shown, as today; children pay `price_child` when it is set, otherwise the adult price);
   - the guide language select (`meta.languages`), when there is more than one language.
3. **Date and time:**
   - a month calendar where days without room for the party are struck through;
   - when the current month is empty, it moves to the next month on its own;
   - then the time slots, with "Only N left" at 5 or fewer, struck when full, and auto-selected when only one is left.
4. **Price box:**
   - lines and total come from the server (`/quote`);
   - the voucher field stays here.

**Book button:**
- disabled until the date (and time, when slots exist) are chosen;
- on click it opens today's modal directly at the customer details step, then review and payment, with the selection pre-filled.
- Customer details, payment (cash, PayPal, SISP), policy checkbox, referral, WhatsApp opt-in and the traveller session all stay exactly as today.

**Phone (below 1024 px):**
- a fixed bottom bar shows "From X €" and a "Check availability" button;
- the button scrolls to the booking block, which sits after the facts on phones;
- no horizontal scroll at 375 px.

**Operator brand colour:** theming stays as today. The page uses the `brand-*` tokens from `useBrandColor` / `utils/brandPalette`; an operator with no `brand_color` gets ocean and sand. There is no "came from the Discover" detection.

**Widget mode (`?widget=1`):** the same page in a single column, with the booking block first. Payment still opens at the top level (`alvoDoPagamento`).

### Server (new read-only endpoints)

These go in `backend/src/controllers/publicController.js` and `routes/public.js`, under `/public/:slug/units/:unitId/`, with the existing `publicLimiter`. The prices and rules are today's; nothing is added in part 1.

**`GET availability-month?month=YYYY-MM&pax=N&mode=per_person|private`:** `{ month, days: { 'YYYY-MM-DD': true } }`, listing the days with at least one slot with room for `pax`.
- No slots: a day is free unless blocked.
- Uses the same rules as `listarSlotsComDisponibilidade` and `verificarDisponibilidadeSlot`: private takes the whole slot, plus `blocked_dates` and past days. Days are in Cape Verde time.

**`GET slot-availability?date=&pax=`:** already exists.
- Add `remaining` per slot.
- Mark a slot unavailable when `remaining < pax`.
- Keep the response shape backwards compatible.

**`GET quote?adults=&children=&mode=&date=&voucher=`:** `{ lines: [{ type, description, quantity, total }], total, before: null, error }`.

**Shared price function:** `criarReserva` and `/quote` must call the same function, e.g. `precoActividade(unit, meta, { adults, children, mode })` in `helpers/bookingHelpers.js`. The two must never differ.
- Voucher validation reuses `validarVoucher`.
- `error` covers the cases where `criarReserva` would refuse: no private price for private mode, or a party over `unit.capacity` (see Open questions).

`criarReserva` keeps validating everything again on POST. The browser never sends a price.

### Activity form (operator app)

- New optional textareas in `TourForm.jsx`, near the description, PT and EN: "Destaques (um por linha)" and "O que levar".
- They save into the unit's description JSON as `highlights_pt/en` and `what_to_bring_pt/en`.
- There is no database migration.

## Non-goals (parts 2 and 3, or never)

- Vehicle options and seats, the guide-language surcharge, automatic discounts with a struck "before" price: part 2.
- Duplicate protection on POST and a held place with expiry: part 3.
- Hotels, cars and restaurants: unchanged.
- Changing the static Discover site (`website/discover`): the cards keep linking to the app page.
- A new checkout.

## Anti-goals

- **A price on the page that differs from the price charged.** `/quote` and `criarReserva` share one function, and a test pins them together.
- **Breaking today's bookings:**
  - the existing POST payload must keep working (the operator page, widget and older cached pages);
  - payments (PayPal, SISP), vouchers and the traveller account link must behave as now.
- **Invented content:** no fake highlights, no placeholder reviews, no "N people viewed" unless the data is real (`recent_bookings` already exists and may be shown).
- **Losing the operator brand colour** on operator pages, or the JSON-LD and SEO the page already emits (`utils/dadosEstruturados`).
- **Horizontal scroll at 375 px,** or a booking column that covers content.

## Constraints

- **App:**
  - React 18, Tailwind and vitest;
  - `components/ui/*` must not change;
  - PT and EN through the page's existing `lang` mechanism;
  - European Portuguese with accents.
- **Accessibility:**
  - `aria-live` on the calendar, the slots and the price;
  - a visible focus state;
  - `prefers-reduced-motion` respected;
  - the gallery viewer usable by keyboard.
- **Tests:**
  - the new endpoints get jest tests, including the quote equal to the charge;
  - the page gets vitest tests (sections hidden without data, calendar struck days, slot "Only N left", Book opens the details step pre-filled);
  - check in a browser at 375 and 1280.
- **Deploy:** the usual backups; backend before the app.

## Approaches considered

- **(a) Rebuild the activity part of `ServiceDetail` in React with the package as a reference.** Chosen: one page and one booking system, and it keeps payments and SEO.
- **(b) Embed the package's vanilla `booking-widget.js` inside the React page.** Rejected: two rendering models in one page, duplicated i18n, and harder tests.
- **(c) A separate static page on saldesk.cv.** Rejected by the owner: two booking pages, and payment would hop to the app.

## Left to the builder

- Component split: the page sections and the booking column should become their own files under `components/servico/`, instead of growing `ServiceDetail.jsx`.
- Exact spacing, the icon set (lucide, already used) and the calendar layout.
- How "Read all" measures length.

## Owner answers (2026-11-21)

1. **Child price: charge it.** Per-person total = adults x `base_price` + children x `price_child` (when `price_child` is set; otherwise children pay the adult price, as today). This changes the amount charged, so it applies to both `/quote` and `criarReserva` through the shared price function, and to the operator's manual booking path if it uses the same per-person rule (check `reservationsController.js`). Private/group prices (`price_private`, `price_tiers`) are per group and unaffected. Today the POST only sends the total (`guests`/`party_size`), so the booking payload gains `adults` and `children` (integers); when they are missing (older cached pages, the widget on an operator's site, the operator's manual form), the server treats everyone as adults, which is today's price.
2. **Group limit: refuse above capacity.** `/quote` returns an `error` and `criarReserva` returns 400 when adults + children > `unit.capacity` (when capacity is set). Infants do not exist in the data, so there is nothing to exclude.

## Builder-check rulings (2026-11-21)

- **Activities without time slots:** keep today's rule. `verificarDisponibilidade` refuses the whole day once any active booking exists, so `availability-month` strikes any such day. Part 1 does not change how many bookings a no-slot day accepts.
- **Operator-entered bookings:** `reservationsController.js` uses the same `precoActividade`. Its form sends only a total, so all people are adults, which is today's price.
- **Voucher and totals:**
  - The voucher field moves to the column's price box (`/quote` with `voucher`) and leaves the modal.
  - The modal's review step shows the `/quote` result for the chosen selection.
  - The modal no longer computes a total itself (`rawTotal` goes away).
  - Online payment amounts come from the reservation saved on the server, not from the page. See the separate payment fix below.
- **FAQ data:** `GET /public/:slug/units/:id` gains the operator's `custom_faqs`.
- **Separate fix, found during the check:** public PayPal (`publicCreatePaypalIntent`) and SISP (`publicInitSisp`) take `amount` from the browser, and the capture marks the booking paid without comparing it with the booking total. To be fixed on its own, before part 1: the server takes the amount from the saved reservation and ignores the browser's.

## Owner answers to the builder check (2026-11-21)

- **Payment amount: fix it now,** on its own and before part 1. See "Separate fix" above.
- **Private party outside every price band, with no fixed private price: refuse.**
  - `/quote` returns an error and `criarReserva` returns 400 with "Para este número de pessoas, contacte o operador" (EN: "For this group size, please contact the operator").
  - A booking is never created at 0 €.
- **Slots already started today (Cape Verde time): hide and refuse.**
  - They disappear from `slot-availability` and from `availability-month`. A day whose slots have all started is struck.
  - `criarReserva` returns 409 for them.
  - There is no extra minimum notice.

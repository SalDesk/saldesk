# Discover: filters, sorting and Google visibility

Date: 2026-11-19. The owner delegated the decisions ("decide tu e avança"). Every choice below was made by the builder on the owner's behalf.

## Intent

Tourists landing on saldesk.cv/discover should quickly find an experience that fits their budget, time and peace of mind. They should also find SalDesk experiences straight from Google.

Today the catalogue has 19 activities from 5 operators on 2 islands, priced from 25 to 700 EUR. It filters only by type, island and text. Each experience's service page (app.saldesk.cv/book/:slug/servico/:id) and each tourist-attraction page are missing from the sitemap. Google renders these pages with JavaScript, but they carry no structured data.

## Goals

1. **New filters on the Discover**, alongside the island and type filters:
   - **Benefits:**
     - Cancelamento grátis (`free_cancellation_hours` in 24/48/72/168);
     - Confirmação imediata (`auto_confirm_bookings === true`);
     - Recolha no hotel (`pickup_included === true` in the description).
   - **Price** ("A partir de" price of the card, in EUR):
     - Até 50 €;
     - 50–100 €;
     - Mais de 100 €.
   - **Duration:**
     - Até 3 h;
     - 3–6 h;
     - Mais de 6 h (dia inteiro).
2. **Sorting:**
   - Recomendados (the current order);
   - Preço: mais baixo;
   - Preço: mais alto.

   Experiences with no price always go last.
3. **Google:**
   - The sitemap includes each experience page and each tourist-attraction page.
   - The experience page (ServiceDetail) gets JSON-LD of type Product, with the operator as brand. It carries an Offer with a price and `aggregateRating` only when that experience has real reviews.
   - The tourist-attraction page (ponto.html) gets JSON-LD of type TouristAttraction, with geo coordinates.

## Non-goals

- **A map of the experiences.** No experience has a location today (0 of 19 have lat/lng). A map would be empty or misleading. Next step, outside this work: a "meeting point on the map" field in the activity form. Only after that comes the map.
- Server-side rendering of the Discover.
- Stars per activity on the cards. That is a separate item.
- Filters inside the app (PublicBooking).

## Anti-goals

- A filter that only ever produces "nenhum resultado". Show an option only when at least one experience in the current view fits it. Hide an option when every experience fits it, because it filters nothing.
- Structured data that isn't true. In particular:
  - Do not use the operator's rating as the experience's rating.
  - Do not give a price when there isn't one.
  - Google's guidelines penalise both.
- External libraries on the site. The site rule (website/CLAUDE.md) forbids them.

## Constraints

- **Site:**
  - Vanilla JS, PT/EN, no emojis, inline SVG icons.
  - Pure rules go in `website/discover/_cartao.js`, with `node --test` tests.
  - Bump the `?v=` version of `_cartao.js`.
- **Price and duration bands** use the same values the card shows:
  - price from `precoCartao`, converted to EUR (1 EUR = 110 CVE);
  - duration from `meta.duration` (hours) or else `duration_minutes`.
  - An experience with no price or no duration never matches a price or duration band. It does still appear when no such filter is active.
- **Filter state:**
  - The new filters combine with each other and with island, type and search using AND. Within one group, the user picks only one option (single choice, as with island).
  - "Limpar filtros" also clears these.
- **Layout:** works at 375 px and 1280 px with no horizontal scroll.

## Approaches considered

- **Filters:**
  - (a) Option chips, on a second row under the existing filters. **Chosen:** consistent with the type chips and quick on a phone.
  - (b) A "Filtros" side panel. Too heavy for 19 items.
  - (c) A price range slider. Hard to use on a phone and needs more code with no library.
- **Google:**
  - (a) JSON-LD injected by JS on the pages Google already renders, plus the sitemap. **Chosen:** Googlebot receives the SPA and runs JS, which we checked with the Googlebot user-agent.
  - (b) Server-side rendering for Googlebot through the existing social-preview route. More work, and that route serves social bots only.
- **Map:**
  - (a) Defer until experiences have a location. **Chosen.**
  - (b) A map of tourist attractions. It answers "where are the places", not "where are the experiences".
  - (c) Place each experience on the attractions along its route. Inaccurate.

## Left to the builder

- The exact names of the pure functions.
- The markup and CSS of the second filter row, in the style of the existing chips.
- The JSON-LD format details, valid under schema.org and Google's guidelines.

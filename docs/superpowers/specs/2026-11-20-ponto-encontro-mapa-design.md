# Meeting point on the map and a map of experiences

Date: 2026-11-20. The owner delegated the decisions ("decide tu e avança"). Every choice below is the builder's.

## Intent

A tourist who finds an experience should see where it starts. A tourist browsing the Discover should see where the experiences are on each island. For that, operators need a simple way to mark the meeting point.

**Today:**
- The activity form saves `units.lat/lng`. The input is two loose number fields at the end of the form, under "Coordenadas (opcional — Conect)", and 0 of the 19 activities have filled them in.
- The meeting point is text only, filled in on 6 of the 19.
- 4 activities have coordinates on their itinerary stops.
- The service page does not show the meeting point at all, not even the text.
- The Discover has no map.

## Goals

1. **Activity form (app):**
   - The coordinates move out of the end of the form and into a new block, "Localização do ponto de encontro", right under the meeting point text.
   - The block has:
     - a small map (Leaflet + OpenStreetMap, which the app already uses on the service page). The map opens over the existing pin, or over the island of Sal when there is none. A click places the pin, and the pin can be dragged.
     - a field "Colar coordenadas ou link do Google Maps". It accepts `16.7631, -22.895`, `16.7631,-22.895`, a Google Maps link with `@lat,lng`, `?q=lat,lng` or `!3dlat!4dlng`, and a link with `ll=lat,lng`.
     - the current coordinates in text, and a "Remover localização" button.
   - Outside Cape Verde (latitude 14.5–17.5, longitude −25.5 to −22.5), the form shows a warning but still lets the operator save: "Este ponto fica fora de Cabo Verde. Confirme a localização."
   - It still saves to `units.lat` / `units.lng`. There is no migration.
2. **Service page (app):**
   - A "Ponto de encontro" / "Meeting point" section appears when there is meeting point text or coordinates.
   - It shows the text and, with coordinates, a small map with the pin plus an "Abrir no Google Maps" / "Open in Google Maps" link.
3. **Discover map (site):**
   - A "Lista" / "Mapa" ("List" / "Map") switch sits in the Experiências section. It appears only when at least 1 experience in the current view has a location.
   - The map follows the filters already in use: island, type, search, benefits, price and duration.
   - There is one map per island that has located experiences, sized to fit them.
   - Each pin is numbered. Selecting it shows that experience's card under the map, the same card as the list.
   - Experiences with no location appear in a note: "N experiências sem localização no mapa" / "N experiences without a location on the map".

## Location rule (one rule for the map and the card)

An experience's location is `lat/lng`, the meeting point, when both are numbers. Otherwise it is the first itinerary stop with coordinates. Otherwise there is none.

Never invent a location: no island centre, no operator address.

## Non-goals

- A draggable, zoomable map on the Discover.
- Showing an experience's route on the Discover. The service page already does that.
- Address search or geocoding.
- A location field for hotels, cars and restaurants, which keep their current form.

## Anti-goals

- An external library on the static site. The site's rules forbid it. The Discover map uses OpenStreetMap tiles placed by hand: images plus the projection, no library.
- A map that points to an invented location.
- Breaking the current Discover list.

## Constraints

- **Site:**
  - Vanilla JS, PT/EN, no emojis, inline SVG.
  - Pure rules go in `_cartao.js` with tests.
  - Bump the `?v=` version.
- **OpenStreetMap tiles:**
  - `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with visible attribution "© OpenStreetMap contributors" linking to the copyright page.
  - Zoom levels 8 to 15. Only the tiles inside the map are loaded, with `loading="lazy"`.
- **Pins:** buttons with `aria-label` set to the experience's name, and a visible focus state.
- **Phone:** works at 375 px with no horizontal scroll.
- **App:** React + react-leaflet, which is already a dependency. `components/ui/*` does not change.

## Approaches considered

- **Discover map:**
  - (a) Hand-placed OSM tiles, static per island. **Chosen:** it respects the no-library rule and fits few experiences.
  - (b) Leaflet loaded from a CDN only on the Discover. Breaks the site rule.
  - (c) Putting the map in the app and linking to it from the Discover. An extra step for the tourist.
- **Map input in the form:**
  - (a) Clickable map plus a field to paste coordinates or a Google Maps link. **Chosen:** operators already know Google Maps, and the map lets them fix the pin by eye.
  - (b) Number fields only. That is today's form, and no one fills it in.
  - (c) Address search. Needs a geocoding service and is beyond the scope.

## Left to the builder

- The function names, the visual layout, the pin style and the height of the maps.

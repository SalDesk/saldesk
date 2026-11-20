# Meeting point on the map and a map of experiences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Operators mark the meeting point on a map in the activity form.
- Tourists see it on the service page.
- The Discover shows the experiences on a map, per island.

**Architecture:**
- **App (React):** a pure utility `utils/coordenadas.js` reads coordinates and Google Maps links. A component `LocalizacaoPontoEncontro` combines a react-leaflet map, the paste field and the latitude/longitude fields. ServiceDetail gets a "Ponto de encontro" section.
- **Site:** pure location, projection and framing rules live in `_cartao.js`. `index.html` draws the OSM tiles and the pins with no library.

**Tech Stack:** React + react-leaflet (already a dependency), vitest; vanilla JS + node:test.

**Spec:** `docs/superpowers/specs/2026-11-20-ponto-encontro-mapa-design.md`

## Global Constraints

- **Cape Verde bounds:**
  - latitude 14.5 to 17.5, longitude −25.5 to −22.5, both inclusive;
  - a point outside them shows the warning "Este ponto fica fora de Cabo Verde. Confirme a localização." and can still be saved.
- **Form texts:**
  - block heading: "Localização do ponto de encontro";
  - paste field: "Colar coordenadas ou link do Google Maps";
  - button: "Remover localização";
  - map help text: "Clique no mapa para marcar o ponto de encontro. Pode arrastar o marcador.";
  - the Latitude and Longitude fields stay.
- **Default form map:** centre on Sal (16.75, −22.93) at zoom 11; with a pin, centre on it at zoom 14.
- **Service page:**
  - heading: "Ponto de encontro" / "Meeting point";
  - link: "Abrir no Google Maps" / "Open in Google Maps", pointing to `https://www.google.com/maps/search/?api=1&query={lat},{lng}`.
- **Discover:**
  - switch: "Lista" / "Mapa" (EN "List" / "Map");
  - note: "{n} experiência(s) sem localização no mapa" / "{n} experience(s) without a location on the map";
  - attribution: "© OpenStreetMap contributors", linking to `https://www.openstreetmap.org/copyright`;
  - tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
  - zoom from 8 to 15, map height 360 px, 40 px margin inside the map for the pins.
- **Location:** `lat/lng` when both are finite numbers; otherwise the first stop (`meta.stops`) with finite `lat` and `lng`; otherwise `null`.
- **Unchanged:** `components/ui/*` stays as is. The hotel, car, restaurant and generic forms keep `ConectFields`.

## Review Focus

- A Google Maps link with no coordinates in it (e.g. `maps.app.goo.gl/...`) is rejected with a message; the field is never left half-filled. Test in Task 1: `link_sem_coordenadas_devolve_null`.
- Coordinates arriving as strings ("16.7") or as 0 are treated correctly; 0 is not "missing". Test in Task 4: `localizacao_aceita_texto_numerico_e_rejeita_vazio`.
- Every experience in one spot (the same pin): the map does not divide by zero and uses the maximum zoom. Test in Task 4: `enquadrar_um_so_ponto`.
- The Discover in map mode with a filter that leaves 0 located experiences: the switch disappears and the page goes back to the list. Browser check in Task 5.
- An old activity with no coordinates opens without a pin and saves `lat: null, lng: null`. Test in Task 2: `sem_localizacao_grava_null`.

---

### Task 1: Read coordinates (`utils/coordenadas.js`)

**Files:**
- Create: `frontend/src/utils/coordenadas.js`
- Test: `frontend/src/__tests__/coordenadas.test.js`

**Produces:**
- `lerCoordenadas(texto: string) -> {lat:number, lng:number} | null`
- `dentroDeCaboVerde(lat, lng) -> boolean`

- [ ] **Step 1:** Write the failing tests:
  - `le_par_de_numeros`: `'16.7631, -22.895'`, `'16.7631,-22.895'` and `' 16.7631 ,  -22.895 '` all give `{lat:16.7631, lng:-22.895}`.
  - `le_links_do_google_maps`:
    - `https://www.google.com/maps/place/X/@16.7631,-22.895,15z`;
    - `https://maps.google.com/?q=16.7631,-22.895`;
    - `https://www.google.com/maps/place/X/data=!3d16.7631!4d-22.895`. When both `@` and `!3d` are present, `!3d!4d` wins, because it is the pin and not the camera.
    - `https://maps.google.com/?ll=16.7631,-22.895`.
  - `link_sem_coordenadas_devolve_null`: `https://maps.app.goo.gl/abc` gives `null`.
  - `valores_fora_do_planeta_ou_lixo_devolvem_null`: `'95, 10'`, `'10, 200'`, `'abc'`, `''`, `null`.
  - `limites_de_cabo_verde`: (16.75, −22.93) is true; (14.5, −25.5) is true; (38.7, −9.1) is false.
- [ ] **Step 2:** Run `npx vitest run src/__tests__/coordenadas.test.js` in `frontend`. Expected: FAIL.
- [ ] **Step 3:** Implement. Accept latitudes in [−90, 90] and longitudes in [−180, 180].
- [ ] **Step 4:** Expected: PASS. Commit: `feat: ler coordenadas e links do Google Maps`.

### Task 2: Location block in the activity form

**Files:**
- Create: `frontend/src/components/units/forms/LocalizacaoPontoEncontro.jsx`
- Modify: `frontend/src/components/units/forms/TourForm.jsx`. Use the block right under the "Ponto de encontro" field and remove `<ConectFields>` from this form.
- Test: `frontend/src/__tests__/UnitForm.test.jsx`. Add `vi.mock('react-leaflet', ...)` with simple components that render a `div` with `data-testid="mapa"`.

**Interfaces:**
- Consumes: `lerCoordenadas` and `dentroDeCaboVerde` from Task 1.
- Produces: `LocalizacaoPontoEncontro({ lat, lng, onChange })`.
  - `lat` and `lng` are strings, as in the form state.
  - `onChange({lat, lng})` receives strings; empty strings mean the location is removed.

- [ ] **Step 1:** Write the failing tests:
  - `colar_link_preenche_latitude_e_longitude_e_grava`: paste `https://maps.google.com/?q=16.7631,-22.895`. The Latitude field becomes "16.7631", and saving produces `lat: 16.7631, lng: -22.895`.
  - `colar_texto_invalido_avisa_e_nao_mexe`: paste `abc`. The message "Não encontrei coordenadas neste texto." appears, and the fields stay empty.
  - `fora_de_cabo_verde_avisa_mas_grava`.
  - `remover_localizacao_grava_null`.
  - `sem_localizacao_grava_null`.
  - Existing TourForm tests that use `campo('Latitude')` keep working.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Leaflet's default marker icon breaks with bundlers, so use the same `L.divIcon` approach as ServiceDetail. A click on the map calls `onChange` with the coordinates to 6 decimal places.
- [ ] **Step 4:** Run the full frontend suite and the build. Commit: `feat: ponto de encontro marcado no mapa no formulario de actividade`.

### Task 3: "Ponto de encontro" section on the service page

**Files:**
- Modify: `frontend/src/pages/ServiceDetail.jsx`. Add a section before the itinerary.
- Test: `frontend/src/__tests__/ServiceDetail.test.jsx`. Add a `react-leaflet` mock.

- [ ] **Step 1:** Write the failing tests:
  - `mostra_ponto_de_encontro_com_link_do_mapa`: meta `meeting_point: 'Marina'` with `lat: 16.6, lng: -22.9` shows the heading, the text "Marina", and a link whose href is `https://www.google.com/maps/search/?api=1&query=16.6,-22.9`.
  - `so_texto_sem_link`.
  - `sem_nada_nao_mostra_seccao`.
  - `em_ingles`: shows "Meeting point" and "Open in Google Maps".
- [ ] **Steps 2–4:** watch the tests fail (red), implement until they pass (green), then run the full suite and the build. Commit: `feat: pagina do servico mostra o ponto de encontro`.

### Task 4: Location and map rules (`_cartao.js`)

**Files:** `website/discover/_cartao.js`; `tests/website/cartao.test.js`

**Produces:**
- `localizacaoExperiencia(item, meta) -> {lat, lng, origem:'encontro'|'paragem'} | null`
- `projectar(lat, lng, zoom) -> {x, y}`: Web Mercator in world pixels, with 256-pixel tiles.
- `enquadrarMapa(pontos, largura, altura, opcoes?) -> {zoom, x0, y0}`
  - `opcoes`: `{zMin:8, zMax:15, margem:40}`.
  - Picks the highest zoom at which every point fits in `largura - 2*margem` by `altura - 2*margem`.
  - `x0` and `y0` are the top-left corner in world pixels, so that the set of points is centred.
- `azulejosDoMapa(enq, largura, altura) -> [{z, x, y, left, top}]`: every tile that covers the rectangle, with `left` and `top` in pixels relative to the map. Wrap `x` horizontally; skip any `y` outside 0..2^z−1.

- [ ] **Step 1:** Write the failing tests:
  - `localizacao_prefere_ponto_de_encontro_e_depois_paragem`.
  - `localizacao_aceita_texto_numerico_e_rejeita_vazio`: `lat: '16.7'` is valid; `lat: ''` or `null` falls to the stop; `lat: 0, lng: 0` is valid (not missing).
  - `projectar_valores_conhecidos`: `projectar(0, 0, 0)` gives `{x:128, y:128}`. At zoom 1, (0, 180) gives `x = 512`.
  - `enquadrar_um_so_ponto`: zoom 15, and the point is at the centre (`x0 + largura/2`).
  - `enquadrar_varios_pontos_cabem_com_margem`: Sal (16.6, −22.9) and (16.85, −22.95) at 700×360. Every projected point falls inside `[margem, largura-margem]`, and zoom+1 would not fit.
  - `azulejos_cobrem_o_mapa`: the first tile has `left <= 0` and `top <= 0`; the union covers `largura` and `altura`.
- [ ] **Steps 2–4:** watch the tests fail (red), implement until they pass (green). Commit: `feat: regras de localizacao e enquadramento do mapa do Discover`.

### Task 5: List / Map switch and the map on the Discover

**Files:**
- Modify `website/discover/index.html`:
  - CSS for `.xp-map*`;
  - the switch in `.sec-head` or next to the sort;
  - state `vista = 'lista'|'mapa'`;
  - `renderMapa()`, called from `renderGrid()` when `vista === 'mapa'`;
  - the note about experiences without a location;
  - the version `?v=20261120b`.
- Modify `website/discover/ponto.html` (version only).

**Interfaces:** consumes Task 4.

**Steps:**
- [ ] **Step 1:** Implement. Group `filtered` by `island_name`, keeping only the experiences with a location; with no island, the group is "Cabo Verde".
  - Each group gets a `<div class="xp-map" style="height:360px">`, with the tiles as `<img loading="lazy" alt="">` and numbered pins as `<button class="xp-pin" aria-label="{titulo}">`.
  - The width is the container's width at drawing time. Redraw on `resize`, debounced to 200 ms.
  - Selecting a pin shows `renderActCard(item)` in `.xp-map-sel` under that map and marks the pin as active.
  - The switch is hidden, and `vista` goes back to `'lista'`, when no located experience is left. "Ver mais" (show more) is hidden in map view.
- [ ] **Step 2:** Check in the browser with the fixture (add coordinates to 3 units on Sal and 1 on Santo Antão) at 375 px and 1280 px:
  - the tiles load;
  - each pin sits on its spot;
  - clicking a pin shows its card;
  - the filters update the map;
  - there is no horizontal scroll;
  - EN works.
- [ ] **Step 3:** Run `node --test`, then commit: `feat: mapa das experiencias no Discover`.

# Discover: filters, sorting and Google Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add benefit, price and duration filters plus price sorting to the Discover. Make every experience page and tourist-attraction page known to Google, with honest structured data.

**Architecture:**
- The filter and sorting rules are pure functions in `website/discover/_cartao.js`, tested with `node --test`. `index.html` only draws the chips and calls the rules.
- The server sitemap (`backend/src/routes/seo.js`) adds the experience pages (from `getDiscoverCatalog`) and the tourist-attraction pages (from `cms_landmarks`).
- The JSON-LD is built by pure functions: `frontend/src/utils/dadosEstruturados.js` for the experience page, and `_cartao.js` for the tourist-attraction page. The pages inject it into a `<script type="application/ld+json">`.

**Tech Stack:**
- Site: vanilla JS, node:test.
- Server: Express + jest.
- App: React + vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-discover-filtros-google-design.md`

## Global Constraints

- Site: vanilla JS, no external libraries, PT/EN with `.pt`/`.en` classes, no emojis, inline SVG.
- Bump the `_cartao.js?v=` version in `index.html` and `ponto.html` to `20261120a`.
- **Price in EUR:** take the `valor` from `precoCartao`. When the operator's currency is `CVE`, divide by the rate. The rate is 110 by default, and the page passes `EUR_CVE`.
- **Price bands:**
  - `ate50`: up to 50 inclusive;
  - `50a100`: above 50, up to 100 inclusive;
  - `mais100`: above 100;
  - no price: `null`.
- **Duration in minutes:** `meta.duration` (hours) × 60, or else `duration_minutes`.
- **Duration bands:**
  - `ate3`: up to 180 inclusive;
  - `3a6`: up to 360 inclusive;
  - `mais6`: above 360;
  - none: `null`.
- **Benefits:**
  - `cancelamento`: `free_cancellation_hours` in [24, 48, 72, 168];
  - `confirmacao`: `auto_confirm_bookings === true`;
  - `recolha`: `meta.pickup_included === true`.
- **Visible chip labels:**
  - Benefits: PT "Cancelamento grátis", "Confirmação imediata", "Recolha no hotel"; EN "Free cancellation", "Instant confirmation", "Hotel pickup".
  - Price: "Até 50 €" / "Up to €50"; "50–100 €" / "€50–100"; "Mais de 100 €" / "Over €100".
  - Duration: "Até 3 h" / "Up to 3 h"; "3–6 h" / "3–6 h"; "Mais de 6 h" / "Over 6 h".
- **Sorting:**
  - Select options: "Recomendados" / "Recommended" (`''`), "Preço: mais baixo" / "Price: low to high" (`asc`), "Preço: mais alto" / "Price: high to low" (`desc`).
  - Items with no price always go last. Ties keep their original order.
- **Which options appear:** an option is shown only when 0 < n < the number of experiences in the current view.
  - The current view means after the island, type, search and the *other* new groups are applied.
  - An option that is already active always appears, so it can be switched off.
- **JSON-LD:**
  - Never use the operator's rating.
  - `aggregateRating` is included only with at least 1 review of that experience.
  - The `Offer` is included only when there is a price.
  - The experience page's Offer is in EUR, or in CVE when the operator's currency is CVE.

## Review Focus

- An operator in CVE (e.g. 2750 CVE = 25 EUR) falls into the right price band, not into "Mais de 100 €". Test in Task 1: `preco_em_cve_converte_para_eur`.
- With the island set to Santo Antão and a benefit active that no experience there has, the "Limpar filtros" button appears and clears everything. Browser check in Task 2.
- An experience with no price or duration still appears when there is no price or duration filter. Test in Task 1: `sem_preco_ou_duracao_so_sai_com_filtro_activo`.
- On the experience page, a 404 or an operator with no reviews produces no `aggregateRating` and leaves no orphan `<script>`. Test in Task 4: `sem_avaliacoes_nao_inventa_classificacao`, plus unmount.
- A tourist-attraction slug with `&` or quotes in the sitemap must be escaped in the XML. Test in Task 3: `sitemap_escapa_urls`.

---

### Task 1: Filter and sorting rules (`_cartao.js`)

**Files:**
- Modify: `website/discover/_cartao.js`
- Test: `tests/website/cartao.test.js`

**Interfaces:**
- Produces:
  - `faixaPreco(item, meta, taxa) -> 'ate50'|'50a100'|'mais100'|null`
  - `faixaDuracao(item, meta) -> 'ate3'|'3a6'|'mais6'|null`
  - `temBeneficio(item, meta, chave) -> boolean`
  - `passaFiltrosExtra(item, meta, filtros, taxa) -> boolean`, where `filtros = { beneficio, preco, duracao }` and each value is a key or `''`
  - `ordenarPorPreco(itens, sentido, taxa) -> novo array`, where `sentido` is `''|'asc'|'desc'` and `''` returns a copy in the same order
  - `contarOpcoes(itens, grupo, filtros, taxa) -> { chave: n }`, where `grupo` is `'beneficio'|'preco'|'duracao'`. It counts the items that pass the other two groups and have each key.

- [ ] **Step 1:** Write the failing tests:
  - `faixas_de_preco_e_duracao`: 50 → ate50, 50.01 → 50a100, 100 → 50a100, 101 → mais100; a tiers-only price uses the cheapest tier; 180 min → ate3, 181 → 3a6, 390 → mais6, `meta.duration: 6.5` → mais6.
  - `preco_em_cve_converte_para_eur`: base_price 2750 in CVE with rate 110 → ate50.
  - `beneficios_por_chave`.
  - `sem_preco_ou_duracao_so_sai_com_filtro_activo`.
  - `ordenar_por_preco_sem_preco_no_fim_e_estavel`.
  - `contar_opcoes_respeita_os_outros_grupos`.
- [ ] **Step 2:** Run `node --test "tests/website/*.test.js"`. Expected: the new tests fail.
- [ ] **Step 3:** Implement and export the six functions.
- [ ] **Step 4:** Run the tests again. Expected: all pass.
- [ ] **Step 5:** Commit: `feat: regras de filtro por beneficio, preco e duracao no Discover`.

### Task 2: Filter and sorting row on the Discover (`index.html`)

**Files:**
- Modify: `website/discover/index.html`. That covers:
  - the `.filters` markup;
  - the CSS;
  - the state `filtrosExtra = { beneficio: '', preco: '', duracao: '' }` and `ordem = ''`;
  - `applyFilters`, `clearFilters`, `updateClearBtn`, `renderExtraFilters`;
  - the version of `_cartao.js`.
- Modify: `website/discover/ponto.html` (version of `_cartao.js` only).

**Interfaces:** consumes Task 1.

- [ ] **Step 1:** Add a second row under `.filters`:
  - three groups of chips (benefit, price, duration). Choosing an active chip again switches it off.
  - Each chip carries a count, as the type chips do.
  - The sort `<select>` sits at the right on desktop and at the end on a phone.
  - Options follow the "Which options appear" rule. A group with no options is hidden.
- [ ] **Step 2:** `applyFilters` applies `passaFiltrosExtra`, then `ordenarPorPreco`. `clearFilters` resets both. `updateClearBtn` also considers the new state. A language change redraws the labels.
- [ ] **Step 3:** Browser check with the fixture (scratchpad `fixture-t4.js`) at 375 px and 1280 px:
  - each filter narrows the list correctly;
  - the sort order is right;
  - "Limpar filtros" clears everything;
  - there is no horizontal scroll;
  - EN works.
- [ ] **Step 4:** `node --test` passes. Commit: `feat: Discover filtra por beneficios, preco e duracao e ordena por preco`.

### Task 3: Sitemap with experiences and tourist attractions (server)

**Files:**
- Modify: `backend/src/routes/seo.js`
- Test: `backend/src/__tests__/sitemap.test.js` (new). Mock `../config/supabase` and `../services/discoverCatalogService`.

**Interfaces:** `getDiscoverCatalog()` returns items with `operator_slug` and `unit_id`. `cms_landmarks` has `slug` and `updated_at`.

- [ ] **Step 1:** Write the failing tests:
  - `sitemap_inclui_experiencias_e_pontos`:
    - `https://app.saldesk.cv/book/demo/servico/u1` with priority 0.7;
    - `https://saldesk.cv/discover/ponto.html?slug=buracona` with priority 0.6.
  - `sitemap_escapa_urls`: a slug `a&b` produces `a&amp;b`.
  - `sitemap_sem_catalogo_continua`: the catalogue throws, and the sitemap still has the operators and the attractions.
- [ ] **Step 2:** Run `npx jest src/__tests__/sitemap.test.js` (in `backend`). Expected: FAIL.
- [ ] **Step 3:** Implement. Pass every `loc` through `xmlEscape`. If the catalogue or the attractions fail, carry on without them.
- [ ] **Step 4:** Tests pass, and so does the whole `npx jest`. Commit: `feat: sitemap inclui cada experiencia e cada ponto turistico`.

### Task 4: JSON-LD on the experience page and the tourist-attraction page

**Files:**
- Create: `frontend/src/utils/dadosEstruturados.js`, exporting `jsonLdExperiencia({ unit, op, reviews, url }) -> object|null`.
- Modify: `frontend/src/pages/ServiceDetail.jsx`. A `useEffect` injects `<script type="application/ld+json" id="sd-jsonld">` and removes it on unmount or when the data changes.
- Modify: `website/discover/_cartao.js`, adding `jsonLdLugar(lugar, url) -> object|null`.
- Modify: `website/discover/ponto.html`. After the attraction is drawn, inject the JSON-LD.
- Test: `frontend/src/__tests__/dadosEstruturados.test.js`; `tests/website/cartao.test.js`.

**Experience fields:**
- `@context` `https://schema.org`, `@type` `Product`.
- `name`: the unit's name. `description`: the PT text, from the `short_pt` / `desc_pt` meta or plain text, up to 500 characters.
- `image`: the images, as an array.
- `url`.
- `brand`: `{ @type: 'Organization', name: op.name }`.
- `offers`: `{ @type: 'Offer', price: number, priceCurrency: 'EUR'|'CVE', availability: 'https://schema.org/InStock', url }`. Use the same price priority as the card: base_price, else the cheapest tier, else price_private.
- `aggregateRating`: `{ @type: 'AggregateRating', ratingValue: average to 1 decimal place, reviewCount }`, only with reviews.

**Attraction fields:**
- `@type` `TouristAttraction`.
- `name` (name_pt), `description`, `image` (image_url).
- `geo`: `{ @type: 'GeoCoordinates', latitude, longitude }`, only with coordinates.
- `url`.
- `address`: `{ @type: 'PostalAddress', addressRegion: island_name, addressCountry: 'CV' }`.

- [ ] **Step 1:** Write the failing tests:
  - `jsonld_experiencia_com_preco_e_avaliacoes`.
  - `sem_avaliacoes_nao_inventa_classificacao`.
  - `sem_preco_sem_oferta`.
  - `sem_unidade_devolve_null`.
  - `jsonld_lugar_com_e_sem_coordenadas`.
  - In ServiceDetail.test.jsx, `injecta_e_remove_jsonld`: the script exists after loading and disappears on unmount.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Frontend suite, build and `node --test` all pass. Commit: `feat: dados estruturados para o Google nas experiencias e nos pontos turisticos`.

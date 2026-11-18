# Redesenho do Discover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao Discover (`website/discover/index.html`) a identidade, a ordem de seccoes e o cartao de experiencia da maqueta aprovada, sem partir favoritos, sessao do viajante nem o painel de perfil.

**Architecture:** Mudanca no proprio ficheiro (abordagem B do desenho). As regras de dados do cartao vao para um script novo `website/discover/_cartao.js` (funcoes puras, global `CartaoDiscover`, tambem exportado para Node) testado com `node --test`. O HTML/CSS das seccoes publicas e as funcoes que desenham cartoes sao reescritos; o resto do JavaScript fica.

**Tech Stack:** HTML, CSS, JavaScript simples; testes com o runner nativo do Node 24 (`node:test`, `node:assert/strict`), sem dependencias.

**Spec:** `docs/superpowers/specs/2026-11-18-discover-redesenho-design.md`. Maqueta de referencia visual: `website/discover/_proposta-redesign.html` (classes `.xp-*` = cartao v3).

## Global Constraints

- Sem frameworks nem bibliotecas; Google Fonts so por `<link>`: Sora 400/600/700/800 + DM Sans 400/500/600/700; icones SVG em linha (traco, estilo Lucide); sem emojis.
- Tokens: os de `website/CLAUDE.md` (ocean-900 #062A38 ... ocean-50 #EBF7FB, sand-500 #D4A82A, sand-400 #E0BF5A, n900 #1A2332 ... n50 #F9FAFB).
- Bilingue: `data-lang` + classes `.pt` / `.en`; lingua em `localStorage('sd-lang')`; todo o texto novo tem as duas versoes.
- Responsivo a 375, 768 e 1280 px sem deslocamento horizontal (`document.documentElement.scrollWidth <= innerWidth`).
- Nao mexer: `ponto.html`, `lugares/*.html`, `_lugares.js`, `_booking-widget.js`; a logica de favoritos, sessao do viajante, painel de perfil, recomendados, moeda; os dois scripts Google (GA4 `G-SMH9BH7V1E`, Ads `AW-18425133239`).
- A faixa "Pagamentos aceites" do rodape com os 4 logos de `/payment-logos/` fica, legivel (exigencia SISP), e o credito WANDR fica.
- `index.html` e `_cartao.js` usam fins de linha CRLF: preservar.
- Nao implantar sem ordem explicita do dono.

## Review Focus

- Experiencia com `description` em texto simples (nao JSON) ou JSON partido: o cartao mostra-se com titulo, preco e foto, sem etiquetas, sem erro. Teste em Task 1 (`ler_meta_texto_simples_e_json_partido`).
- Experiencia sem foto: gradiente ocean com o icone do tipo, cartao do mesmo tamanho. Verificacao em Task 3, passo de browser.
- Moeda CVE: preco de grupo e de crianca tambem convertem. Teste em Task 1 (`preco_crianca_e_grupo_convertem_para_cve`) e verificacao em Task 3.
- Lingua EN depois de carregar: titulos `name_en`, etiquetas, sinal de procura e proxima data mudam ao trocar de lingua sem recarregar. Verificacao em Task 3.
- Filtro por ilha + pesquisa sem resultados: estado vazio com "Limpar filtros", que repoe ilha, categoria e texto. Verificacao em Task 3.

## Verificacao no browser (usada nas Tasks 2 a 5)

A API publica nao aceita o dominio `localhost`, por isso a pagina local mostra "Servico indisponivel". Para ver dados reais:

1. Guardar as respostas reais numa pasta de trabalho fora do repositorio (`<scratch>/discover-data/`): `discover-units.json`, `discover.json` (de `/discover?featured=true&limit=3`) e `landmarks.json`, com `curl -s https://api.saldesk.cv/api/v1/public/<caminho> -o <ficheiro>`.
2. Servidor de dados com CORS, em `<scratch>/fixture-server.js` (porta 4174): responde a `GET /public/discover-units`, `/public/discover`, `/public/landmarks` com o ficheiro respectivo e `Access-Control-Allow-Origin: *`; arrancar com `node <scratch>/fixture-server.js` em segundo plano.
3. `preview_start` com `saldesk-website` (porta 4173) e abrir `http://localhost:4173/discover/`.
4. Na pagina, por `javascript_tool`: substituir `window.fetch` por uma versao que troca `https://api.saldesk.cv/api/v1/public` por `http://localhost:4174/public` e chamar `init()` de novo.
5. No fim da Task 5, parar o servidor de dados e o preview.

---

### Task 1: Regras do cartao (`_cartao.js`) com testes

**Files:**
- Create: `website/discover/_cartao.js`
- Test: `tests/website/cartao.test.js` (fora de `website/`, porque a pasta `website/` e copiada inteira para o servidor)

**Interfaces:**
- Produces: global `window.CartaoDiscover` e `module.exports` (quando `module` existe) com:
  - `lerMeta(item) -> object` — `item.description` em JSON se comecar por `{` e for valido; senao `{}`.
  - `duracaoTexto(item, meta) -> string|null` — `meta.duration` (horas, numero ou texto numerico) senao `item.duration_minutes`; formato `"20 min"`, `"2 h"`, `"3 h 30"`, `"6 h 30"`, `"1 h 30"`.
  - `formatoTexto(meta, lang) -> string|null` — `privado`: "Privado"/"Private"; `grupo`: "Em grupo"/"Group"; `ambos`: "Privado ou grupo"/"Private or group"; outro: `null`.
  - `linguasTexto(meta) -> string|null` — `meta.languages` em maiusculas, sem repetidos, separadas por `", "`; vazio: `null`.
  - `incluidosTexto(meta, max = 3) -> string|null` — de `meta.included_items`: objectos com `included === true` (usa `label`) e textos simples; aparados, sem vazios; os primeiros `max` unidos por `" · "`.
  - `precoCartao(item, meta) -> { valor: number, unidade: 'pessoa'|'grupo' } | null` — `base_price > 0` → pessoa; senao o menor `price_tiers[].price > 0` → grupo; senao `price_private > 0` → grupo; senao `null`.
  - `precoCrianca(meta) -> number|null` — `meta.price_child > 0`.
  - `formatarPreco(valor, moedaOperador, moedaVista, taxa = 110) -> string` — a conversao actual de `fmtPrice` (EUR: `€` + inteiro, ou 1 casa decimal abaixo de 10; CVE: inteiro com separador pt-PT + `" CVE"`).
  - `tituloCartao(item, meta, lang) -> string` — `lang === 'en'` e `meta.name_en` nao vazio → `name_en`; senao `item.unit_name`.
  - `sinalProcura(item, lang) -> string|null` — `recent_bookings >= 1`: PT "Reservado 1 vez no último mês" / "Reservado N vezes no último mês"; EN "Booked once in the last month" / "Booked N times in the last month".
  - `hojeCaboVerde(agora = new Date()) -> string` — `YYYY-MM-DD` no fuso `Atlantic/Cape_Verde`.
  - `proximaData(item, hoje, lang) -> string|null` — so se `next_available` existir e for depois de `hoje`: PT "Próxima data: 22 nov", EN "Next date: 22 Nov" (meses PT: jan fev mar abr mai jun jul ago set out nov dez).
  - `miniaturaWikimedia(url, largura = 640) -> string` — `https://upload.wikimedia.org/wikipedia/commons/<a>/<ab>/<ficheiro>` → `https://upload.wikimedia.org/wikipedia/commons/thumb/<a>/<ab>/<ficheiro>/<largura>px-<ficheiro>`; qualquer outro URL (incluindo ja em `/thumb/`) fica igual.
  - `iniciais(nome) -> string` — primeira letra das duas primeiras palavras que comecam por letra, em maiusculas ("Logan Tours" → "LT", "Satur - Serviços de Apoio" → "SS", "Satur" → "S").
  - `ilhasDosItens(itens) -> Array<{ nome: string, n: number }>` — ilhas (`island_name`) presentes, por contagem descendente e depois nome.

- [ ] **Step 1: Escrever os testes que falham**

`tests/website/cartao.test.js` (CommonJS: `const C = require('../../website/discover/_cartao.js')`), um `test()` por nome:

```js
test('ler_meta_texto_simples_e_json_partido', () => {
  assert.deepEqual(C.lerMeta({ description: 'Passeio de barco' }), {});
  assert.deepEqual(C.lerMeta({ description: '{"desc_pt":' }), {});
  assert.deepEqual(C.lerMeta({ description: null }), {});
  assert.equal(C.lerMeta({ description: '{"tour_type":"grupo"}' }).tour_type, 'grupo');
});
test('duracao_em_horas_ou_minutos', () => {
  assert.equal(C.duracaoTexto({}, { duration: 6.5 }), '6 h 30');
  assert.equal(C.duracaoTexto({}, { duration: '2' }), '2 h');
  assert.equal(C.duracaoTexto({ duration_minutes: 210 }, {}), '3 h 30');
  assert.equal(C.duracaoTexto({ duration_minutes: 20 }, {}), '20 min');
  assert.equal(C.duracaoTexto({ duration_minutes: 120 }, { duration: 1.5 }), '1 h 30');
  assert.equal(C.duracaoTexto({}, {}), null);
});
test('formato_e_linguas', () => {
  assert.equal(C.formatoTexto({ tour_type: 'ambos' }, 'pt'), 'Privado ou grupo');
  assert.equal(C.formatoTexto({ tour_type: 'grupo' }, 'en'), 'Group');
  assert.equal(C.formatoTexto({}, 'pt'), null);
  assert.equal(C.linguasTexto({ languages: ['pt', 'EN', 'en', 'ES'] }), 'PT, EN, ES');
  assert.equal(C.linguasTexto({ languages: [] }), null);
});
test('incluidos_aceita_objectos_e_textos', () => {
  const meta = { included_items: [
    { label: 'Guia local', included: true }, { label: 'Almoço', included: false },
    'Transporte', '  ', { label: 'Água', included: true }, { label: 'Fotos', included: true },
  ] };
  assert.equal(C.incluidosTexto(meta), 'Guia local · Transporte · Água');
  assert.equal(C.incluidosTexto({}), null);
});
test('preco_base_escaloes_privado_e_consulta', () => {
  assert.deepEqual(C.precoCartao({ base_price: 35 }, { price_tiers: [{ price: 20 }] }), { valor: 35, unidade: 'pessoa' });
  assert.deepEqual(C.precoCartao({ base_price: 0 }, { price_tiers: [{ price: 150 }, { price: 120 }, { price: 0 }] }), { valor: 120, unidade: 'grupo' });
  assert.deepEqual(C.precoCartao({ base_price: 0 }, { price_private: 95 }), { valor: 95, unidade: 'grupo' });
  assert.equal(C.precoCartao({ base_price: 0 }, {}), null);
  assert.equal(C.precoCrianca({ price_child: 30 }), 30);
  assert.equal(C.precoCrianca({}), null);
});
test('preco_crianca_e_grupo_convertem_para_cve', () => {
  assert.equal(C.formatarPreco(120, 'EUR', 'EUR'), '€120');
  assert.equal(C.formatarPreco(120, 'EUR', 'CVE'), `${(13200).toLocaleString('pt-PT')} CVE`);
  assert.equal(C.formatarPreco(3300, 'CVE', 'EUR'), '€30');
  assert.equal(C.formatarPreco(5.5, 'EUR', 'EUR'), '€5.5');
});
test('titulo_na_lingua_do_visitante', () => {
  const item = { unit_name: 'Excursão de grupo' };
  assert.equal(C.tituloCartao(item, { name_en: 'Group tour' }, 'en'), 'Group tour');
  assert.equal(C.tituloCartao(item, { name_en: 'Group tour' }, 'pt'), 'Excursão de grupo');
  assert.equal(C.tituloCartao(item, { name_en: '  ' }, 'en'), 'Excursão de grupo');
});
test('sinal_de_procura_singular_e_plural', () => {
  assert.equal(C.sinalProcura({ recent_bookings: 0 }, 'pt'), null);
  assert.equal(C.sinalProcura({ recent_bookings: 1 }, 'pt'), 'Reservado 1 vez no último mês');
  assert.equal(C.sinalProcura({ recent_bookings: 2 }, 'pt'), 'Reservado 2 vezes no último mês');
  assert.equal(C.sinalProcura({ recent_bookings: 1 }, 'en'), 'Booked once in the last month');
  assert.equal(C.sinalProcura({ recent_bookings: 3 }, 'en'), 'Booked 3 times in the last month');
});
test('proxima_data_so_quando_nao_e_hoje', () => {
  assert.equal(C.proximaData({ next_available: '2026-11-18' }, '2026-11-18', 'pt'), null);
  assert.equal(C.proximaData({ next_available: null }, '2026-11-18', 'pt'), null);
  assert.equal(C.proximaData({ next_available: '2026-11-22' }, '2026-11-18', 'pt'), 'Próxima data: 22 nov');
  assert.equal(C.proximaData({ next_available: '2026-12-03' }, '2026-11-18', 'en'), 'Next date: 3 Dec');
});
test('hoje_e_o_dia_em_cabo_verde', () => {
  /* 00:30 UTC de 19 nov ainda e 18 nov em Cabo Verde (UTC-1) */
  assert.equal(C.hojeCaboVerde(new Date('2026-11-19T00:30:00Z')), '2026-11-18');
  assert.equal(C.hojeCaboVerde(new Date('2026-11-19T01:30:00Z')), '2026-11-19');
});
test('miniatura_wikimedia', () => {
  const orig = 'https://upload.wikimedia.org/wikipedia/commons/8/80/Cape_Verde_Sal_Buracona_2011.jpg';
  assert.equal(C.miniaturaWikimedia(orig), 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cape_Verde_Sal_Buracona_2011.jpg/640px-Cape_Verde_Sal_Buracona_2011.jpg');
  const outra = 'https://api.saldesk.cv/uploads/operators/x/turtle.jpg';
  assert.equal(C.miniaturaWikimedia(outra), outra);
  const jaThumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/A.jpg/640px-A.jpg';
  assert.equal(C.miniaturaWikimedia(jaThumb), jaThumb);
});
test('iniciais_e_ilhas', () => {
  assert.equal(C.iniciais('Logan Tours'), 'LT');
  assert.equal(C.iniciais('Satur - Serviços de Apoio'), 'SS');
  assert.equal(C.iniciais('Satur'), 'S');
  assert.deepEqual(C.ilhasDosItens([{ island_name: 'Santo Antão' }, { island_name: 'Ilha do Sal' }, { island_name: 'Ilha do Sal' }, {}]),
    [{ nome: 'Ilha do Sal', n: 2 }, { nome: 'Santo Antão', n: 1 }]);
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `node --test tests/website/`
Expected: FAIL com `Cannot find module '../../website/discover/_cartao.js'`.

- [ ] **Step 3: Implementar `website/discover/_cartao.js`**

Um IIFE que define as funcoes do bloco Interfaces e faz `if (typeof module !== 'undefined' && module.exports) module.exports = api; if (typeof window !== 'undefined') window.CartaoDiscover = api;`. Cabecalho com comentario a explicar que o ficheiro e partilhado pela pagina e pelos testes. `hojeCaboVerde` usa `toLocaleDateString('en-CA', { timeZone: 'Atlantic/Cape_Verde' })`. CRLF.

- [ ] **Step 4: Correr e ver passar**

Run: `node --test tests/website/`
Expected: 12 testes, `pass 12`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add website/discover/_cartao.js tests/website/cartao.test.js docs/superpowers/specs/2026-11-18-discover-redesenho-design.md docs/superpowers/plans/2026-11-18-discover-redesenho.md
git commit -m "feat: regras do cartao do Discover num script partilhado e testado"
```

---

### Task 2: Identidade, navegacao, cabecalho, confianca, "porque directo" e rodape

**Files:**
- Modify: `website/discover/index.html` (head: fontes e `<style>` tokens/base/nav/hero; HTML de 349-447 nav e hero, 510-541 vantagens, 572-623 rodape; JS `renderHeroStats`, `obs`/`observeFadeUp`, `setLang`)

**Interfaces:**
- Consumes: nada da Task 1 (so carrega o script).
- Produces: secoes com ids `home`, `trust-row`, `recommended-section`, `activities-section`, `operators-section`, `poi-slider-section`, `why-section`; `<select id="hero-island">` vazio (preenchido na Task 3); `<script src="_cartao.js?v=20261118"></script>` antes do script principal.

- [ ] **Step 1: Fontes e tokens.** Trocar o `<link>` das fontes pelo de Sora + DM Sans (Global Constraints). Em `:root`: acrescentar os tokens de `website/CLAUDE.md` e redefinir os nomes antigos para os novos valores, para que modal e painel herdem: `--ink:#062A38; --ink2:#0A3F55; --paper:#FFFFFF; --paper2:#F3F4F6; --teal9:#062A38; --teal7:#0D5470; --teal6:#10698C; --teal5:#3A9BBF; --teal1:#D6EEF5; --teal0:#EBF7FB; --ochre:#D4A82A; --ochre-d:#BE941C; --ochre1:#F8F0D8; --line:#E5E8EC; --line-strong:#D1D5DB; --tx:#1A2332; --tx-soft:#4B5563; --tx-faint:#9CA3AF; --fd:'Sora',sans-serif; --fb:'DM Sans',sans-serif; --fm:'DM Sans',sans-serif`. `body` com `background:#fff`.

- [ ] **Step 2: Navegacao** como `.nav` da maqueta: logo; links (ancoras `#activities-section`, `#poi-slider-section`, `#operators-section`, e `/operadores.html`) com `.pt`/`.en`; a direita, mantendo os ids e handlers actuais: `#langToggle` (com `#langPt`/`#langEn`), `#cur-toggle`, `#wish-nav-btn`/`#wish-count`, `#nav-profile-wrap` e o seu menu. Links escondidos abaixo de 860 px.

- [ ] **Step 3: Cabecalho** como `.hero` + `.search` da maqueta, sem o campo "Data": foto `/images/hero-buracona.jpg`; etiqueta `<span id="hero-islands">Cabo Verde</span>`; titulo PT "Reserve directamente com quem <span>vive Cabo Verde</span>" / EN "Book directly with the people who <span>live Cape Verde</span>"; subtitulo PT "Tours, transfers e experiências de operadores locais verificados. O preço que vê é o que o operador recebe." / EN "Tours, transfers and experiences from verified local operators. The price you see is what the operator gets."; campo `#nav-search-input` (mesmo id e `Enter` → `handleSearch`); `<select id="hero-island">`; botao sand que chama `handleSearch()`. Sai `#hero-floats` e a funcao `renderHeroStats` (e a sua chamada em `loadServices`).

- [ ] **Step 4: Linha de confianca** `<div id="trust-row">` com 3 itens (icones da maqueta): PT "Operadores verificados pela equipa SalDesk" / EN "Operators verified by the SalDesk team"; PT "Reserva confirmada directamente pelo operador" / EN "Booking confirmed directly by the operator"; PT "Fale directamente com o operador" / EN "Talk directly to the operator".

- [ ] **Step 5: Ordem das seccoes** no `<body>`: nav, hero, trust, `#recommended-section`, `#activities-section` (com os chips de categoria movidos para dentro, ver Task 3), `#operators-section` (o antigo `#featured-section` renomeado; o JS que usa `featured-section` passa a usar `operators-section`), `#poi-slider-section`, `#why-section`, rodape. Sai a seccao `#categories-section` separada.

- [ ] **Step 6: "Porque reservar directo"** como `.why` da maqueta, com os 3 itens actuais (0% comissão, Listagem revista → "Operadores revistos", Suporte directo → "Contacto directo") em PT/EN.

- [ ] **Step 7: Rodape** como na maqueta mas com o conteudo actual: logo branco + descricao + redes; "Explorar" (ancoras novas); "Empresa" (Listar negócio, Entrar, hello@saldesk.cv, Termos `/termos.html`); faixa `.payment-logos` com os 4 logos actuais, a mesma altura dos logos de hoje; linha final com "© 2026 SalDesk Conect" e o credito WANDR.

- [ ] **Step 8: Sem conteudo escondido.** Remover a regra CSS que esconde `.fade-up` (opacidade 0 ate ficar visivel), o `IntersectionObserver` `obs`, `observeFadeUp` e as suas chamadas; as classes `fade-up` nos elementos podem sair.

- [ ] **Step 9: Verificar no browser** (procedimento do topo, passos 1 a 4).
Expected: em 1280 px a pagina segue a ordem do Step 5 com a nova identidade (Sora nos titulos: `getComputedStyle(document.querySelector('h1')).fontFamily` contem `Sora`); PT/EN troca o cabecalho, confianca e rodape; os 4 logos de pagamento visiveis; consola sem erros; `scrollWidth <= innerWidth` a 375 px.

- [ ] **Step 10: Commit**

```bash
git add website/discover/index.html
git commit -m "feat: Discover com a identidade SalDesk, cabecalho com pesquisa, confianca e rodape novos"
```

---

### Task 3: Experiencias, cartao novo e filtro por ilha

**Files:**
- Modify: `website/discover/index.html` (CSS do cartao; HTML de `#activities-section`; JS `renderActCard`, `renderChips`, `applyFilters`, `clearFilters`, `setCurrency`, `setLang`, `loadServices`, `PER_PAGE`, `loadRecommendations`)

**Interfaces:**
- Consumes: `window.CartaoDiscover` (Task 1, todas as funcoes); `#hero-island`, `#hero-islands` (Task 2).
- Produces: `renderActCard(item) -> string` (cartao `.xp`), estado `activeIsland` (`''` = todas), `setIsland(nome)`.

- [ ] **Step 1: CSS do cartao** = bloco `/* CARTAO DE EXPERIENCIA v3 */` da maqueta (`.xp`, `.xp-img`, `.xp-heart`, `.xp-photos`, `.xp-body`, `.xp-island`, `.xp h3`, `.xp-op`, `.xp-av`, `.xp-ver`, `.xp-attrs`, `.xp-inc`, `.xp-foot`, `.xp-price`, `.xp-extra`, `.xp-go`, grelha 3/2/1 colunas a 1080/600 px) mais `.xp-signal` (linha pequena n500, 12.5 px, com reticencias) e `.xp-rating` (estrela sand + media + "(N)"). O coracao activo usa o vermelho actual (`#e00`) e mantem `data-wish`/`data-wish-unit`.

- [ ] **Step 2: `renderActCard(item)`** reescrita com a ordem fixa do desenho (pontos 1 a 9): elemento raiz `<a class="xp" href="${APP}/book/<slug>/servico/<unit_id>">`; foto via `imgBlock(item)` com `decoding="async"`; numero de fotos so se `images.length > 1`; coracao `<button type="button">` cujo `onclick` faz `event.preventDefault(); event.stopPropagation(); toggleWishlist(slug, unitId)`; ilha (`island_name`); titulo `tituloCartao`; operador com `iniciais(operator_name)`, nome, selo e `.xp-rating` so se `review_count > 0`; etiquetas `duracaoTexto`, `formatoTexto`, `linguasTexto` (para `operator_type === 'rentacar'` usar `vehicleSpecsRow(item)` no lugar das etiquetas); `.xp-inc` com `incluidosTexto` (vazio mas presente quando `null`); `.xp-signal` com `sinalProcura` e `proximaData(item, hojeCaboVerde(), L())` unidos por `" · "` (ausente se ambos `null`); rodape com `precoCartao` + `formatarPreco(valor, item.currency, currency)` + "/ pessoa" / "/ grupo" (EN "/ person" / "/ group"), "Criança €X" / "Child €X" com `precoCrianca` convertido, ou "Preço sob consulta" / "Price on request". Todo o texto vindo dos dados passa por `esc()`. Saem `ratingLine`, `coordEyebrow`, `availabilityLabel` e `renderStars` se ficarem sem uso.

- [ ] **Step 3: Cabecalho da seccao** "Experiências em Cabo Verde" / "Experiences in Cape Verde" e `#act-count` com PT "N experiências de M operadores" / EN "N experiences from M operators" (M = `operator_id` distintos dos resultados filtrados). Saem os botoes EUR/CVE da seccao (a moeda fica so na navegacao). `PER_PAGE = 9`.

- [ ] **Step 4: Filtros.** Dentro de `#activities-section`: segmentado `#island-seg` ("Todas"/"All" + uma opcao por ilha de `ilhasDosItens(operators)` com contagem) e os chips de categoria actuais (`#chips-grid`, estilo `.chip` da maqueta). `setIsland(nome)` actualiza `activeIsland`, o segmentado e `#hero-island` (e o `change` de `#hero-island` chama `setIsland`); `applyFilters` acrescenta `(!activeIsland || item.island_name === activeIsland)`; `clearFilters` repoe ilha, categoria e texto. `loadServices` preenche `#hero-island` e `#hero-islands` (nomes das ilhas unidos por " · ", seguidos de " · e a crescer" / " · and growing").

- [ ] **Step 5: Lingua e moeda.** `setLang` e `setCurrency` voltam a desenhar a grelha e os recomendados (os titulos, etiquetas, sinais e precos dependem da lingua e da moeda).

- [ ] **Step 6: Recomendados** usam `renderActCard` e a mesma grelha `.xp-grid`.

- [ ] **Step 7: Verificar no browser** (procedimento do topo).
Expected:
- 19 cartoes no total, 9 visiveis + "Ver mais"; todos com a mesma altura de linha de etiquetas e o preco alinhado em baixo; "Sal Half-Day Private Tour" mostra "A partir de €120 / grupo"; "Caminhada Cratera de Cova" mostra "Criança €30".
- Clicar num cartao vai para `https://app.saldesk.cv/book/<slug>/servico/<id>`; clicar no coracao nao navega e o contador `#wish-count` sobe.
- CVE: precos (incluindo grupo e crianca) em CVE.
- EN sem recarregar: etiquetas "Group"/"Private", "/ person", e o titulo com `name_en` (ex.: a excursao de dia inteiro da Logan Tours passa a "Sal Full-Day Group Tour").
- Seleccionar "Santo Antão" no cabecalho: o segmentado acompanha e ficam 3 cartoes; pesquisar "xyz": estado vazio; "Limpar filtros" volta aos 19.
- Uma experiencia sem foto (forcar `operators[0].images = []` e `renderGrid()`): gradiente com icone, mesmo tamanho.
- 375 px: 1 coluna, sem deslocamento horizontal; 768 px: 2 colunas.

- [ ] **Step 8: Commit**

```bash
git add website/discover/index.html
git commit -m "feat: cartao de experiencia novo no Discover, com procura real, proxima data e filtro por ilha"
```

---

### Task 4: Operadores verificados e lugares a nao perder

**Files:**
- Modify: `website/discover/index.html` (CSS `.ops`/`.op` e `.poi-row`/`.poi` da maqueta; HTML de `#operators-section` e `#poi-slider-section`; JS `renderOperatorCard`, `opImgBlock`, `renderFeatured`, `loadFeatured`, `renderPoiCard`, `poiImgBlock`, `renderPoiSlider`)

**Interfaces:**
- Consumes: `CartaoDiscover.iniciais`, `CartaoDiscover.miniaturaWikimedia`; `operators` (lista de experiencias ja carregada).
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Operadores.** Titulo PT "Operadores locais verificados" / EN "Verified local operators", subtitulo PT "Empresas de Cabo Verde, revistas uma a uma pela equipa SalDesk" / EN "Cape Verdean companies, reviewed one by one by the SalDesk team". `renderOperatorCard(op)` como `.op` da maqueta: capa `cover_images[0]` → primeira foto de uma experiencia desse operador (`operators.find(u => u.operator_id === op.id)`) → gradiente ocean; `logo_url` ou `iniciais(op.name)`; nome + selo + avaliacao (so se `review_count > 0`); `description` em 2 linhas; ilha da primeira experiencia do operador; PT "N experiências" / EN "N experiences" (contagem em `operators`, singular "1 experiência" / "1 experience"); o cartao inteiro liga a `${APP}/book/<slug>`. `loadFeatured` corre depois de `loadServices` (ja e assim) e a seccao esconde-se se nao houver operadores.

- [ ] **Step 2: Lugares.** Titulo PT "Lugares a não perder" / EN "Places not to miss", subtitulo com o numero de pontos (PT "N pontos turísticos em todas as ilhas" / EN "N points of interest across the islands"); faixa horizontal `.poi-row` com setas actuais (`poiSliderScroll`); cartao `.poi` (3:4) com ilha (`ISLAND_LABEL[island_slug]`) e nome, link actual `ponto.html?slug=...`; a imagem usa `miniaturaWikimedia(image_url)` com `onerror` que troca para `image_url` uma unica vez; sem imagem: gradiente com o icone do tipo.

- [ ] **Step 3: Verificar no browser** (procedimento do topo).
Expected: 3 cartoes de operador com capa, "6 experiências" para Logan Tours; o cartao de operador liga a `/book/loganislandtours`; faixa de lugares com fotos carregadas por URLs `.../thumb/.../640px-...` (`[...document.querySelectorAll('.poi img')].map(i => i.currentSrc)`); trocar para EN muda titulos e contagens.

- [ ] **Step 4: Commit**

```bash
git add website/discover/index.html
git commit -m "feat: operadores verificados e lugares a nao perder com o novo desenho no Discover"
```

---

### Task 5: Acabamento, painel e favoritos, telemovel, limpeza

**Files:**
- Modify: `website/discover/index.html`
- Delete: `website/discover/_proposta-redesign.html`

**Interfaces:**
- Consumes: tudo o anterior.

- [ ] **Step 1: Restos.** Apagar CSS e funcoes sem uso depois das Tasks 2-4 (procurar cada nome de classe/funcao removido; ex.: `.hero-stat-card`, `.featured-grid`, `.act-card`, `.verified-badge`, `.avail-badge`, `.eyebrow-coord`, `skCards` so se ficou sem chamadas). Os esqueletos de carregamento (`skCards`) passam a ter a forma `.xp` (foto 3:2 + 3 linhas) para a pagina nao saltar.

- [ ] **Step 2: Modal de favoritos e painel de perfil.** Abrir o modal de favoritos com um favorito guardado e, com sessao simulada se possivel, o painel; ajustar so o que ficou ilegivel ou fora de tom com os tokens novos (cores fixas como `#B7791F` nos estados de reserva ficam).

- [ ] **Step 3: Acessibilidade e movimento.** Foco visivel em `.xp`, `.op`, `.poi`, chips, segmentado e botoes; `@media (prefers-reduced-motion: reduce)` desliga transicoes e o zoom das fotos.

- [ ] **Step 4: Apagar a maqueta** `website/discover/_proposta-redesign.html` (nunca foi commitada, por isso basta apagar o ficheiro).

- [ ] **Step 5: Testes e verificacao final.**
Run: `node --test tests/website/`
Expected: `pass 12`, `fail 0`.
No browser (procedimento do topo), a 375, 768 e 1280 px: `scrollWidth <= innerWidth`; consola sem erros; PT/EN e EUR/CVE em todas as seccoes; favoritos (anonimo) a funcionar; rodape com os 4 logos. Parar o servidor de dados e o preview.

- [ ] **Step 6: Commit**

```bash
git add website/discover/index.html
git commit -m "chore: acabamento do novo Discover e remocao da maqueta"
```

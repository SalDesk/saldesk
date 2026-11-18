# Pedido Automatico de Avaliacao Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pedir avaliacao por e-mail, automaticamente, no dia a seguir a actividade/estadia, e dar ao turista uma pagina publica que funcione para a deixar.

**Architecture:** Regras puras num helper novo (`backend/src/helpers/pedidoAvaliacao.js`), um servico que cria o pedido e envia o e-mail (`backend/src/services/pedidoAvaliacaoService.js`) usado pela tarefa diaria (node-cron, 10:00 Cabo Verde) e pelo pedido manual, dois endpoints publicos novos (`GET /reviews/token/:token`, definicoes autenticadas `GET/PUT /reviews/settings`), uma pagina React publica `/review/:token` e um interruptor no ecra Feedback.

**Tech Stack:** Backend Express + Supabase (jest, `npx jest`), frontend React 18 + Vite + Tailwind (vitest, `npx vitest run`).

**Spec:** `docs/superpowers/specs/2026-11-18-pedido-automatico-avaliacao-design.md`

## Global Constraints

- Envio so por e-mail (`enviarEmail` de `backend/src/helpers/emailHelper.js`); nenhum WhatsApp automatico.
- Elegivel: `check_out` entre hoje-3 e hoje-1 (Cabo Verde, `Atlantic/Cape_Verde`); `status` em `confirmed`, `checked_in`, `checked_out`; `source` em `public`, `manual`, `admin` ou vazio; `customer_email` preenchido; sem linha em `reviews`; `operators.review_auto_request` nao `false`; plano activo pela regra `isPlanActive`; `operators.is_demo` falso; nao o operador `process.env.WANDR_INTERNAL_OPERATOR_ID`.
- Validade do token: 30 dias (automatico e manual).
- Nunca substituir uma avaliacao ja dada (`rating` nao null): pedido manual responde 409 `ALREADY_REVIEWED`.
- Falha de envio: a linha em `reviews` fica (a fila `email_failures`/`emailRetryService` reenvia com o mesmo link).
- `GET /reviews/token/:token` so devolve: nome do operador, slug, `brand_color`, nome da unidade, `check_in`, primeiro nome do cliente, lingua (`detectarIdioma(customer_country)`), estado `ok|expirado|invalido`. Nunca e-mail, telefone, precos nem ids.
- Migracao `database/076_review_auto_request.sql`: `alter table operators add column if not exists review_auto_request boolean not null default true;` (aplicar em producao so com autorizacao, antes do backend).
- Sem emojis; textos novos da app em pt/en/de/nl.
- Commit so como os passos indicam; nada de implantar.

## Review Focus

- Reserva de OTA (`source = 'getyourguide'`) com e-mail e data na janela: nunca recebe pedido. Teste em Task 1 (`ota_nunca_e_elegivel`).
- Pedido manual para reserva ja avaliada: 409 e a avaliacao fica intacta. Teste em Task 2 (`pedido_manual_nao_apaga_avaliacao`).
- Tarefa a correr duas vezes no mesmo dia: a segunda nao envia nada (ja ha linha em `reviews`). Teste em Task 2 (`segunda_corrida_nao_reenvia`).
- Link com token expirado ou ja usado: a pagina mostra o estado certo, sem formulario. Teste em Task 4 (`link_expirado_e_inactivo_sem_formulario`).
- Envio de estrelas sem escolher nenhuma: o botao fica desactivado. Teste em Task 4 (`sem_estrelas_nao_envia`).

---

### Task 1: Regras puras do pedido + migracao

**Files:**
- Create: `backend/src/helpers/pedidoAvaliacao.js`
- Create: `database/076_review_auto_request.sql`
- Modify: `backend/src/middleware/requirePlanActive.js` (exportar tambem `isPlanActive`: `module.exports = requirePlanActive; module.exports.isPlanActive = isPlanActive;`)
- Test: `backend/src/__tests__/pedidoAvaliacao.test.js`

**Interfaces:**
- Produces (`pedidoAvaliacao.js`):
  - `VALIDADE_TOKEN_DIAS = 30`, `FONTES_DIRECTAS = ['public', 'manual', 'admin']`, `ESTADOS_AVALIAVEIS = ['confirmed', 'checked_in', 'checked_out']`
  - `hojeCaboVerde(agora: Date) -> 'YYYY-MM-DD'`
  - `janelaPedidoAutomatico(agora: Date) -> { de: string, ate: string }` (hoje-3 .. hoje-1, inclusive)
  - `reservaElegivel(reserva, operador, { de, ate, internoId }) -> boolean` (reserva: `{ status, source, customer_email, check_out }`; operador: `{ id, review_auto_request, is_demo, plan_status, trial_ends_at, plan_paid_until }`; nao verifica a existencia de review — isso e do servico)
  - `podeAvaliarViajante(reserva, hoje: string) -> boolean` (`status` avaliavel e `check_out < hoje`)
  - `estadoDoToken(review | null, agora: Date) -> 'ok' | 'expirado' | 'invalido'` (`null` ou sem token -> invalido; `token_expires_at <= agora` -> expirado)
  - `preencherModelo(texto, { nome_cliente, nome_tour, link }) -> string` (substitui `{nome_cliente}`, `{nome_tour}`, `{link_avaliacao}` em todas as ocorrencias)
  - `DEFAULT_TEMPLATE = { subject_pt, subject_en, body_pt, body_en }` com o texto neutro do spec (PT exacto do spec; EN: subject "How was it? Leave your review", body "Hello {nome_cliente},\n\nThank you for choosing {nome_tour}. We hope you had a great time!\n\nYour opinion helps us and helps other travellers choose. It takes less than a minute:\n\n{link_avaliacao}\n\nThank you!")

- [ ] **Step 1: Escrever os testes que falham** (`pedidoAvaliacao.test.js`, `jest.useFakeTimers` nao e preciso: passar `agora` explicito)

```js
const R = require('../helpers/pedidoAvaliacao');
const AGORA = new Date('2026-11-19T00:30:00Z'); // ainda 18 nov em Cabo Verde
const JAN = { de: '2026-11-15', ate: '2026-11-17', internoId: 'int-1' };
const OP = { id: 'op1', review_auto_request: true, is_demo: false, plan_status: 'active' };
const RES = { status: 'confirmed', source: 'public', customer_email: 'a@b.cv', check_out: '2026-11-17' };

test('janela_e_hoje_menos_3_a_hoje_menos_1_em_cabo_verde', () => {
  expect(R.hojeCaboVerde(AGORA)).toBe('2026-11-18');
  expect(R.janelaPedidoAutomatico(AGORA)).toEqual({ de: '2026-11-15', ate: '2026-11-17' });
});
test('reserva_directa_na_janela_e_elegivel', () => {
  expect(R.reservaElegivel(RES, OP, JAN)).toBe(true);
  expect(R.reservaElegivel({ ...RES, source: null }, OP, JAN)).toBe(true);
  expect(R.reservaElegivel({ ...RES, status: 'checked_out', source: 'manual' }, OP, JAN)).toBe(true);
});
test('ota_nunca_e_elegivel', () => {
  ['getyourguide', 'viator', 'booking'].forEach((s) => expect(R.reservaElegivel({ ...RES, source: s }, OP, JAN)).toBe(false));
});
test('fora_da_janela_estado_ou_sem_email_nao_e_elegivel', () => {
  expect(R.reservaElegivel({ ...RES, check_out: '2026-11-18' }, OP, JAN)).toBe(false);
  expect(R.reservaElegivel({ ...RES, check_out: '2026-11-14' }, OP, JAN)).toBe(false);
  ['pending', 'cancelled', 'no_show'].forEach((st) => expect(R.reservaElegivel({ ...RES, status: st }, OP, JAN)).toBe(false));
  expect(R.reservaElegivel({ ...RES, customer_email: '  ' }, OP, JAN)).toBe(false);
});
test('operador_desligado_demo_interno_ou_sem_plano_nao_e_elegivel', () => {
  expect(R.reservaElegivel(RES, { ...OP, review_auto_request: false }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, is_demo: true }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, id: 'int-1' }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, plan_status: 'suspended' }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, plan_status: 'trial', trial_ends_at: '2026-11-01T00:00:00Z' }, JAN)).toBe(false);
  expect(R.reservaElegivel(RES, { ...OP, review_auto_request: null }, JAN)).toBe(true);
});
test('viajante_pode_avaliar_reserva_passada_sem_check_out', () => {
  expect(R.podeAvaliarViajante({ status: 'confirmed', check_out: '2026-11-17' }, '2026-11-18')).toBe(true);
  expect(R.podeAvaliarViajante({ status: 'confirmed', check_out: '2026-11-18' }, '2026-11-18')).toBe(false);
  expect(R.podeAvaliarViajante({ status: 'cancelled', check_out: '2026-11-10' }, '2026-11-18')).toBe(false);
});
test('estado_do_token', () => {
  expect(R.estadoDoToken(null, AGORA)).toBe('invalido');
  expect(R.estadoDoToken({ review_token: 'x', token_expires_at: '2026-12-01T00:00:00Z' }, AGORA)).toBe('ok');
  expect(R.estadoDoToken({ review_token: 'x', token_expires_at: '2026-11-01T00:00:00Z' }, AGORA)).toBe('expirado');
  expect(R.estadoDoToken({ review_token: null, token_expires_at: null }, AGORA)).toBe('invalido');
});
test('modelo_por_omissao_e_neutro_e_preenchido', () => {
  expect(R.DEFAULT_TEMPLATE.subject_pt).toBe('Como correu? Deixe a sua avaliacao');
  expect(R.DEFAULT_TEMPLATE.body_pt).not.toMatch(/tour/i);
  expect(R.preencherModelo('{nome_cliente}|{nome_tour}|{link_avaliacao}|{link_avaliacao}', { nome_cliente: 'Ana', nome_tour: 'Buggy', link: 'L' })).toBe('Ana|Buggy|L|L');
  expect(R.VALIDADE_TOKEN_DIAS).toBe(30);
});
```

- [ ] **Step 2: Correr e ver falhar**
Run (em `backend/`): `npx jest src/__tests__/pedidoAvaliacao.test.js`
Expected: FAIL com `Cannot find module '../helpers/pedidoAvaliacao'`.

- [ ] **Step 3: Implementar** `pedidoAvaliacao.js` (usa `isPlanActive` de `../middleware/requirePlanActive`; datas em `en-CA` com `timeZone: 'Atlantic/Cape_Verde'`; somar/subtrair dias sobre a data CV em UTC ao meio-dia para nao escorregar), exportar `isPlanActive` no middleware, e criar a migracao 076 com o comentario do porque e "aplicar ANTES do backend".

- [ ] **Step 4: Correr e ver passar**
Run: `npx jest src/__tests__/pedidoAvaliacao.test.js` -> 8 passed. Depois `npx jest` (suite toda) sem falhas novas.

- [ ] **Step 5: Commit**
```bash
git add backend/src/helpers/pedidoAvaliacao.js backend/src/middleware/requirePlanActive.js backend/src/__tests__/pedidoAvaliacao.test.js database/076_review_auto_request.sql docs/superpowers/specs/2026-11-18-pedido-automatico-avaliacao-design.md docs/superpowers/plans/2026-11-18-pedido-automatico-avaliacao.md
git commit -m "feat: regras do pedido automatico de avaliacao e coluna review_auto_request"
```

---

### Task 2: Servico de envio, tarefa diaria e pedido manual

**Files:**
- Create: `backend/src/services/pedidoAvaliacaoService.js`
- Modify: `backend/src/controllers/reviewController.js` (`requestReview` usa o servico; `DEFAULT_TEMPLATE` passa a vir do helper)
- Modify: `backend/src/services/cronService.js` (agenda `'0 10 * * *'`, `timezone: 'Atlantic/Cape_Verde'`, chama `enviarPedidosAutomaticos`; actualizar a mensagem de arranque)
- Test: `backend/src/__tests__/pedidoAvaliacaoService.test.js`

**Interfaces:**
- Consumes: Task 1 (todas as funcoes do helper).
- Produces:
  - `enviarPedido(reserva, { operadorId }) -> Promise<{ ok: true, token, link } | { ok: false, code: 'ALREADY_REVIEWED' | 'NO_EMAIL' }>` — `reserva` com `id, customer_name, customer_email, customer_id, customer_country, units: { name }`. Le a linha de `reviews` da reserva: com `rating` nao null -> `ALREADY_REVIEWED`; senao upsert (`onConflict: 'reservation_id'`) com token novo (`crypto.randomBytes(20).toString('hex')`), validade 30 dias, `rating: null`, `is_public: false`; modelo de `review_request_templates` do operador ou `DEFAULT_TEMPLATE`; lingua `detectarIdioma(customer_country)`; `link = ${frontendBase()}/review/${token}`; `await enviarEmail({ to, subject, text })` e engole o erro (a fila de reenvio trata).
  - `enviarPedidosAutomaticos(agora = new Date()) -> Promise<{ enviados: number, ignorados: number }>` — pede `reservations` com `check_out` entre `janela.de` e `janela.ate`, `status` em `ESTADOS_AVALIAVEIS` (select com `operator_id, ... , units(name)`), os operadores dessas reservas (`id, review_auto_request, is_demo, plan_status, trial_ends_at, plan_paid_until`) e as `reviews` ja existentes dessas reservas; filtra com `reservaElegivel` e sem review; chama `enviarPedido` uma a uma; `console.log('[Avaliacoes] pedidos automaticos: N enviados, M ignorados')` sem dados pessoais.

- [ ] **Step 1: Testes que falham** (falso do Supabase por tabela, como em `guestChatAutoReply.test.js`; `emailHelper`, `languageHelper` simulados; `agora = 2026-11-19T00:30:00Z`):
  - `envia_pedido_a_reserva_elegivel`: 1 reserva directa na janela, operador activo -> `enviarEmail` chamado 1x com `to` = e-mail do cliente e texto com `https://app.saldesk.cv/review/`; upsert em `reviews` com `rating: null`, `is_public: false` e `token_expires_at` ~30 dias depois; devolve `{ enviados: 1, ignorados: 0 }`.
  - `ignora_ota_operador_desligado_e_ja_pedidas`: reservas `getyourguide`, de operador com `review_auto_request: false`, e uma ja com linha em `reviews` -> `enviarEmail` nunca chamado; `{ enviados: 0, ignorados: 3 }`.
  - `segunda_corrida_nao_reenvia`: depois de uma corrida, o falso passa a devolver a linha criada; segunda corrida -> 0 enviados.
  - `pedido_manual_nao_apaga_avaliacao`: `enviarPedido` para reserva com review `rating: 5` -> `{ ok: false, code: 'ALREADY_REVIEWED' }`, sem upsert nem e-mail.
  - `falha_de_email_mantem_o_pedido`: `enviarEmail` rejeita -> nao lanca, conta como enviado, linha criada fica (nenhum delete em `reviews`).
  - `cliente_em_ingles_recebe_modelo_en`: `detectarIdioma` devolve `'en'` -> assunto `How was it? Leave your review` (sem modelo proprio do operador).

- [ ] **Step 2: Correr e ver falhar**
Run: `npx jest src/__tests__/pedidoAvaliacaoService.test.js` -> FAIL `Cannot find module`.

- [ ] **Step 3: Implementar** o servico; `requestReview` passa a: validar reserva do operador (como hoje), `NO_EMAIL` 400 como hoje, chamar `enviarPedido`; `ALREADY_REVIEWED` -> 409 `{ error: 'Esta reserva ja foi avaliada', code: 'ALREADY_REVIEWED' }`; sucesso -> 200 como hoje. Agendar no `iniciarCron`.

- [ ] **Step 4: Correr e ver passar**
Run: `npx jest src/__tests__/pedidoAvaliacaoService.test.js` -> 6 passed; `npx jest` sem falhas novas.

- [ ] **Step 5: Commit**
```bash
git add backend/src/services/pedidoAvaliacaoService.js backend/src/controllers/reviewController.js backend/src/services/cronService.js backend/src/__tests__/pedidoAvaliacaoService.test.js
git commit -m "feat: tarefa diaria de pedido de avaliacao e pedido manual que nunca apaga avaliacoes"
```

---

### Task 3: Endpoints publicos e de definicoes; viajantes

**Files:**
- Modify: `backend/src/controllers/reviewController.js` (`tokenInfo`, `obterDefinicoes`, `guardarDefinicoes`)
- Modify: `backend/src/routes/reviews.js` (`GET /token/:token` e `POST /submit` com `publicLimiter`; `GET/PUT /settings` autenticadas)
- Modify: `backend/src/controllers/travelerController.js` (`can_review` e `submitReview` com `podeAvaliarViajante`)
- Test: `backend/src/__tests__/reviewToken.test.js`

**Interfaces:**
- Consumes: Task 1 (`estadoDoToken`, `podeAvaliarViajante`, `hojeCaboVerde`).
- Produces:
  - `GET /api/v1/reviews/token/:token` -> 200 `{ data: { estado: 'ok', operador: { name, slug, brand_color }, unidade: string|null, data: 'YYYY-MM-DD', cliente: primeiroNome|null, lingua: 'pt'|'en' } }`; estado `expirado` -> 200 com `{ data: { estado: 'expirado', operador: { name, slug, brand_color } } }`; nao encontrado -> 200 `{ data: { estado: 'invalido' } }`.
  - `GET /api/v1/reviews/settings` -> `{ data: { review_auto_request: boolean } }`; `PUT` com `{ review_auto_request: boolean }` (400 `INVALID_VALUE` se nao for booleano) -> mesmo formato.

- [ ] **Step 1: Testes que falham** (controladores chamados directamente com `req`/`res` falsos, Supabase falso):
  - `token_valido_devolve_so_o_necessario`: resposta tem `estado: 'ok'`, nome do operador, unidade, `cliente: 'Ana'` (de `customer_name: 'Ana Silva'`), `lingua`; `JSON.stringify(resposta)` nao contem o e-mail, o telefone, `total_price` nem o id da reserva.
  - `token_expirado_e_invalido`: expirado -> `estado: 'expirado'`; inexistente -> `estado: 'invalido'`.
  - `definicoes_le_e_grava_booleano`: `PUT { review_auto_request: false }` actualiza `operators` do proprio operador; `PUT { review_auto_request: 'nao' }` -> 400 `INVALID_VALUE`.
  - `viajante_avalia_reserva_confirmada_passada`: `submitReview` do viajante com reserva `confirmed` e `check_out` ontem -> 201; reserva com `check_out` hoje -> 400 `INVALID_STATUS`.

- [ ] **Step 2: Correr e ver falhar** — `npx jest src/__tests__/reviewToken.test.js` -> FAIL (funcoes inexistentes).

- [ ] **Step 3: Implementar**; nas rotas, `router.get('/token/:token', publicLimiter, tokenInfo)` e `router.post('/submit', publicLimiter, submitReview)` antes de `router.use(auth)`; `/settings` depois do `requirePlanActive`. Em `getBookings`, `can_review: podeAvaliarViajante(r, hojeCaboVerde(new Date())) && !reviewMap[r.id]`.

- [ ] **Step 4: Correr e ver passar** — `npx jest src/__tests__/reviewToken.test.js` -> 4 passed; `npx jest` sem falhas novas.

- [ ] **Step 5: Commit**
```bash
git add backend/src/controllers/reviewController.js backend/src/routes/reviews.js backend/src/controllers/travelerController.js backend/src/__tests__/reviewToken.test.js
git commit -m "feat: endpoint publico do link de avaliacao, definicao do pedido automatico e viajantes avaliam sem check-out"
```

---

### Task 4: Pagina publica `/review/:token`

**Files:**
- Create: `frontend/src/pages/ReviewPage.jsx`
- Modify: `frontend/src/App.jsx` (rota publica `/review/:token`, junto de `/book/:slug`, import directo como `BookingSuccess`)
- Modify: `frontend/src/i18n/{pt,en,de,nl}.json` (chaves `review.*`)
- Test: `frontend/src/__tests__/ReviewPage.test.jsx`

**Interfaces:**
- Consumes: Task 3 (`GET /reviews/token/:token`), `POST /reviews/submit` existente (`{ token, rating, comment }`).
- Chamadas com `fetch` e `import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'` (como `PublicBooking.jsx`), sem o cliente autenticado.

- [ ] **Step 1: Testes que falham** (`global.fetch` simulado; `MemoryRouter initialEntries={['/review/abc']}` com `<Route path="/review/:token">`):
  - `mostra_operador_unidade_e_formulario`: `estado: 'ok'` -> mostra nome do operador e da unidade, 5 botoes de estrela com `aria-label` "1 estrela".."5 estrelas", campo de comentario, botao "Enviar avaliação".
  - `sem_estrelas_nao_envia`: botao desactivado ate escolher estrelas; com 4 estrelas e comentario -> `fetch` chamado com `POST .../reviews/submit` e corpo `{ token: 'abc', rating: 4, comment: '...' }`; depois mostra o agradecimento com link para `/book/<slug>`.
  - `link_expirado_e_inactivo_sem_formulario`: `expirado` -> texto de link expirado e sem estrelas; `invalido` -> "Este link já não está activo. Se já deixou a sua avaliação, obrigado!" e sem estrelas.
  - `erro_de_rede_mostra_tentar_de_novo`: `fetch` rejeita -> botao "Tentar de novo" que repete o pedido.
  - `cliente_em_ingles_ve_a_pagina_em_ingles`: `lingua: 'en'` -> "Send review".

- [ ] **Step 2: Correr e ver falhar** — em `frontend/`: `npx vitest run src/__tests__/ReviewPage.test.jsx` -> FAIL (modulo inexistente).

- [ ] **Step 3: Implementar** a pagina (estilo de `BookingSuccess.jsx`/`PublicBooking.jsx`: fundo `bg-n-50`, cartao branco centrado, telemovel primeiro; cor do botao com `brand_color` quando existe; estrelas com `lucide-react` `Star`; comentario ate 1000 caracteres com contador; troca PT/EN; respostas 400/404/410 do `submit` mostram o estado correspondente). Textos via `review.*` nas 4 linguas.

- [ ] **Step 4: Correr e ver passar** — `npx vitest run src/__tests__/ReviewPage.test.jsx` -> 5 passed; `npx vitest run` (suite) sem falhas novas; `npm run build` OK.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/ReviewPage.jsx frontend/src/App.jsx frontend/src/i18n frontend/src/__tests__/ReviewPage.test.jsx
git commit -m "feat: pagina publica para o turista deixar a avaliacao pelo link"
```

---

### Task 5: Interruptor no Feedback e modelo neutro

**Files:**
- Modify: `frontend/src/pages/Feedback.jsx` (interruptor no separador "Template"; `DEFAULT_TEMPLATE` igual ao do backend)
- Test: `frontend/src/__tests__/Feedback.test.jsx` (acrescentar)

**Interfaces:**
- Consumes: Task 3 (`GET/PUT /reviews/settings`).

- [ ] **Step 1: Testes que falham** (no ficheiro existente, com o `api` simulado):
  - `interruptor_do_pedido_automatico_le_e_grava`: `api.get('/reviews/settings')` devolve `{ review_auto_request: true }` -> no separador Template ha um interruptor (`role="switch"`, nome "Pedir avaliação automaticamente no dia a seguir") ligado; ao clicar -> `api.put('/reviews/settings', { review_auto_request: false })` e fica desligado; se o `put` falhar volta a ligado e mostra erro.
  - `modelo_por_omissao_neutro`: sem modelo guardado, o assunto PT mostrado e "Como correu? Deixe a sua avaliacao".

- [ ] **Step 2: Correr e ver falhar** — `npx vitest run src/__tests__/Feedback.test.jsx` -> as 2 novas falham.

- [ ] **Step 3: Implementar** com o `Toggle` de `components/ui` (ja acessivel: `role=switch`, `description`); texto de ajuda: "Envia um e-mail no dia a seguir à actividade ou estadia, só a reservas directas e uma vez por reserva."; o pedido de definicoes junta-se ao `Promise.all` do carregamento e cai para `true` se falhar.

- [ ] **Step 4: Correr e ver passar** — `npx vitest run src/__tests__/Feedback.test.jsx` -> todos; `npx vitest run` e `npm run build` OK.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/Feedback.jsx frontend/src/__tests__/Feedback.test.jsx
git commit -m "feat: operador pode desligar o pedido automatico de avaliacao; modelo por omissao neutro"
```

---

### Verificacao final (depois das 5 tarefas)

- Backend: `npx jest` (em `backend/`) -> sem falhas novas.
- Frontend: `npx vitest run` e `npm run build` (em `frontend/`) -> OK.
- Browser (API falsa local, sessao falsa como nas etapas anteriores): `/review/<token>` nos estados ok/expirado/invalido em 375 e 1280 px; separador Template do Feedback com o interruptor.
- Implantacao fica para depois, com ordem do dono: (1) dono corre o script do SendGrid; (2) migracao 076 em producao; (3) backend (copiar so os ficheiros, `node --check`, `pm2 reload saldesk-api`); (4) frontend.

# Cancelamento Gratis, Confirmacao Imediata e Recolha no Hotel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O operador escolhe o prazo de cancelamento gratis, liga a confirmacao automatica e marca a recolha no hotel; os cartoes mostram-no e a pagina de reserva deixa de dizer "ainda nao definiu" quando ha prazo.

**Architecture:** Duas colunas novas em `operators`; regras puras no backend (`backend/src/helpers/politicaOperador.js`), na app (`frontend/src/utils/politicaCancelamento.js`) e no site (`website/discover/_cartao.js`), cada uma com testes; os ecras e os cartoes so chamam essas regras.

**Tech Stack:** Express + Supabase (jest), React + Vite (vitest), HTML/JS simples (node --test).

**Spec:** `docs/superpowers/specs/2026-11-19-cancelamento-confirmacao-recolha-design.md`

## Global Constraints

- Migracao `database/077_cancelamento_confirmacao.sql`: `operators.free_cancellation_hours integer null` com `check (free_cancellation_hours is null or free_cancellation_hours in (0, 24, 48, 72, 168))`; `operators.auto_confirm_bookings boolean not null default false`. Aplicar em producao so com autorizacao, antes do backend.
- Valores do prazo: `null` sem prazo definido; `0` sem cancelamento gratis; `24`, `48`, `72`, `168` (7 dias).
- Confirmacao automatica: reserva publica entra `confirmed` so quando `auto_confirm_bookings === true` e `payment_method === 'cash'`; em tudo o resto `pending` (como hoje).
- Texto da politica, por lingua: texto escrito nessa lingua > texto escrito na outra lingua > texto gerado pelo prazo > nada (aviso actual).
- Textos gerados (exactos): 24/48/72 PT "Cancelamento gratuito até {N} horas antes do início. Depois desse prazo, o valor pago não é reembolsado." EN "Free cancellation up to {N} hours before the start. After that, the amount paid is not refunded."; 168 PT "Cancelamento gratuito até 7 dias antes do início. Depois desse prazo, o valor pago não é reembolsado." EN "Free cancellation up to 7 days before the start. After that, the amount paid is not refunded."; 0 PT "Esta reserva não tem cancelamento gratuito: o valor pago não é reembolsado em caso de cancelamento." EN "This booking has no free cancellation: the amount paid is not refunded if you cancel."
- Beneficios do cartao (exactos, por esta ordem): PT "Cancelamento grátis até 24 h antes" / "48 h" / "72 h" / "7 dias", "Confirmação imediata", "Recolha no hotel"; EN "Free cancellation up to 24 h before" / "48 h" / "72 h" / "7 days", "Instant confirmation", "Hotel pickup".
- Sem emojis; implantacao so com ordem do dono.

## Review Focus

- Turista escolhe PayPal com confirmacao automatica ligada e desiste: a reserva fica `pending`. Teste em Task 1 (`pagamento_online_nunca_confirma_sozinho`).
- Operador escreveu politica so em PT e escolheu prazo: em EN aparece o texto PT dele, nunca o gerado. Teste em Task 2 (`texto_escrito_noutra_lingua_ganha_ao_gerado`).
- Valor de prazo invalido enviado a mao (ex.: 36 ou "abc"): 400 e nada gravado. Teste em Task 1 (`prazo_invalido_e_recusado`).
- Operador com prazo `0`: o cartao nao mostra nada de cancelamento e a politica gerada diz que nao ha reembolso. Testes em Task 2 e Task 4.
- Recolha marcada e tambem escrita em "O que inclui": aparece so uma vez. Teste em Task 4 (`recolha_nao_se_repete_nos_incluidos`).

---

### Task 1: Base de dados e servidor

**Files:**
- Create: `database/077_cancelamento_confirmacao.sql`, `backend/src/helpers/politicaOperador.js`
- Modify: `backend/src/controllers/onboardingController.js` (PUT do perfil), `backend/src/controllers/publicController.js` (operador em `GET /public/:slug` linha ~19, `getUnit` ~1170, `criarReserva` ~228 e ~462), `backend/src/services/discoverCatalogService.js` (select do operador ~14 e objecto devolvido por unidade)
- Test: `backend/src/__tests__/politicaOperador.test.js`

**Interfaces:**
- Produces:
  - `HORAS_CANCELAMENTO = [0, 24, 48, 72, 168]`
  - `validarHorasCancelamento(valor) -> { ok: true, valor: number|null } | { ok: false }` — aceita `null`, `''` (-> null) e numeros/textos numericos da lista; o resto e invalido.
  - `estadoInicialReserva({ autoConfirm, paymentMethod }) -> 'confirmed' | 'pending'`
  - PUT do perfil aceita `free_cancellation_hours` (400 `INVALID_FREE_CANCELLATION`) e `auto_confirm_bookings` (booleano; 400 `INVALID_AUTO_CONFIRM`).
  - `GET /public/:slug` e `getUnit` devolvem `free_cancellation_hours` e `auto_confirm_bookings` no operador; `getUnit` passa tambem a devolver `cancellation_policy_pt`, `cancellation_policy_en`.
  - `/public/discover-units` devolve por unidade `free_cancellation_hours` e `auto_confirm_bookings`.
  - `criarReserva` le `payment_method` do corpo e usa `estadoInicialReserva` com `operator.auto_confirm_bookings`.

- [ ] **Step 1: Testes que falham** (`politicaOperador.test.js`):
  - `prazos_validos`: `validarHorasCancelamento(null|''|0|24|'48'|72|168)` -> ok com `null,null,0,24,48,72,168`.
  - `prazo_invalido_e_recusado`: `36`, `-1`, `'abc'`, `24.5`, `true` -> `{ ok: false }`.
  - `pagar_presencialmente_com_confirmacao_automatica_confirma`: `{ autoConfirm: true, paymentMethod: 'cash' }` -> `'confirmed'`.
  - `pagamento_online_nunca_confirma_sozinho`: `paypal`, `sisp`, `undefined`, `'outro'` com `autoConfirm: true` -> `'pending'`; `cash` com `autoConfirm: false|undefined` -> `'pending'`.
  - `perfil_grava_e_valida_os_campos_novos`: com o falso do Supabase como em `operatorBrandColor.test.js`, o PUT com `{ free_cancellation_hours: 48, auto_confirm_bookings: true }` grava ambos; com `{ free_cancellation_hours: 36 }` -> 400 `INVALID_FREE_CANCELLATION` sem gravar; com `{ auto_confirm_bookings: 'sim' }` -> 400 `INVALID_AUTO_CONFIRM`.
- [ ] **Step 2:** `cd backend && npx jest src/__tests__/politicaOperador.test.js` -> FAIL (modulo inexistente).
- [ ] **Step 3: Implementar** helper, migracao (comentario: aplicar ANTES do backend), PUT do perfil, selects e `criarReserva`.
- [ ] **Step 4:** o mesmo comando -> todos passam; `npx jest` sem falhas novas; `node --check` nos ficheiros mexidos.
- [ ] **Step 5: Commit** `feat: prazo de cancelamento e confirmacao automatica por operador no servidor`

---

### Task 2: Texto da politica na app e forma de pagamento nas reservas

**Files:**
- Create: `frontend/src/utils/politicaCancelamento.js`
- Modify: `frontend/src/pages/ServiceDetail.jsx` (caixa de aceitacao ~295 e seccao da politica ~1557; os tres `buildPayload` ~570, ~639, ~726 passam a enviar `payment_method: pay`), `frontend/src/components/shared/SiteComplianceFooter.jsx` (~17), `frontend/src/components/restaurant/RestaurantReservationWidget.jsx` (corpo do pedido ~293: `payment_method: 'cash'`)
- Test: `frontend/src/__tests__/politicaCancelamento.test.js`

**Interfaces:**
- Consumes: Task 1 (`op.free_cancellation_hours`, `op.cancellation_policy_pt/en`).
- Produces: `textoPoliticaGerada(horas, lang) -> string|null`; `textoPoliticaCancelamento(op, lang) -> string|null` (ordem dos Global Constraints).

- [ ] **Step 1: Testes que falham**:
  - `texto_gerado_por_prazo`: 24/48/72/168/0 em PT e EN iguais aos Global Constraints; `null` -> `null`.
  - `texto_escrito_ganha`: `{ cancellation_policy_pt: 'A minha', free_cancellation_hours: 24 }` -> PT `'A minha'`.
  - `texto_escrito_noutra_lingua_ganha_ao_gerado`: o mesmo operador em EN -> `'A minha'`.
  - `sem_texto_nem_prazo_da_null`: `{}` -> `null`; texto so com espacos conta como vazio.
- [ ] **Step 2:** `cd frontend && npx vitest run src/__tests__/politicaCancelamento.test.js` -> FAIL.
- [ ] **Step 3: Implementar** o helper e usa-lo onde hoje se faz `(lang==='en'?op.cancellation_policy_en:op.cancellation_policy_pt)`; acrescentar `payment_method` aos pedidos.
- [ ] **Step 4:** o mesmo comando passa; `npx vitest run` sem falhas novas (ajustar asserts existentes que fixem o corpo exacto dos pedidos, com ruling); `npm run build` OK.
- [ ] **Step 5: Commit** `feat: politica de cancelamento gerada pelo prazo e forma de pagamento enviada na reserva`

---

### Task 3: Definicoes e formulario de actividade

**Files:**
- Modify: `frontend/src/pages/settings/PerfilPublicoTab.jsx` (cartao "Politica de cancelamento" ~205 e cartao novo "Confirmacao das reservas"), `frontend/src/components/units/forms/TourForm.jsx` (estado ~28-41, gravacao ~80-93, caixa junto do ponto de encontro ~243)
- Test: `frontend/src/__tests__/PerfilPublicoCancelamento.test.jsx`, acrescentar ao `frontend/src/__tests__/UnitForm.test.jsx`

**Interfaces:**
- Consumes: Task 1 (PUT do perfil), Task 2 (`textoPoliticaGerada`).

- [ ] **Step 1: Testes que falham**:
  - `prazo_e_confirmacao_vao_no_guardar`: render do `PerfilPublicoTab` com operador `{ free_cancellation_hours: null, auto_confirm_bookings: false }`; escolher "Cancelamento grátis até 48 h antes" na lista com etiqueta "Cancelamento grátis" e ligar o interruptor "Confirmar reservas automaticamente"; Guardar -> o pedido de gravacao leva `free_cancellation_hours: 48` e `auto_confirm_bookings: true`.
  - `previa_do_texto_gerado_so_sem_texto_escrito`: com 48 e textos vazios aparece o texto gerado PT de 48 h; com texto PT escrito nao aparece e aparece "Confirme que o texto abaixo diz o mesmo prazo."
  - `sem_prazo_envia_null`: escolher "Sem prazo definido" -> `free_cancellation_hours: null`.
  - (UnitForm.test) `tour_grava_recolha_no_hotel`: marcar "Inclui recolha no hotel" -> a descricao JSON gravada tem `pickup_included: true`; desmarcada -> `false`; uma actividade antiga sem o campo abre desmarcada.
- [ ] **Step 2:** `npx vitest run src/__tests__/PerfilPublicoCancelamento.test.jsx src/__tests__/UnitForm.test.jsx` -> as novas falham.
- [ ] **Step 3: Implementar** (opcoes da lista: "Sem prazo definido", "Cancelamento grátis até 24 h antes", "48 h", "72 h", "7 dias", "Sem cancelamento grátis"; ajuda e textos do spec; interruptor com o `Toggle` de `components/ui`).
- [ ] **Step 4:** passam; suite e build OK.
- [ ] **Step 5: Commit** `feat: operador escolhe o prazo de cancelamento, a confirmacao automatica e a recolha no hotel`

---

### Task 4: Cartoes do Discover e da pagina do ponto

**Files:**
- Modify: `website/discover/_cartao.js`, `website/discover/index.html` (`renderActCard`, CSS `.xp-perks`), `website/discover/ponto.html` (`renderXp`, CSS `.xp-perks`), versao `?v=` do `_cartao.js` nas duas paginas
- Test: `tests/website/cartao.test.js` (acrescentar)

**Interfaces:**
- Consumes: Task 1 (`free_cancellation_hours`, `auto_confirm_bookings` por unidade; `pickup_included` na descricao).
- Produces: `beneficiosCartao(item, meta, lang) -> string[]`; `incluidosTexto(meta, max)` passa a omitir itens com "recolha", "pickup" ou "pick-up" (sem distinguir maiusculas) quando `meta.pickup_included === true`.

- [ ] **Step 1: Testes que falham**:
  - `beneficios_por_ordem_e_so_quando_verdade`: `{ free_cancellation_hours: 24, auto_confirm_bookings: true }` + `{ pickup_included: true }` -> PT `['Cancelamento grátis até 24 h antes', 'Confirmação imediata', 'Recolha no hotel']`; 168 em EN -> `'Free cancellation up to 7 days before'`.
  - `sem_prazo_ou_sem_cancelamento_gratis_nao_mostra`: `null` e `0` -> sem item de cancelamento; `auto_confirm_bookings: false` -> sem confirmacao; sem `pickup_included` -> sem recolha; tudo vazio -> `[]`.
  - `recolha_nao_se_repete_nos_incluidos`: `{ pickup_included: true, included_items: ['Recolha no hotel', { label: 'Hotel pick-up and drop-off', included: true }, 'Guia'] }` -> `incluidosTexto` = `'Guia'`; sem `pickup_included` os tres ficam.
- [ ] **Step 2:** `node --test "tests/website/*.test.js"` -> as novas falham.
- [ ] **Step 3: Implementar** as regras e a linha `.xp-perks` (verde, icone de visto, " · ", reticencias; ausente quando vazia) nos dois cartoes, acima de `.xp-inc`.
- [ ] **Step 4:** testes passam; verificacao no browser com dados falsos (uma unidade com os tres beneficios, uma sem nenhum) a 375 e 1280 px, sem deslocamento horizontal.
- [ ] **Step 5: Commit** `feat: cartoes mostram cancelamento gratis, confirmacao imediata e recolha no hotel`

---

### Implantacao (depois da revisao final, com ordem do dono)
1. Migracao 077 em producao. 2. Backend: `helpers/politicaOperador.js`, `controllers/onboardingController.js`, `controllers/publicController.js`, `services/discoverCatalogService.js` (comparar antes com a versao anterior no servidor, copiar, `node --check`, `pm2 reload saldesk-api`). 3. App. 4. Site: `discover/_cartao.js`, `discover/index.html`, `discover/ponto.html`.

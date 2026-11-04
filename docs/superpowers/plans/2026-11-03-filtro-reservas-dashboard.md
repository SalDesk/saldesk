# Filtro de reservas dos dashboards (stay_from / stay_to) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer com que os dashboards peçam ao backend apenas as reservas relevantes ("de hoje", "do mes", "da semana") em vez de **todas as reservas de todas as datas**, sem partir as listas de check-out e de ocupacao de hotel e rent-a-car.

**Architecture:** O backend ganha dois parametros opcionais em `GET /reservations`, `stay_from` e `stay_to`, que devolvem as reservas cuja estadia **abrange** o intervalo (`check_in <= stay_to` e `check_out >= stay_from`, limites inclusivos). A logica de filtros de data sai do controller para um helper puro testado. O frontend passa a usar estes parametros nos seis dashboards (atividades, hotel, rent-a-car, restaurante, generico e Resumo) atraves de um pequeno helper, com os nomes dos parametros num so sitio. Nada muda no comportamento das outras paginas.

**Tech Stack:** Node/Express + Supabase (PostgREST) + jest (backend); React 18 + vitest (frontend).

**Spec/contexto:** defeito encontrado na revisao final da Fase 2 do redesenho (`docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md`, secao 6): os dashboards enviam `from`/`to`, mas `reservationsController.listar` so le `check_in_from`/`check_in_to`; os parametros sao ignorados e cada dashboard descarrega a tabela inteira (ate 3 vezes por visita), contando reservas de todas as datas como "hoje"/"do mes". Caminhos sao relativos a `backend/` ou `frontend/` conforme indicado em cada tarefa.

**Decisoes de desenho (para o utilizador rever):**
1. **Estadia que abrange o intervalo**, e nao "check_in dentro do intervalo". Hotel e rent-a-car precisam de reservas que comecaram antes e ainda estao ativas hoje (hospedes alojados, alugueres em curso, check-outs de hoje). Atividades e restaurante gravam `check_out = check_in` (o backend usa `check_out || check_in`), por isso o mesmo filtro devolve exatamente as reservas "de hoje" para eles. `check_out` e `NOT NULL` na base de dados (migracoes 002/017) e, desde a migracao 048, `check_out >= check_in`.
2. **Nao se faz alias de `from`/`to` no backend.** Mais 11 chamadas noutras paginas (Housekeeping, Weather, Demand, etc.) enviam `from`/`to` e hoje recebem tudo; um alias mudaria o comportamento dessas paginas sem auditoria. Ficam fora deste plano (ver "Fora de ambito").
3. **"Reservas pendentes" do hotel** (`monthRes.filter(pending)`) passa a contar as pendentes cuja estadia toca o mes atual (a intencao do nome `monthRes`), em vez de todas as pendentes de sempre.
4. **"Reservas recentes" do Resumo** passam a ser as 5 mais recentes (por `created_at`) entre as que tocam o mes atual.
5. **Ordem de implantacao:** o backend primeiro (e aditivo e compativel: um frontend antigo continua a funcionar), o frontend depois. Se o frontend novo chegar a um backend antigo, os parametros novos sao ignorados e o comportamento e o de hoje (nada piora).

## Global Constraints

- Nenhuma alteracao de comportamento nos parametros existentes de `GET /reservations` (`status`, `unit_id`, `check_in_from`, `check_in_to`, `seller_id`, regras do vendedor/staff): so se acrescentam `stay_from` e `stay_to`.
- Datas validadas como `YYYY-MM-DD` reais (rejeitar `2026-02-30`, texto, etc.) com resposta 400 e mensagem clara; nunca concatenar input do utilizador em strings de filtro (`.or(...)`): usar so `.gte`/`.lte` parametrizados.
- Sem emojis; comentarios em portugues sem acentos (estilo do repositorio); ficheiros mantem o fim de linha existente.
- O frontend calcula as datas em **hora local** (`toLocaleDateString('en-CA')`, `mesAtual()`), nunca por `toISOString` (UTC).
- Cada tarefa termina com os testes da respetiva pasta a passar (`npm test` em `backend/`, `npx vitest run` em `frontend/`), `npm run build` no frontend, e um commit.
- Nao arrancar o backend local contra a base de dados de producao para "experimentar"; a verificacao com dados reais faz-se na Tarefa 8, com o pedido explicito do utilizador.

## Review Focus

- Limites inclusivos: uma reserva que **acaba** em `stay_from` e uma que **comeca** em `stay_to` entram (um hospede que sai hoje aparece na lista de check-outs de hoje).
- So um dos dois parametros enviado (`stay_from` sozinho, `stay_to` sozinho): filtra pelo lado dado, sem erro.
- Datas invalidas ou `stay_from > stay_to`: resposta 400 com mensagem, nunca 500 nem ignorado em silencio.
- Hotel: um hospede que entrou antes de hoje e sai depois de hoje continua na lista do mapa de quartos (ocupacao); o check-out de hoje aparece; o check-in de hoje aparece (teste com dados controlados nas tres situacoes).
- 1.o dia do mes e viragem de ano: os intervalos de "mes atual" e "proximos 7 dias" continuam corretos (testes de datas independentes do dia em que correm).

---

### Task 1: Filtros de data de reservas no backend

**Files (em `backend/`):**
- Create: `src/helpers/reservationFilters.js`
- Modify: `src/controllers/reservationsController.js` (`listar`, ~linhas 32-48)
- Test: `src/__tests__/reservationFilters.test.js`, `src/__tests__/reservationsList.test.js`

**Interfaces:**
- Produces (exports de `reservationFilters.js`):
  - `lerFiltrosDeData(query: object): { checkInFrom?: string, checkInTo?: string, stayFrom?: string, stayTo?: string }` - le `check_in_from`, `check_in_to`, `stay_from`, `stay_to`; ignora os ausentes; valida cada valor presente como data `YYYY-MM-DD` existente no calendario e lanca um erro com `status = 400` e `message` em portugues ("Data invalida em <parametro>: <valor>") se invalida; lanca erro 400 se `stayFrom > stayTo` ou `checkInFrom > checkInTo` (comparacao de strings ISO).
  - `aplicarFiltrosDeData(q, filtros)`: devolve `q` (builder do PostgREST) com `checkInFrom -> q.gte('check_in', v)`, `checkInTo -> q.lte('check_in', v)`, `stayTo -> q.lte('check_in', v)` (a estadia comeca ate ao fim do intervalo) e `stayFrom -> q.gte('check_out', v)` (a estadia acaba a partir do inicio do intervalo).
- `listar` passa a: `const filtros = lerFiltrosDeData(req.query)` dentro do `try` (um erro com `status` 400 responde 400 com `{ error: message }` no formato que os outros controllers ja usam para erros de validacao; o implementador copia o padrao existente em `criar`/`actualizar`) e `q = aplicarFiltrosDeData(q, filtros)`; o resto (status, unit_id, vendedor) fica como esta.

- [ ] **Step 1: Testes do helper (falham).** `reservationFilters.test.js` com um builder falso que regista as chamadas (`gte`/`lte` devolvem o proprio objeto):
  - `sem parametros`: `lerFiltrosDeData({})` devolve `{}` e `aplicarFiltrosDeData` nao chama nada.
  - `stay_from e stay_to`: `{ stay_from: '2026-11-03', stay_to: '2026-11-03' }` regista `lte('check_in','2026-11-03')` e `gte('check_out','2026-11-03')`.
  - `so stay_from`: so `gte('check_out', ...)`; `so stay_to`: so `lte('check_in', ...)`.
  - `check_in_from/check_in_to existentes`: `gte('check_in', ...)` e `lte('check_in', ...)` como antes (comportamento preservado).
  - `datas invalidas`: `'2026-02-30'`, `'abc'`, `'2026-13-01'`, `''` (string vazia conta como ausente), `'2026-1-5'` lancam erro com `status 400` e mensagem que nomeia o parametro.
  - `intervalo invertido`: `stay_from '2026-11-10'` e `stay_to '2026-11-03'` lanca 400.
  - `ano bissexto`: `'2028-02-29'` valido, `'2027-02-29'` invalido.
- [ ] **Step 2: Teste do controller (falha).** `reservationsList.test.js` com `jest.mock('../config/supabase')` e um builder falso encadeavel: `stay_from`/`stay_to` chegam ao builder (`lte('check_in',..)`, `gte('check_out',..)`); data invalida responde 400 sem chamar a base de dados; pedido sem parametros de data continua a chamar so o `eq('operator_id', ...)` e `order` (comportamento atual); `status`/`unit_id` continuam a ser aplicados.
- [ ] **Step 3: Correr.** Run: `npm test -- reservationFilters reservationsList` (em `backend/`). Expected: FAIL (modulo inexistente).
- [ ] **Step 4: Implementar** `reservationFilters.js` e ligar o `listar`.
- [ ] **Step 5: Correr.** Run: `npm test` (em `backend/`). Expected: PASS. Os dois testes que ja falhavam antes desta tarefa (`bookingHelpers` e `financeiroHelpers`, conhecidos e sem relacao) mantem-se como estao: confirmar e dizer no relatorio que sao os mesmos dois e que nada novo falha.
- [ ] **Step 6: Commit.** `git add backend/src && git commit -m "feat: filtro de estadia em GET /reservations (stay_from, stay_to)"`

### Task 2: Helper de periodos no frontend

**Files (em `frontend/`):**
- Create: `src/services/reservationRanges.js`
- Test: `src/__tests__/reservationRanges.test.js`

**Interfaces:**
- Produces (exports): `estadiaEm(from: string, to?: string): { stay_from: string, stay_to: string }` (`to` por omissao igual a `from`); `estadiaNoMes(): { stay_from, stay_to }` (primeiro e ultimo dia do mes atual, hora local; reutiliza `mesAtual` de `src/pages/dashboard/shared.jsx`); `estadiaProximosDias(n: number): { stay_from, stay_to }` (de hoje ate hoje+n-1, hora local; `n >= 1`, caso contrario lanca `RangeError`).
- `listReservations` em `reservationsService.js` **nao muda** (continua a passar os parametros como vierem); acrescenta-se um comentario JSDoc a listar os parametros que o backend entende (`status`, `unit_id`, `seller_id`, `check_in_from`, `check_in_to`, `stay_from`, `stay_to`) e a avisar que `from`/`to` **nao** existem.

- [ ] **Step 1: Testes (falham).** `estadiaEm('2026-11-03')` devolve `{ stay_from:'2026-11-03', stay_to:'2026-11-03' }`; com dois argumentos usa ambos; `estadiaNoMes` com `vi.setSystemTime` em `2026-12-01`, `2026-02-10` e `2028-02-10` devolve `2026-12-01..2026-12-31`, `2026-02-01..2026-02-28`, `2028-02-01..2028-02-29`; `estadiaProximosDias(7)` em `2026-12-28` devolve `2026-12-28..2027-01-03` (viragem de ano); `estadiaProximosDias(0)` lanca `RangeError`. Usar relogio falso so de `Date` e restaura-lo (`vi.useRealTimers()`), sem fugas para outros ficheiros.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/reservationRanges.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` completo e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add frontend/src && git commit -m "feat: helper de periodos de estadia para reservas"`

### Task 3: Dashboard de atividades

**Files (em `frontend/`):** Modify `src/pages/dashboard/ActivityDashboard.jsx` (~linhas 88-90); Test: `src/__tests__/ActivityDashboard.test.jsx` e `ActivityDashboard.firstOfMonth.test.jsx`.

**Interfaces:**
- Consumes: `estadiaEm`, `estadiaNoMes`, `estadiaProximosDias` (Tarefa 2).
- Produces: as tres chamadas passam a ser `listReservations(estadiaEm(TODAY))`, `listReservations(estadiaNoMes())` e `listReservations(estadiaProximosDias(7))`. Nenhum calculo, filtro de estado ou `.catch` muda.

- [ ] **Step 1: Atualizar os testes (falham).** O mock de `listReservations` dos dois ficheiros passa a distinguir as chamadas pelo par exato `(stay_from, stay_to)` (hoje/hoje; inicio/fim do mes; hoje/hoje+6) e continua a lancar em qualquer outro par; as datas de teste calculadas em hora local; o caso do 1.o do mes continua a provar que mes e semana se distinguem. Acrescentar `os pedidos usam stay_from e stay_to`: nenhuma chamada recebe as chaves `from` ou `to`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/ActivityDashboard.test.jsx src/__tests__/ActivityDashboard.firstOfMonth.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar** a troca das tres chamadas.
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A frontend/src && git commit -m "fix: dashboard de atividades pede so as reservas do periodo"`

### Task 4: Dashboard de hotel

**Files (em `frontend/`):** Modify `src/pages/dashboard/HotelDashboard.jsx` (~linhas 45-46); Test: `src/__tests__/HotelDashboard.test.jsx`.

**Interfaces:** hoje -> `listReservations(estadiaEm(TODAY))`; mes -> `listReservations(estadiaNoMes())`. Os calculos (`occupied`, `checkins`, `checkouts`, `pendentes`, `alertas`) **nao mudam**: o filtro do servidor passa a entregar exatamente o universo que eles ja assumiam.

- [ ] **Step 1: Testes (falham).** Mock por par `(stay_from, stay_to)`. Com tres reservas controladas devolvidas pelo mock de "hoje" (uma `checked_in` que entrou ha 2 dias e sai daqui a 2, uma com `check_out` hoje `checked_in`, uma `confirmed` com `check_in` hoje) verificar: a unidade da primeira aparece ocupada no mapa, a segunda na lista de check-outs de hoje, a terceira na lista de check-ins; ocupacao e contadores corretos. `pedidos usam stay_*` (nenhuma chamada com `from`/`to`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/HotelDashboard.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A frontend/src && git commit -m "fix: dashboard de hotel pede so as estadias do periodo"`

### Task 5: Dashboard de rent-a-car

**Files (em `frontend/`):** Modify `src/pages/dashboard/RentacarDashboard.jsx` (~linhas 176-177); Test: `src/__tests__/RentacarDashboard.test.jsx`.

**Interfaces:** hoje -> `estadiaEm(TODAY)`; mes -> `estadiaNoMes()` (o estado `monthRes` e carregado mas nao e lido; mantem-se a chamada para nao mudar a logica de carga, so com o filtro novo). Calculos (`levantamentos`, `devolucoes`, estado dos veiculos) **nao mudam**.

- [ ] **Step 1: Testes (falham).** Mock por par `(stay_from, stay_to)`; um aluguer em curso (comecou ha 2 dias, devolve daqui a 3) mantem o veiculo como alugado; uma devolucao hoje aparece em "Devolucoes hoje"; um levantamento hoje aparece em "Levantamentos hoje"; `pedidos usam stay_*`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/RentacarDashboard.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A frontend/src && git commit -m "fix: dashboard de rent-a-car pede so as estadias do periodo"`

### Task 6: Dashboard de restaurante

**Files (em `frontend/`):** Modify `src/pages/dashboard/RestaurantDashboard.jsx` (~linhas 138-139); Test: `src/__tests__/RestaurantDashboard.test.jsx`.

**Interfaces:** hoje -> `estadiaEm(TODAY)`; mes -> `estadiaNoMes()`. Calculos (`reservasHoje`, `coversMes`, turnos, alerta de pendentes) **nao mudam**.

- [ ] **Step 1: Testes (falham).** Mock por par `(stay_from, stay_to)`; reservas controladas de hoje (uma `pending`) aparecem no painel de atencao; `pedidos usam stay_*`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/RestaurantDashboard.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A frontend/src && git commit -m "fix: dashboard de restaurante pede so as reservas do periodo"`

### Task 7: Dashboard generico e vista Resumo

**Files (em `frontend/`):** Modify `src/pages/dashboard/GenericDashboard.jsx` (~linha 53), `src/pages/dashboard/ResumoView.jsx` (~linha 86); Test: `src/__tests__/GenericDashboard.test.jsx`, `src/__tests__/ResumoView.test.jsx`.

**Interfaces:** o generico usa `estadiaEm(TODAY)` para `todayRes` (os calculos por tipo ja existentes continuam a filtrar pelo estado; para o tipo de hotel/rentacar precisam do universo de estadia, para o restaurante o de hoje, e o mesmo pedido serve os tres); o Resumo usa `estadiaNoMes()` para as "Reservas recentes" (as 5 mais recentes por `created_at` entre as que tocam o mes).

- [ ] **Step 1: Testes (falham).** Mocks por par `(stay_from, stay_to)`; o Resumo pede o primeiro e o ultimo dia do mes atual com `stay_*`; o generico idem para hoje; `nenhuma chamada recebe from/to`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/GenericDashboard.test.jsx src/__tests__/ResumoView.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A frontend/src && git commit -m "fix: dashboard generico e Resumo pedem so as reservas do periodo"`

### Task 8: Implantacao e verificacao com dados reais

**Files:** nenhum; verificacao. **Precisa do pedido explicito do utilizador** para cada passo que toca a producao (implantar no VPS, publicar o frontend).

- [ ] **Step 1: Antes de qualquer implantacao.** `npm test` em `backend/` e `npx vitest run` + `npm run build` em `frontend/` a passar; `grep -rn "from:\|to:" frontend/src/pages/dashboard` nao mostra chamadas a `listReservations` com `from`/`to`.
- [ ] **Step 2: Backend primeiro.** Com a autorizacao do utilizador: atualizar o repositorio no VPS (`/var/www/saldesk/repo`) e recarregar o processo `saldesk-api` com `pm2`; confirmar nos registos que arrancou sem erros (sem mostrar segredos).
- [ ] **Step 3: Verificar o filtro com dados reais** usando a conta de demonstracao (entrada publica de demo) contra `https://api.saldesk.cv/api/v1/reservations`: (a) sem parametros devolve N reservas; (b) `stay_from=stay_to=<hoje>` devolve so as que abrangem hoje e todas verificam `check_in <= hoje <= check_out`; (c) `stay_from` e `stay_to` do mes devolvem as que tocam o mes; (d) data invalida (`stay_from=2026-02-30`) devolve 400 com mensagem; (e) `check_in_from`/`check_in_to` antigos continuam iguais. Registar os numeros no relatorio.
- [ ] **Step 4: Frontend.** Publicar o frontend (push de `main`, com autorizacao) e abrir o Dashboard de um operador real (ou a demonstracao): "Tours hoje" e "Participantes do mes" passam a ser coerentes com o calendario; em hotel/rent-a-car as listas de check-in/check-out e a ocupacao continuam corretas.
- [ ] **Step 5: Reversao.** Se algo correr mal: reverter o commit do frontend (o backend e aditivo e pode ficar).

## Fora de ambito (para decidir depois)

- Outras 11 chamadas que enviam `from`/`to` e tambem recebem tudo: `Housekeeping.jsx` (hoje), `Weather.jsx` (proximos 7 dias), `Demand.jsx` (proximos 30 dias; **alem disso** envia `status: 'confirmed,pending'` e o backend faz `eq('status', ...)` com a string toda, o que provavelmente devolve zero resultados: confirmar), `BeachSeller.jsx`, `Feedback.jsx`, `Guides.jsx`, `Reservations.jsx`, `Staff.jsx` (estas ultimas nao enviam datas e podem precisar de tudo de proposito). Cada uma pede a sua propria decisao.
- `Analytics.jsx` le `reviews.average_rating`, mas `/reviews/stats` devolve `average` (o mesmo erro ja corrigido nos dashboards).
- Paginacao ou limite de linhas em `GET /reservations` (o Supabase corta nas 1000 linhas por omissao).

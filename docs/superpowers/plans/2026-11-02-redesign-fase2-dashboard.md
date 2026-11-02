# Redesenho da app do operador, Fase 2 (Dashboard Hoje/Resumo) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o Dashboard atual (quatro dashboards num ficheiro de 1769 linhas) por uma estrutura comum com duas vistas, "Hoje" (operacao do dia) e "Resumo" (numeros do mes), um painel "Requer atencao" e cartoes de numeros com contexto, no aspeto "azul da marca" aprovado.

**Architecture:** `pages/Dashboard.jsx` passa a ser uma casca fina (cabecalho com interruptor Hoje/Resumo, faixa do periodo de avaliacao, pedidos de WhatsApp) que mostra o dashboard "Hoje" do tipo de operador ou o `ResumoView` partilhado. Os dashboards por tipo passam para `pages/dashboard/` (primeiro por mudanca pura de ficheiro, sem alterar comportamento) e adotam o `AttentionPanel`, alimentado por uma funcao pura testada (`buildAttentionItems`). Sem alteracoes no backend.

**Tech Stack:** React 18, Vite, Tailwind 3 (variante `app:` da Fase 1), zustand (persist), recharts (ja instalado), vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (secoes 6 e 8). Fase 1 ja em `main` (`navConfig`, `ui/Tabs`, `ui/EmptyState`, variante `app:`). Caminhos relativos a `frontend/`; comandos correm dentro de `frontend/`.

**Diferencas face ao spec, descobertas no codigo:**
- A variacao face ao mes anterior **nao** precisa de segunda chamada: `getResumo` (`GET /financial/resumo`) ja devolve `atual`, `anterior` e `variacao`.
- **"Tours sem guia" fica de fora**: o Dashboard nao carrega atribuicoes e nao ha dado barato para isso; entra numa fase futura.
- "Pagamentos pendentes" define-se como reservas com `status` em `confirmed`/`checked_in`/`checked_out`, `check_in` ate hoje e `payment_status` em `pending`/`partial` (valores da tabela `reservations`: `pending`, `paid`, `partial`, `refunded`).
- A **linha-resumo** do cabecalho ("4 tours hoje, 3 por confirmar") fica de fora: os dados vivem dentro de cada dashboard por tipo e partilha-los pede um mecanismo que nao compensa agora; os cartoes e o painel "Requer atencao" mostram o mesmo.
- Os alertas atuais por tipo passam todos pelo `AttentionPanel`: atividades (pendentes de hoje, quase esgotados, mau tempo), hotel (manutencao, sem confirmacao, limpeza), rent-a-car (documentos e revisoes), restaurante (o que ja tiver; ver Tarefa 10).

## Global Constraints

- Sem emojis; icones so `lucide-react`.
- Fora de ambito: portal do viajante, da equipa, vendedor de praia, painel do fundador, paginas publicas. Os componentes partilhados mantem as classes antigas; o novo aspeto entra por classes `app:` (ex.: `KpiCard`, tambem usado em Financeiro). Componentes novos (so usados na app do operador) podem usar classes simples.
- Cores e fontes do spec: paleta ocean/sand/neutros; Sora so em titulos e numeros grandes; cantos 8 px em cartoes; etiquetas em minusculas normais; numeros `tabular-nums`; botao principal sand.
- Textos novos via `t('dashboard....')` com as chaves em **`i18n/pt.json`, `en.json`, `de.json` e `nl.json`**: o `lookup` devolve a propria chave quando falta, por isso uma chave em falta aparece como texto cru. Textos novos em portugues **com acentos**; as chaves antigas nao se alteram.
- Nenhuma alteracao no backend. Nenhuma rota nova. Ancoras `data-tour` e rotas existentes mantidas.
- A logica de dados dos dashboards por tipo (chamadas a servicos, calculos de KPIs, mapas de quartos/frota/mesas) nao muda; so apresentacao e arrumacao. A mudanca de ficheiro (Tarefa 1) e literal.
- Chamadas que falham (backend em baixo) nao partem o ecra nem mostram erros ao utilizador (padrao atual: `.catch(() => {})`).
- Testes: `fireEvent` de `@testing-library/react` (nao `user-event`, que da avisos `act()` neste repo); `MemoryRouter` com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; `vi.mock` dos servicos; saida de testes limpa. Ficheiros mantem o fim de linha existente (CRLF onde ja o e).
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit.

## Review Focus

- Operador com tipo desconhecido ou em falta: continua a mostrar o dashboard generico (Tarefa 1, teste de fumo).
- Todos os servicos a falhar (backend em baixo): o dashboard e o Resumo renderizam estados vazios, sem lancar erro nem escrever na consola (Tarefas 1 e 6).
- Utilizador de de/nl: nenhum texto novo aparece como chave crua (`dashboard.attention.title`); teste de paridade das quatro linguas (Tarefa 4).
- Valor invalido de `dashboardView` guardado no browser (ex.: `"outro"`): volta a `hoje` (Tarefa 3).
- Reservas com campos em falta (`guests`, `payment_status`, nome do cliente `undefined`): o painel de atencao e as listas nao rebentam (Tarefas 2 e 7).

---

### Task 1: Dashboards por tipo para `pages/dashboard/` (mudanca pura) e rede de seguranca

**Files:**
- Create: `src/pages/dashboard/shared.jsx` (helpers e pecas partilhadas hoje no topo de `Dashboard.jsx`: `TODAY`, `mesAtual`, `CELL`, `unitStatus`, `parseVehicleMeta`, `StatusCell`, `MapLegend`, e o que mais seja usado por mais de um tipo), `ActivityDashboard.jsx`, `HotelDashboard.jsx`, `RentacarDashboard.jsx`, `RestaurantDashboard.jsx`, `GenericDashboard.jsx`, `TrialBanner.jsx`
- Modify: `src/pages/Dashboard.jsx` (fica so com o `export default function Dashboard()` e os imports)
- Test: `src/__tests__/dashboard.smoke.test.jsx`

**Interfaces:**
- Produces: cada ficheiro exporta por omissao o seu componente (`ActivityDashboard`, `HotelDashboard`, `RentacarDashboard`, `RestaurantDashboard`, `GenericDashboard`, `TrialBanner`) sem props; `shared.jsx` exporta por nome os helpers que movidos. `Dashboard` continua a ser `export default` de `pages/Dashboard.jsx` (o `App.jsx` nao muda).

- [ ] **Step 1: Teste de fumo (deve passar ja antes de mover, porque nao ha mudanca de comportamento).** `dashboard.smoke.test.jsx`: faz `vi.mock` de `../services/unitsService` (`listUnits` resolve `[]`), `reservationsService` (`listReservations` resolve `[]`), `financeiroService` (`getResumo` resolve `{atual:{receita:0,num_reservas:0,valor_medio:0,taxa_ocupacao:0},anterior:{receita:0,num_reservas:0,valor_medio:0,taxa_ocupacao:0},variacao:{receita:0,num_reservas:0,valor_medio:0,taxa_ocupacao:0}}`), `weatherService` (`getWeatherForecast` resolve `[]`) e `../services/api` (`get` resolve `{ data: { data: null } }`); `vi.mock` de `WhatsAppPendentes` para um stub. Com `QueryClientProvider` e `MemoryRouter`, para cada `operator_type` em `activity`, `hotel`, `rentacar`, `restaurant` e `undefined` (generico): define `useAuthStore.setState({ operator: { name: 'Teste', operator_type } })`, renderiza `<Dashboard />` e espera o titulo `Bem-vindo, Teste` (chave `dashboard.welcome`, em portugues) e que nao haja excecoes. Casos: `activity mostra`, `hotel mostra`, `rentacar mostra`, `restaurant mostra`, `tipo em falta usa o generico`, `servicos a falhar nao partem` (os mocks rejeitam e o titulo continua visivel).
- [ ] **Step 2: Correr e confirmar que passa (linha de base).** Run: `npx vitest run src/__tests__/dashboard.smoke.test.jsx`. Expected: PASS antes de qualquer movimento.
- [ ] **Step 3: Mover.** Cortar cada `function XDashboard()` (e `TrialBanner`) para o seu ficheiro, **sem alterar uma linha de logica**; mover para `shared.jsx` os helpers usados por varios tipos e importa-los onde for preciso. O `Dashboard.jsx` fica com `Dashboard()` (igual) a importar os cinco componentes. Ajustar os caminhos relativos dos imports (`../../services/...`, `../../components/...`).
- [ ] **Step 4: Correr.** Run: `npx vitest run` e `npm run build`. Expected: tudo passa; o fumo continua verde.
- [ ] **Step 5: Verificar que nada mudou.** Confirmar que `src/pages/Dashboard.jsx` tem menos de 60 linhas e que a soma das linhas dos ficheiros novos de `pages/dashboard/` fica proxima das 1769 originais (so imports a mais); nenhuma linha de logica foi alterada.
- [ ] **Step 6: Commit.** `git add -A src && git commit -m "refactor: dashboards por tipo para pages/dashboard"`

### Task 2: Logica pura do painel de atencao

**Files:**
- Create: `src/pages/dashboard/dashboardLogic.js`
- Test: `src/__tests__/dashboardLogic.test.js`

**Interfaces:**
- Produces (exports de `dashboardLogic.js`):
  - `unpaidReservations(reservations: Reservation[], today: string): Reservation[]`: reservas com `status` em `['confirmed','checked_in','checked_out']`, `check_in <= today` e `payment_status` em `['pending','partial']`. `payment_status` em falta ou `paid`/`refunded` exclui. Lista `undefined` devolve `[]`.
  - `buildAttentionItems(input: AttentionInput, t: (key: string, vars?: object) => string): AttentionItem[]` com `AttentionInput = { pendingToday?: Reservation[]; unpaid?: Reservation[]; nearlyFull?: Array<{ name: string; guests: number; capacity: number }>; weather?: Array<{ date: string; label: string; toursCount: number }>; docAlerts?: Array<{ type: 'expired' | 'warning'; msg: string }>; maintenance?: Array<{ name: string }>; unconfirmed?: Reservation[]; cleaning?: number }` e `AttentionItem = { id: string; severity: 'critical' | 'warning' | 'info'; title: string; detail?: string; to: string }`.
  - Regras exatas (campos em falta tratam-se como lista vazia/zero e nao geram item):
    - `weather` (nao vazio): um item `id 'weather'`, `critical`, `title t('dashboard.attention.weather', { n })`, `detail` = primeira entrada `"<date> <label>"`, `to '/meteorologia'`.
    - `docAlerts` com `type 'expired'`: um item `critical` por alerta (`id 'doc-expired-<indice>'`, `title msg`, `to '/unidades'`); com `type 'warning'`: ate 3 itens `warning` (`id 'doc-warning-<indice>'`).
    - `maintenance` (nao vazio): um item `warning` `id 'maintenance'`, `title t('dashboard.attention.maintenance', { n })`, `detail` nomes separados por `, `, `to '/unidades'`.
    - `unconfirmed` (nao vazio): `warning`, `id 'unconfirmed'`, `title t('dashboard.attention.unconfirmed', { n })`, `to '/reservas'`.
    - `pendingToday` (nao vazio): `warning`, `id 'pending'`, `title t('dashboard.attention.pending', { n })`, `to '/reservas'`.
    - `unpaid` (nao vazio): `warning`, `id 'unpaid'`, `title t('dashboard.attention.unpaid', { n })`, `to '/reservas'`.
    - `cleaning > 0`: `warning`, `id 'cleaning'`, `title t('dashboard.attention.cleaning', { n })`, `to '/housekeeping'`.
    - `nearlyFull` (nao vazio): `info`, `id 'nearly-full'`, `title t('dashboard.attention.nearlyFull', { n })`, `detail` `"<name> <guests>/<capacity>"` por entrada, separados por `; `, `to '/calendario'`.
    - Ordem do resultado: todos os `critical`, depois `warning`, depois `info`; dentro de cada grupo a ordem das regras acima.

- [ ] **Step 1: Testes (falham).** Com `t = (key, vars) => vars ? key + JSON.stringify(vars) : key`:
  - `unpaidReservations`: uma reserva `confirmed`, `check_in` de ontem, `payment_status 'pending'` entra; `paid`, `refunded`, `payment_status` em falta, `cancelled`, `pending` (estado) e `check_in` de amanha ficam de fora; `undefined` devolve `[]`.
  - `entrada vazia` e `{}` e `undefined` devolvem `[]`.
  - cada regra isolada gera o item com `id`, `severity`, `title` e `to` indicados (incluindo `n`).
  - `ordem`: com `weather` + `pendingToday` + `nearlyFull` + `docAlerts` expirado, a ordem dos `id` e `['weather','doc-expired-0','pending','nearly-full']`.
  - `docAlerts` de aviso: com 5 avisos devolve so 3.
  - `reservas incompletas`: `pendingToday: [{}]` (sem `guests`, sem nome) gera o item com `n 1` e nao lanca.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/dashboardLogic.test.js`. Expected: FAIL (modulo inexistente).
- [ ] **Step 3: Implementar `dashboardLogic.js`** com as assinaturas acima (funcoes puras, sem imports de React).
- [ ] **Step 4: Correr.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/pages/dashboard/dashboardLogic.js src/__tests__/dashboardLogic.test.js && git commit -m "feat: logica do painel Requer atencao"`

### Task 3: Vista Hoje/Resumo guardada (uiStore)

**Files:**
- Modify: `src/store/uiStore.js`
- Test: `src/__tests__/uiStore.test.js` (acrescentar)

**Interfaces:**
- Produces: `dashboardView: 'hoje' | 'resumo'` (por omissao `'hoje'`, persistido) e `setDashboardView(view: string): void` que **ignora** valores diferentes de `'hoje'` e `'resumo'`. Um valor persistido invalido volta a `'hoje'` ao reidratar.

- [ ] **Step 1: Testes (falham)** acrescentados a `uiStore.test.js`: `vista por omissao e hoje`; `guarda resumo` (`setDashboardView('resumo')` e fica em `localStorage['saldesk-ui']`); `ignora valor invalido` (`setDashboardView('outro')` mantem o anterior); `valor persistido invalido volta a hoje` (semear `localStorage['saldesk-ui']` com `{"state":{"dashboardView":"outro"},"version":0}`, reidratar com `useUiStore.persist.rehydrate()`, esperar `'hoje'`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/uiStore.test.js`. Expected: FAIL nos quatro novos.
- [ ] **Step 3: Implementar** o campo, a acao, o `partialize` e um `merge` do `persist` que normaliza `dashboardView` invalido para `'hoje'` sem tocar nos outros campos.
- [ ] **Step 4: Correr.** Expected: PASS (todos os testes do ficheiro).
- [ ] **Step 5: Commit.** `git add src/store src/__tests__/uiStore.test.js && git commit -m "feat: guardar a vista do dashboard"`

### Task 4: Pecas de interface do dashboard e chaves de traducao

**Files:**
- Create: `src/components/dashboard/AttentionPanel.jsx`, `DashboardHeader.jsx`, `TrialStrip.jsx`
- Modify: `src/components/financial/KpiCard.jsx` (so acrescentos `app:`), `src/i18n/pt.json`, `en.json`, `de.json`, `nl.json`
- Test: `src/__tests__/dashboardUi.test.jsx`, `src/__tests__/i18nDashboard.test.js`

**Interfaces:**
- Consumes: `AttentionItem` (Tarefa 2), `Tabs` de `components/ui/Tabs` (`Tabs({ tabs: Array<{id,label,count?}>, value, onChange })`), `usePlan` (`isInTrial`, `isTrialExpired`, `trialDaysLeft`), `useT`.
- Produces:
  - `AttentionPanel({ items: AttentionItem[] }): JSX`: titulo `t('dashboard.attention.title')` com a contagem; sem itens mostra `t('dashboard.attention.allClear')`; cada linha tem um ponto de cor por severidade (`critical` vermelho, `warning` ambar, `info` ocean), `title`, `detail` opcional e um botao `t('dashboard.attention.open')` que faz `navigate(item.to)`.
  - `DashboardHeader({ title: string, subtitle?: string, actions?: ReactNode, view: 'hoje'|'resumo', onViewChange: (v: string) => void }): JSX`: titulo (`h1`), subtitulo, as `actions` e o interruptor Hoje/Resumo (via `Tabs`, rotulos `t('dashboard.view.today')`/`t('dashboard.view.summary')`).
  - `TrialStrip(): JSX | null`: mesma logica do `TrialBanner` (expirado, em avaliacao com `<= 7` dias urgente, sem nada fora de avaliacao) numa faixa de uma linha; botao `t('dashboard.trial.viewPlans')`; reutiliza as chaves `dashboard.trial.*` existentes.
  - `KpiCard`: as classes antigas ficam; acrescentam-se `app:` para: sem elevacao ao passar o rato (`app:hover:translate-y-0`, `app:hover:shadow-sm`), cantos `app:rounded-sm`, etiqueta `app:normal-case app:tracking-normal app:text-[13px] app:font-medium`, valor `app:tabular-nums`.
  - Chaves novas (nas quatro linguas): `dashboard.attention.title`, `.allClear`, `.open`, `.weather`, `.maintenance`, `.unconfirmed`, `.pending`, `.unpaid`, `.cleaning`, `.nearlyFull` (as que levam `n` usam `{{n}}`), `dashboard.view.today`, `dashboard.view.summary`, `dashboard.summary.*` que a Tarefa 6 vier a precisar (acrescentar la as que faltarem, mantendo o teste de paridade).

- [ ] **Step 1: Testes (falham).**
  - `dashboardUi.test.jsx`: `AttentionPanel sem itens` mostra `Tudo em ordem` (portugues); `AttentionPanel com itens` mostra os titulos pela ordem recebida e a contagem; clicar `Abrir` numa linha chama `navigate` com o `to` desse item (`useNavigate` mockado preservando os outros exports); `DashboardHeader` mostra o titulo e as acoes e clicar `Resumo` chama `onViewChange('resumo')`, a tab ativa tem `aria-selected="true"`; `TrialStrip` com `useAuthStore` em avaliacao com 20 dias mostra os dias, com 3 dias aplica o estilo urgente (`bg-` de aviso) e sem avaliacao devolve nada; `KpiCard mantem o aspeto antigo e ganha o novo` (o `className` do cartao contem `rounded-lg` e `app:rounded-sm`).
  - `i18nDashboard.test.js`: importa `pt`, `en`, `de`, `nl` de `../i18n/*.json` e verifica, para todas as folhas de `dashboard.attention`, `dashboard.view` e `dashboard.summary`, que as quatro linguas tem exatamente o mesmo conjunto de chaves e que nenhum valor e vazio.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/dashboardUi.test.jsx src/__tests__/i18nDashboard.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar** os tres componentes, os acrescimos `app:` do `KpiCard` e as chaves nas quatro linguas (as traducoes de/nl sao do implementador; assinalar no relatorio que pedem revisao de um falante).
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pecas do dashboard (atencao, cabecalho, faixa de avaliacao)"`

### Task 5: Casca do Dashboard com interruptor Hoje/Resumo

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Test: `src/__tests__/dashboard.smoke.test.jsx` (acrescentar)

**Interfaces:**
- Consumes: `DashboardHeader`, `TrialStrip` (Tarefa 4); `useUiStore().dashboardView/setDashboardView` (Tarefa 3); os dashboards por tipo (Tarefa 1); `ResumoView` (Tarefa 6; ate la, importar um componente provisorio `ResumoView` que devolve `null` em `src/pages/dashboard/ResumoView.jsx`, que a Tarefa 6 substitui).
- Produces: `Dashboard` renderiza `DashboardHeader` (titulo `t('dashboard.welcome', { name })`, subtitulo `<tipo> · <ano-mes>` como hoje, acoes: botao secundario `t('dashboard.activity.viewCalendar')` para `/calendario` e botao principal `t('dashboard.activity.newReservation')` para `/reservas`), `TrialStrip`, `WhatsAppPendentes` e, conforme `dashboardView`, o dashboard "Hoje" do tipo ou `ResumoView`. O antigo `TrialBanner` deixa de ser usado (ficheiro removido).

- [ ] **Step 1: Testes (falham)** acrescentados ao fumo: `interruptor mostra hoje por omissao` (a tab Hoje esta selecionada); `trocar para resumo` (clicar `Resumo` muda `useUiStore.getState().dashboardView` para `'resumo'`, a tab Resumo fica selecionada e o conteudo do tipo desaparece); `volta a hoje`; `as acoes do cabecalho navegam` (clicar `Nova reserva` chama `navigate('/reservas')`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/dashboard.smoke.test.jsx`. Expected: FAIL nos novos.
- [ ] **Step 3: Implementar** a casca; remover `pages/dashboard/TrialBanner.jsx` e os botoes "Acoes rapidas" duplicados so quando as Tarefas 7 a 10 os retirarem de cada tipo (nesta tarefa nao tocar nos tipos).
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: dashboard com interruptor Hoje/Resumo"`

### Task 6: Vista Resumo partilhada

**Files:**
- Modify: `src/pages/dashboard/ResumoView.jsx` (substitui o provisorio), `src/i18n/*.json` (chaves `dashboard.summary.*`)
- Test: `src/__tests__/ResumoView.test.jsx`

**Interfaces:**
- Consumes: `getResumo(inicio, fim)` (devolve `{ atual, anterior, variacao }` com `atual.receita`, `atual.num_reservas`, `atual.valor_medio`, `atual.taxa_ocupacao`), `getReceita(inicio, fim, 'day')` (lista de pontos por dia; o implementador confirma a forma lendo `components/financial` ou o `Financial.jsx`), `getUnidades(inicio, fim)` (`[{ name, unit_type, num_reservas, receita }]`), `listReservations({ from, to })`, `KpiCard`, `EmptyState`, `mesAtual` de `shared.jsx`.
- Produces: `ResumoView()` sem props: quatro `KpiCard` (Receita do mes com `delta = atual.receita - anterior.receita` em euros e `deltaLabel` "face ao mes anterior"; Reservas com `delta = variacao.num_reservas`; Valor medio com `delta = atual.valor_medio - anterior.valor_medio`; Ocupacao `format="percent"` com `delta = variacao.taxa_ocupacao`), grafico dos ultimos 30 dias (recharts, reaproveitando um componente de grafico de `components/financial` se existir um adequado), "Servicos mais vendidos" (ate 5, por `receita`) e "Reservas recentes" (5 mais recentes do mes). Mes atual para os KPIs; os ultimos 30 dias para o grafico.

- [ ] **Step 1: Testes (falham).** Com os servicos mockados (e `ResponsiveContainer` do recharts tratado como no resto do repo, ou o grafico mockado): `pede os dados do mes` (`getResumo` chamado com o primeiro e o ultimo dia do mes atual; `getReceita` com granularidade `'day'`); `mostra receita e variacao` (com `atual.receita 1200` e `anterior.receita 1000` aparece `€1 200` e o delta `+€200`); `mostra servicos mais vendidos` (ordenados por receita, no maximo 5); `estado vazio` (tudo vazio mostra os estados vazios compactos e nao lanca); `servicos a falhar` (todas as chamadas rejeitam: renderiza sem lancar e sem `console.error`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/ResumoView.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar** `ResumoView` (carga em paralelo com `Promise.all`, cada chamada com `.catch` para valor vazio; `loading` com `LoadingSpinner`) e as chaves de traducao nas quatro linguas (paridade garantida pelo teste da Tarefa 4).
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: vista Resumo do dashboard"`

### Task 7: Dashboard "Hoje" de atividades

**Files:**
- Modify: `src/pages/dashboard/ActivityDashboard.jsx`, `src/i18n/*.json` (se faltarem chaves)
- Test: `src/__tests__/ActivityDashboard.test.jsx`

**Interfaces:**
- Consumes: `buildAttentionItems`, `unpaidReservations` (Tarefa 2), `AttentionPanel` (Tarefa 4), `Table` e `EmptyState` (Fase 1), os dados que o componente ja carrega (`tours`, `todayRes`, `monthRes`, `weekRes`, `resumo`, `wxAlerts`).
- Produces: o "Hoje" de atividades com: cinco `KpiCard` (Tours hoje, Participantes do mes, Ocupacao, Receita do mes com `delta` de `resumo.atual.receita - resumo.anterior.receita`, Avaliacao media); a tabela "Tours de hoje" (`Table` com colunas Tour, Lotacao `convidados/capacidade` com barra, Reservas, Estado) e, se vazio, `EmptyState` compacto com acao "Nova reserva"; `AttentionPanel` alimentado por `buildAttentionItems({ pendingToday: alertas.pendentes, unpaid: unpaidReservations(monthRes, TODAY), nearlyFull: alertas.quaseEsgotados (mapeado para { name, guests, capacity }), weather: wxAlerts (mapeado para { date, label, toursCount }) })`; faixa dos proximos 7 dias com contagens (compacta). **Saem do "Hoje"**: reservas recentes e tours mais vendidos (passam a existir so no Resumo), o bloco "Acoes rapidas" (ja esta no cabecalho) e a faixa vermelha de mau tempo (passa a item do `AttentionPanel`; deixa de haver botao de dispensar).

- [ ] **Step 1: Testes (falham).** Com os servicos mockados e dados controlados (um tour com capacidade 10, tres reservas hoje `confirmed` com 8 convidados, uma `pending`, uma reserva do mes `confirmed` por pagar com `check_in` de ontem): `mostra a tabela de tours de hoje` (linha do tour com `8/10`); `lotacao quase esgotada aparece na atencao` (o painel mostra `dashboard.attention.nearlyFull`, em portugues, com o nome do tour); `pendentes e por pagar na atencao`; `sem tours hoje` mostra o estado vazio com o botao `Nova reserva` que navega para `/reservas`; `recentes e mais vendidos ja nao estao no Hoje` (nao ha os titulos antigos); `reserva sem campos` (`{ id: 'x', status: 'pending' }` nao lanca); `servicos a falhar` (rejeitam todos: estados vazios, sem erro).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/ActivityDashboard.test.jsx src/__tests__/dashboard.smoke.test.jsx`. Expected: FAIL nos novos; o fumo continua a passar.
- [ ] **Step 3: Implementar** a nova composicao mantendo os `useEffect`/`useMemo` de dados (so se acrescenta o que falta, por exemplo `resumo.anterior`, que ja vem na resposta).
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: dashboard Hoje de atividades"`

### Task 8: Dashboard "Hoje" de hotel

**Files:**
- Modify: `src/pages/dashboard/HotelDashboard.jsx`
- Test: `src/__tests__/HotelDashboard.test.jsx`

**Interfaces:**
- Consumes: `buildAttentionItems`, `AttentionPanel`, `KpiCard`, `EmptyState`; os dados e calculos atuais (`alertas.manutencao`, `alertas.semConfirmacao`, `alertas.limpeza`, `kpis`).
- Produces: os tres blocos de alerta inline passam a um unico `AttentionPanel` com `buildAttentionItems({ maintenance: alertas.manutencao, unconfirmed: alertas.semConfirmacao, cleaning: alertas.limpeza })`; os `KpiCard` ficam com o aspeto novo (so por `KpiCard`); o `HotelMap` e a sua legenda **nao mudam**; estados vazios passam a `EmptyState` compacto; removem-se acoes rapidas duplicadas do cabecalho.

- [ ] **Step 1: Testes (falham).** `HotelDashboard.test.jsx` com servicos mockados: `manutencao, sem confirmacao e limpeza aparecem no painel` (uma unidade com `status 'maintenance'`, uma reserva `pending` com check-in hoje e uma unidade `cleaning`: tres linhas com os titulos `dashboard.attention.*` em portugues); `sem alertas mostra Tudo em ordem`; `o mapa continua a mostrar as unidades` (uma unidade chamada `Quarto 101` aparece); `servicos a falhar`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/HotelDashboard.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Se o `Hotel` calcular os alertas de forma diferente da assumida (nomes de campos), usar os que o codigo ja tem; nao mudar a regra dos alertas.
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: dashboard Hoje de hotel"`

### Task 9: Dashboard "Hoje" de rent-a-car

**Files:**
- Modify: `src/pages/dashboard/RentacarDashboard.jsx`
- Test: `src/__tests__/RentacarDashboard.test.jsx`

**Interfaces:**
- Consumes: `buildAttentionItems`, `AttentionPanel`; `computeDocAlerts(units, t)` (devolve `[{ type: 'expired' | 'warning', msg, unit }]`, nao muda).
- Produces: o bloco de alertas de documentos passa a `AttentionPanel` com `buildAttentionItems({ docAlerts: computeDocAlerts(units, t) })`; o `VehicleFleet` e o cartao de detalhe do veiculo **nao mudam**; estados vazios compactos; `KpiCard` com o novo aspeto.

- [ ] **Step 1: Testes (falham).** `RentacarDashboard.test.jsx`: `documento expirado aparece como critico` (veiculo com `seguro_expiry` no passado: a linha existe e vem antes de um aviso); `aviso a menos de 30 dias`; `sem alertas mostra Tudo em ordem`; `a frota continua a mostrar o veiculo` (matricula visivel); `servicos a falhar`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/RentacarDashboard.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: dashboard Hoje de rent-a-car"`

### Task 10: Dashboards "Hoje" de restaurante e generico

**Files:**
- Modify: `src/pages/dashboard/RestaurantDashboard.jsx`, `GenericDashboard.jsx`
- Test: `src/__tests__/RestaurantDashboard.test.jsx`

**Interfaces:**
- Consumes: `AttentionPanel`, `buildAttentionItems`, `KpiCard`, `EmptyState`.
- Produces: o restaurante e o generico adotam a casca (sem cabecalho nem banner proprios), `KpiCard` com o aspeto novo e estados vazios compactos; se o restaurante ja tiver alguma situacao de alerta (ex.: pedidos por atender), ela passa ao `AttentionPanel` como item `warning` com `to` para a rota correspondente (o implementador le o codigo, usa so o que ja existe e assinala no relatorio o que decidiu); o `TableMap` e a logica dos turnos **nao mudam**. O dashboard generico mantem-se funcional e so ganha os cartoes e os estados vazios.

- [ ] **Step 1: Testes (falham).** `RestaurantDashboard.test.jsx`: `mostra o mapa de mesas` (uma mesa `Mesa 1` aparece); `sem nada mostra estados vazios compactos` (sem os blocos antigos); `servicos a falhar`; e, se o restaurante tiver um alerta existente, um teste que o mostre no painel.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/RestaurantDashboard.test.jsx src/__tests__/dashboard.smoke.test.jsx`. Expected: FAIL nos novos.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` e `npm run build` limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: dashboards Hoje de restaurante e generico"`

### Task 11: Verificacao final da Fase 2 no browser

**Files:** nenhum (verificacao); correcoes entram em commits `fix:` proprios.

- [ ] **Step 1: Testes e build.** Run: `npx vitest run` e `npm run build`. Expected: tudo passa.
- [ ] **Step 2: Arrancar** o servidor de desenvolvimento (`preview_start` com `saldesk-frontend`). **Nao arrancar o backend local** (usa a base de producao e tarefas agendadas). Injetar uma sessao fictícia em `localStorage['saldesk-auth']` (`token`, `user.user_metadata.role` `OPERATOR`, `operator` com `onboarding_complete: true`, `plan_status` `trial`, `trial_ends_at` no futuro) e abrir `/dashboard`.
- [ ] **Step 3: Para cada tipo** (`activity`, `hotel`, `rentacar`, `restaurant`, mudando `operator.operator_type` e recarregando): em 1280 px verificar o cabecalho com o interruptor Hoje/Resumo, a faixa fina de avaliacao, os cartoes, o painel "Requer atencao" e o estado vazio compacto; clicar `Resumo` (mostra os estados vazios sem dados) e voltar a `Hoje`; recarregar e confirmar que a vista escolhida se mantem; consola sem erros alem de `ERR_CONNECTION_REFUSED`.
- [ ] **Step 4: Telemovel.** Em 375 px, o cabecalho e o interruptor nao rebentam o ecra nem fazem scroll horizontal, e o painel de atencao fica legivel.
- [ ] **Step 5: Idiomas.** Mudar o idioma para EN, DE e NL (`PT/EN` no topo, ou `useUiStore.setState({ lang })`) e confirmar que nenhum texto do dashboard aparece como chave crua (`dashboard.`).
- [ ] **Step 6: Fora de ambito.** `/viajante/entrar` e `/book/<slug>` sem `data-ui` e sem mudanca; a pagina Financeiro (que usa `KpiCard`) continua a abrir.
- [ ] **Step 7: Limpar** a sessao fictícia do `localStorage`, parar o servidor e `git status` limpo.

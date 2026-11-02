# Redesenho da app do operador, Fase 1 (base, estrutura e entrada) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a app do operador a nova estrutura (barra lateral agrupada, pesquisa Ctrl K, barra superior) e o novo aspeto "azul da marca", com os componentes base renovados e o login dividido, sem alterar o aspeto de nenhuma area fora da app do operador.

**Architecture:** Uma variante Tailwind `app:` ativa so dentro de `[data-ui="app"]` (posto no `Layout` e no `AuthLayout`) permite que os componentes partilhados ganhem o novo aspeto sem mudar os portais fora de ambito. Uma unica lista de navegacao (`navConfig.js`, logica pura e testada) alimenta a barra lateral, a pesquisa Ctrl K e o menu "Mais" do telemovel. A logica de cada pagina nao muda; so apresentacao.

**Tech Stack:** React 18, Vite, Tailwind 3 (ESM config), react-router-dom 6, zustand (persist), @tanstack/react-query, lucide-react, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (secoes 5 e 8). Todos os caminhos abaixo sao relativos a `frontend/`. Comandos correm dentro de `frontend/`.

**Diferencas face ao spec, descobertas no codigo:**
- `Select` e `Textarea` ja existem em `src/components/ui/Input.jsx`: renovam-se, nao se criam.
- O `AuthLayout` ja e o layout dividido escolhido (foto + proposta de valor a esquerda); so o `Login.jsx` o ignora, com um cartao de vidro proprio. A tarefa de entrada e passar o Login ao `AuthLayout` e dar-lhe campos claros.
- Perfil e Sair ja existem no menu do utilizador da `Topbar`; saem do rodape da barra lateral.
- O item "/" chama-se **Dashboard** (nao "Hoje"), porque a pagina passa a ter duas vistas (Fase 2).

## Global Constraints

- Sem emojis em nenhum ficheiro; icones so `lucide-react`.
- Fora de ambito, sem mudanca visual: portal do viajante, portal da equipa, vendedor de praia, painel do fundador (`/admin`), paginas publicas `/book/*`. Os componentes partilhados mantem as classes antigas; o novo aspeto entra **so** por classes `app:`.
- Cores e fontes do spec: paleta ocean/sand/neutros existente; Sora so em titulos e numeros grandes, DM Sans no resto; botao principal sand (`sand-500`, texto `ocean-900`); cantos 8 px em cartoes e campos, 6 px em botoes; etiquetas em minusculas normais; numeros com `tabular-nums` alinhados a direita.
- Barra lateral de 240 px (`w-60`), 5 seccoes pela ordem: Operacao, Clientes, Gestao, Crescimento, Configuracao. Crescimento e Configuracao comecam recolhidas; o estado persiste.
- Rotulos de navegacao em portugues **com acentos** (Calendário, Gestão, Definições).
- Nenhuma alteracao no backend. Nenhuma rota nova ou renomeada. Ancoras `data-tour` mantidas: `nav-dashboard`, `nav-unidades`, `nav-reservas`, `nav-financeiro`, `nav-definicoes`, `nav-site`, `topbar-bell`.
- Logica de autenticacao do `Login.jsx` intacta (bloqueio de conta, contagem, lembrar dispositivo, recuperacao, redirecionamentos por tipo de utilizador).
- Mobile: a barra inferior (`BottomNav`) nao muda; o `MoreDrawer` passa a agrupar por seccao.
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit.

## Review Focus

- Operador com tipo de operador desconhecido ou em falta: usa a navegacao de `hotel`, como hoje (testado na Tarefa 2).
- Seccao recolhida que contem a rota ativa: abre sozinha, para o item ativo nunca ficar escondido (Tarefa 5).
- Item bloqueado por plano (ex.: Automacoes no plano starter): continua visivel com selo e abre o `UpgradeModal`, nunca navega (Tarefa 5 e 6).
- Pesquisa Ctrl K com acentos e maiusculas ("calendario", "FINANCEIRO", "gestao"): encontra "Calendário", "Financeiro" e itens da seccao Gestão (Tarefa 2).
- Falha das chamadas dos contadores (rede em baixo): a barra lateral renderiza sem contadores e sem erro na consola (Tarefa 4).
- Login com bloqueio de conta ou erro de credenciais: as mensagens continuam visiveis e legiveis no fundo claro (Tarefa 8).

---

### Task 1: Tema do operador (variante `app:`, tokens, contentor)

**Files:**
- Modify: `tailwind.config.js` (plugin `app`, sombra `app-sm`)
- Modify: `src/styles/tokens.css` (tokens de estado fortes/suaves; `--surface-app`)
- Modify: `src/styles/global.css` (regra `[data-ui="app"]`)
- Modify: `src/components/layout/Layout.jsx` (atributo no contentor)

**Interfaces:**
- Produces: variante Tailwind `app:` = `[data-ui="app"] &`; atributo `data-ui="app"` no elemento raiz do `Layout`; tokens CSS `--surface-app: #F1F4F6` e os existentes `--success/--warning/--error/--info` (+ `-light`).

- [ ] **Step 1: Registar a variante.** Em `tailwind.config.js` importar `plugin from 'tailwindcss/plugin'` e em `plugins` registar `plugin(({ addVariant }) => addVariant('app', '[data-ui="app"] &'))`.
- [ ] **Step 2: Contentor.** No `Layout.jsx`, o `div` raiz passa a `data-ui="app"` e o fundo a `bg-n-50 app:bg-[var(--surface-app)]` (valor `#F1F4F6` do mockup aprovado).
- [ ] **Step 3: Tokens.** Em `tokens.css` acrescentar `--surface-app: #F1F4F6;` em `:root`; `global.css` define `[data-ui="app"] { font-size: 14px; }` e `[data-ui="app"] table { font-variant-numeric: tabular-nums; }`.
- [ ] **Step 4: Verificar.** Run: `npm run build`, depois `grep -c 'data-ui' dist/assets/*.css`. Expected: build sem erros e contagem maior que 0 num dos ficheiros CSS.
- [ ] **Step 5: Commit.** `git add tailwind.config.js src/styles src/components/layout/Layout.jsx && git commit -m "feat: variante app: e contentor do tema do operador"`

### Task 2: Lista de navegacao unica (logica pura)

**Files:**
- Create: `src/components/layout/navConfig.js`
- Test: `src/__tests__/navConfig.test.js`

**Interfaces:**
- Produces (exports de `navConfig.js`):
  - `NAV_SECTIONS: Array<{ id: 'operacao'|'clientes'|'gestao'|'crescimento'|'configuracao', label: string, defaultCollapsed: boolean }>` (so Crescimento e Configuracao com `defaultCollapsed: true`).
  - `PLAN_BADGE: { business: {label,cls}, pro: {label,cls} }` (valores identicos aos do `Sidebar.jsx` atual).
  - `getNavSections(opType?: string): Array<{ id, label, defaultCollapsed, items: NavItem[] }>`, com `NavItem = { to, icon, label, section, end?, requiredPlan?, feature? }`. Tipo desconhecido ou em falta usa `hotel`. Seccoes sem itens sao omitidas.
  - `isLocked(item: NavItem, canAccess: (feature: string) => boolean): boolean` = `!!item.requiredPlan && !canAccess(item.feature || item.requiredPlan)`.
  - `filterNavItems(items: NavItem[], query: string): NavItem[]`: ignora maiusculas e acentos, procura em `label`; consulta vazia devolve tudo.
  - `sectionIdOfPath(sections, pathname: string): string | null`: a seccao cujo item corresponde a rota (igualdade exata, ou prefixo seguido de `/` exceto para `/`).
- Consumes: icones de `lucide-react` ja usados no `Sidebar.jsx` atual.

- [ ] **Step 1: Escrever os testes (falham).** Em `navConfig.test.js`:
  - `rotas por tipo iguais as listas antigas`: para cada tipo, o conjunto de `to` de `getNavSections(tipo)` e igual ao conjunto antigo, e a contagem e `activity` 29, `hotel` 23, `rentacar` 24, `restaurant` 21. Escrever os conjuntos antigos no teste a partir de `src/components/layout/Sidebar.jsx` (`TYPE_NAV`) antes de o alterar.
  - `tipo desconhecido usa hotel`: `getNavSections('xyz')` tem os mesmos `to` que `getNavSections('hotel')`; o mesmo com `undefined`.
  - `ordem e seccoes`: `getNavSections('activity').map(s => s.id)` e `['operacao','clientes','gestao','crescimento','configuracao']`; `/definicoes` esta em `configuracao`; `/financeiro` em `gestao`; `/automacoes` em `crescimento`; nenhum `to` aparece duas vezes.
  - `rotulo por tipo`: o item `/unidades` tem label `Tours & Atividades` (activity), `Quartos` (hotel), `Frota` (rentacar), `Mesas` (restaurant); o item `/` tem label `Dashboard` e `end: true`.
  - `planos preservados`: `/automacoes` tem `requiredPlan: 'pro'`, `feature: 'automacoes'`; `/guias` tem `requiredPlan: 'business'`; `/rh` tem `feature: 'colaboradores'`.
  - `isLocked`: com `canAccess = () => false`, `/automacoes` esta bloqueado e `/reservas` nao; com `canAccess = () => true`, nenhum.
  - `filterNavItems`: `'calendario'` encontra `Calendário`; `'FINANCEIRO'` encontra `Financeiro`; `'gestao'` nao devolve itens por nome de seccao (so procura em `label`), `''` devolve a lista inteira; `'zzz'` devolve `[]`.
  - `sectionIdOfPath`: `/automacoes` devolve `crescimento`; `/colaboradores/abc` devolve `gestao`; `/` devolve `operacao`; `/nao-existe` devolve `null`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/navConfig.test.js`. Expected: FAIL (modulo inexistente).
- [ ] **Step 3: Implementar `navConfig.js`.** Uma constante `NAV_ITEMS` com todos os itens (cada um com `types: string[]` e `labelByType?: Record<string,string>`) e `getNavSections` que filtra por tipo e agrupa. Atribuicao de seccoes: operacao (`/`, `/unidades`, `/reservas`, `/calendario`, `/guias`, `/frota`, `/housekeeping`, `/manutencao`, `/menu-digital`, `/pedidos`); clientes (`/clientes`, `/mensagens`, `/mensagens-saldesk`, `/avaliacoes`, `/ocorrencias`, `/feedback`); gestao (`/financeiro`, `/analytics`, `/previsao`, `/meteorologia`, `/colaboradores`, `/rh`); crescimento (`/marketing`, `/integracoes`, `/automacoes`, `/fidelidade`, `/vouchers`, `/afiliados`, `/grupos`, `/pacotes`, `/parcerias`); configuracao (`/editor-pagina`, `/definicoes`). Tipos por item exatamente como no `TYPE_NAV` antigo. `filterNavItems` normaliza com `String.prototype.normalize('NFD')` e remove `̀-ͯ`.
- [ ] **Step 4: Correr.** Run: `npx vitest run src/__tests__/navConfig.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/components/layout/navConfig.js src/__tests__/navConfig.test.js && git commit -m "feat: lista de navegacao unica com seccoes"`

### Task 3: Estado das seccoes recolhidas (uiStore)

**Files:**
- Modify: `src/store/uiStore.js`
- Test: `src/__tests__/uiStore.test.js`

**Interfaces:**
- Produces: no `useUiStore`, `navCollapsed: Record<string, boolean>` (substituicoes explicitas por id de seccao; persistido) e `setNavSectionCollapsed(id: string, collapsed: boolean): void`. `navCollapsed[id] === undefined` significa "usar `defaultCollapsed` da seccao".

- [ ] **Step 1: Teste (falha).** `uiStore.test.js`: `comeca vazio` (`navCollapsed` e `{}`); `guarda a substituicao` (apos `setNavSectionCollapsed('crescimento', false)`, `navCollapsed.crescimento === false`); `persiste` (o valor aparece em `localStorage['saldesk-ui']` depois da chamada); `nao apaga outras chaves` (`lang` continua a existir).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/uiStore.test.js`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Acrescentar o campo e a acao ao store e incluir `navCollapsed` no `partialize`.
- [ ] **Step 4: Correr.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/store/uiStore.js src/__tests__/uiStore.test.js && git commit -m "feat: guardar seccoes recolhidas da navegacao"`

### Task 4: Contadores da navegacao

**Files:**
- Create: `src/hooks/useNavCounters.js`
- Test: `src/__tests__/useNavCounters.test.jsx`

**Interfaces:**
- Consumes: `listReservations(filtros)` de `services/reservationsService.js` (devolve array) e `getUnreadCount()` de `services/messageService.js` (devolve numero).
- Produces: `useNavCounters(): Record<string, number>` com chaves `'/reservas'` (reservas com `status: 'pending'`) e `'/mensagens'` (nao lidas). Valor 0 quando a chamada falha. Atualiza de 60 em 60 segundos.

- [ ] **Step 1: Testes (falham).** Com `QueryClientProvider` e `vi.mock` dos dois servicos: `devolve os contadores` (3 reservas pendentes e 5 nao lidas dao `{'/reservas': 3, '/mensagens': 5}`); `chama listReservations com status pending`; `falha de rede da 0` (ambos a rejeitar dao `{'/reservas': 0, '/mensagens': 0}` e nao lancam erro).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/useNavCounters.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar** com `useQuery` (chaves `['nav','pendingReservations']` e `['nav','unreadMessages']`, `refetchInterval: 60_000`, `retry: false`, `queryFn` que apanha o erro e devolve 0).
- [ ] **Step 4: Correr.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/hooks src/__tests__ && git commit -m "feat: contadores de reservas e mensagens na navegacao"`

### Task 5: Barra lateral agrupada

**Files:**
- Modify: `src/components/layout/Sidebar.jsx` (reescrita; deixa de exportar `TYPE_NAV` e `PLAN_BADGE`)
- Modify: `src/components/layout/Layout.jsx` (largura `md:w-60`)
- Modify: `src/components/layout/MoreDrawer.jsx` (so o minimo para continuar a compilar; o agrupamento e a Tarefa 6)
- Test: `src/__tests__/Sidebar.test.jsx`

**Interfaces:**
- Consumes: `getNavSections`, `isLocked`, `sectionIdOfPath`, `PLAN_BADGE` (Tarefa 2); `useUiStore().navCollapsed/setNavSectionCollapsed` (Tarefa 3); `usePlan().canAccess`; `useNavCounters` (Tarefa 4).
- Produces: `export default function Sidebar({ onClose }: { onClose?: () => void })`.

Comportamento: logo; cartao do operador (nome e tipo); por seccao, um cabecalho clicavel (com seta) e os itens; item ativo com fundo `ocean-600` e barra `sand-500` a esquerda; item bloqueado como botao que abre `UpgradeModal` com o selo do plano e um cadeado; contador (pilula vermelha) no item quando `counters[to] > 0` (`9+` acima de 9); rodape so com "Ver o meu site" (`data-tour="nav-site"`, link para `https://app.saldesk.cv/book/<slug>`). Ancoras `data-tour` nos itens como no `TOUR_ANCHOR` atual. Perfil e Sair deixam de estar aqui.

- [ ] **Step 1: Testes (falham).** `Sidebar.test.jsx` com `MemoryRouter`, `useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'starter', slug: 'kawa', name: 'Kawa tour' } })` e `useUiStore.setState({ navCollapsed: {} })`:
  - `mostra as cinco seccoes`: os cabecalhos Operação, Clientes, Gestão, Crescimento, Configuração existem.
  - `crescimento e configuracao comecam recolhidas`: `Marketing` nao esta no documento; apos clicar no cabecalho Crescimento, aparece; `useUiStore.getState().navCollapsed.crescimento === false`.
  - `seccao da rota ativa abre sozinha`: com `initialEntries={['/automacoes']}`, o item Automações esta visivel sem clicar.
  - `item bloqueado`: no plano `starter`, Automações mostra o selo `Pro` e, ao clicar, aparece o `UpgradeModal` e a rota nao muda.
  - `rodape`: existe o link `Ver o meu site` com `href` `https://app.saldesk.cv/book/kawa`; nao existem `Perfil` nem `Sair`.
  - `contador`: com `useNavCounters` mockado a devolver `{'/reservas': 12}`, o item Reservas mostra `9+`.
  - `tipo restaurante`: o item `/unidades` mostra `Mesas`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Sidebar.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar `Sidebar`.** Usa `getNavSections(operator?.operator_type)`; cabecalho de seccao e `button` com `aria-expanded`; estado efetivo = `navCollapsed[id] ?? defaultCollapsed`, forcado a aberto se `sectionIdOfPath(sections, pathname) === id`. Estilo do mockup aprovado (fundo `ocean-800`, texto `ocean-200`, cabecalhos de seccao em `ocean-300` 11 px).
- [ ] **Step 4: Largura e MoreDrawer.** No `Layout.jsx` trocar `md:w-64` por `md:w-60`. No `MoreDrawer.jsx`, o `Sidebar` deixou de exportar `TYPE_NAV` e `PLAN_BADGE`: importar `PLAN_BADGE`, `getNavSections` e `isLocked` de `./navConfig` e obter os itens com `getNavSections(opType).flatMap(s => s.items)` (mesmo filtro `HIDDEN_IN_DRAWER`), sem mais alteracoes.
- [ ] **Step 5: Correr.** Expected: PASS em `Sidebar.test.jsx`; `npx vitest run` sem regressoes.
- [ ] **Step 6: Verificar build e commit.** Run: `npm run build`. Expected: sem erros. `git add -A src && git commit -m "feat: barra lateral agrupada"`.

### Task 6: Pesquisa Ctrl K, barra superior e menu "Mais"

**Files:**
- Create: `src/components/layout/CommandPalette.jsx`
- Modify: `src/components/layout/Topbar.jsx`
- Modify: `src/components/layout/MoreDrawer.jsx`
- Test: `src/__tests__/CommandPalette.test.jsx`

**Interfaces:**
- Consumes: `getNavSections`, `filterNavItems`, `isLocked` (Tarefa 2), `usePlan`, `UpgradeModal` de `../PlanGuard`.
- Produces: `export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void })`; modal com campo de pesquisa e lista de ecras (todos os do tipo de operador, agrupados por seccao); teclas: Setas movem a selecao, Enter abre, Esc fecha; clique abre.

- [ ] **Step 1: Testes (falham).** `CommandPalette.test.jsx` (`MemoryRouter`, operador `activity`, plano `pro`, `useNavigate` mockado):
  - `nao renderiza fechado`: com `open={false}` nao ha campo de pesquisa.
  - `filtra sem acentos`: escrever `calendario` mostra `Calendário` e esconde `Reservas`.
  - `Enter navega`: escrever `financeiro` e carregar Enter chama `navigate('/financeiro')` e `onClose`.
  - `setas`: Seta para baixo seguida de Enter abre o segundo resultado.
  - `Esc fecha`: chama `onClose`.
  - `bloqueado nao navega`: no plano `starter`, escolher `Automações` abre o `UpgradeModal` e nao chama `navigate`.
  - `sem resultados`: `zzzz` mostra a mensagem `Sem resultados`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/CommandPalette.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar `CommandPalette`.** Foco automatico no campo ao abrir, `role="dialog"` e `aria-modal`, lista com `role="listbox"`.
- [ ] **Step 4: Topbar.** Renderizar `CommandPalette` e um botao de pesquisa (texto `Pesquisar…` e a dica `Ctrl K`) a esquerda; um `useEffect` abre a palette com `Ctrl+K` ou `Cmd+K` (`preventDefault`) e limpa o listener ao desmontar. Em ecras pequenos o botao mostra so o icone. Altura `h-14`, fundo branco, sem a sombra atual. Toda a logica das notificacoes e do menu do utilizador fica intacta (incluindo `data-tour="topbar-bell"`).
- [ ] **Step 5: MoreDrawer.** Passar a usar `getNavSections` e `isLocked`; mostrar um cabecalho por seccao (texto pequeno) e a grelha de 3 colunas dentro de cada uma; manter `HIDDEN_IN_DRAWER` (`/`, `/reservas`, `/mensagens`), o `UpgradeModal` e o botao Sair.
- [ ] **Step 6: Correr.** Expected: PASS; `npx vitest run` e `npm run build` sem erros.
- [ ] **Step 7: Commit.** `git add -A src && git commit -m "feat: pesquisa Ctrl K, barra superior e menu Mais por seccoes"`

### Task 7: Componentes base renovados

**Files:**
- Modify: `src/components/ui/Button.jsx`, `Card.jsx`, `Badge.jsx`, `Input.jsx` (Input, Textarea, Select), `Modal.jsx`, `Table.jsx`, `src/components/layout/PageHeader.jsx`
- Create: `src/components/ui/Tabs.jsx`, `FilterChips.jsx`, `EmptyState.jsx`
- Test: `src/__tests__/ui.test.jsx`

**Interfaces:**
- Produces:
  - `Table({ columns, rows, loading, emptyMessage })` com `columns: Array<{ key, label, width?, align?: 'left'|'right'|'center', render?: (row) => node, sortValue?: (row) => number|string }>`. Cabecalho de coluna com `sortValue` e clicavel (alterna ascendente, descendente e sem ordem; `aria-sort` no `th`). Cabecalho fixo ao fazer scroll.
  - `Tabs({ tabs: Array<{ id: string; label: string; count?: number }>, value: string, onChange: (id: string) => void })` com `role="tablist"`/`role="tab"`/`aria-selected`.
  - `FilterChips({ options: Array<{ value: string; label: string }>, value: string, onChange: (value: string) => void })`, botoes com `aria-pressed`.
  - `EmptyState({ icon?: LucideIcon, title: string, description?: string, action?: ReactNode })`, compacto (uma linha de titulo e uma de descricao).

Regra de todas as classes novas: sao **acrescentos** com prefixo `app:`; as classes antigas ficam como estao (para os portais fora de ambito). Valores do spec: Button (qualquer tamanho) `app:rounded-[6px]`; primary `app:bg-sand-500 app:text-ocean-900 app:hover:bg-sand-400`; secondary `app:border-n-300 app:text-n-800`. Card `app:rounded-sm app:shadow-none app:border-n-200`. Badge `app:normal-case app:tracking-normal app:rounded-full app:px-2.5`. Input/Textarea/Select: `app:bg-white app:text-[13px]`, etiqueta `app:normal-case app:tracking-normal app:text-[13px] app:text-n-700`. Modal `app:rounded-sm`, titulo `app:text-base`. Table: `th` `app:normal-case app:tracking-normal app:text-xs app:py-2`, `td` `app:py-2`. PageHeader: titulo `app:text-xl`, margem `app:mb-4 app:pb-4`.

- [ ] **Step 1: Testes (falham).** `ui.test.jsx`:
  - `Button primary mantem o aspeto antigo e ganha o novo`: o `className` contem `bg-ocean-700` **e** `app:bg-sand-500`.
  - `Button danger nao e redefinido`: o `className` nao contem `app:bg-sand-500`.
  - `Badge`: o `className` contem `uppercase` e `app:normal-case`.
  - `Table ordena`: com colunas `[{key:'n',label:'N',sortValue:r=>r.n,align:'right'}]` e linhas com n 2, 10, 1: depois de um clique no cabecalho a ordem e 1, 2, 10; depois de outro clique 10, 2, 1; depois de um terceiro, a ordem original; o `th` tem `aria-sort` `ascending`, `descending`, `none`.
  - `Table alinha`: as celulas da coluna com `align: 'right'` tem a classe `text-right`.
  - `Table vazia`: mostra `emptyMessage`.
  - `Tabs`: clicar numa tab chama `onChange` com o seu `id`; a tab ativa tem `aria-selected="true"`; `count` aparece.
  - `FilterChips`: clicar chama `onChange(value)`; o selecionado tem `aria-pressed="true"`.
  - `EmptyState`: mostra titulo e descricao; renderiza `action`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/ui.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implementar** os acrescimos `app:` e os tres componentes novos, e a ordenacao/alinhamento do `Table`.
- [ ] **Step 4: Correr.** Expected: PASS; `npx vitest run` completo e `npm run build` sem erros.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: componentes base com o novo aspeto do operador"`

### Task 8: Entrada (AuthLayout e Login)

**Files:**
- Modify: `src/components/auth/AuthLayout.jsx`
- Modify: `src/pages/Login.jsx` (remove `GlassAuthShell`; usa `AuthLayout`)
- Test: `src/__tests__/Login.test.jsx`

**Interfaces:**
- Consumes: `AuthLayout({ children })` existente; `login`/`forgotPassword` de `services/authService`.
- Produces: `AuthLayout` com `data-ui="app"` no elemento raiz; `Login` com campos claros (`AuthField` e `FieldLabel` com borda `n-300`, fundo branco, texto `n-900`, altura 44 px, cantos `rounded-sm`; sem pilulas, sem vidro).

- [ ] **Step 1: Testes (falham).** `Login.test.jsx` com `MemoryRouter`, `vi.mock('../services/authService')`, `useAuthStore` limpo:
  - `mostra os campos e as opcoes`: existem os campos de email e password, a opcao de lembrar o dispositivo e o botao `Esqueci a password`.
  - `usa o layout dividido`: o documento contem um elemento `[data-ui="app"]` e o titulo da marca (`auth.brandHeadline` em portugues) do `AuthLayout`.
  - `recuperar password`: clicar em `Esqueci a password` mostra o formulario de recuperacao; enviar chama `forgotPassword` com o email e mostra a confirmacao; `Voltar` regressa ao login.
  - `erro de credenciais`: `login` a rejeitar com `response.data.attempts_remaining = 2` mostra o texto de credenciais invalidas e o aviso de tentativas, visiveis (sem classes `text-white`).
  - `conta bloqueada`: `login` a rejeitar com `code: 'ACCOUNT_LOCKED'` e `retry_after_seconds: 120` mostra `auth.accessBlocked` e o contador `2:00`.
  - `login com sucesso`: chama `setRememberDevice` com o valor da opcao e navega para `/dashboard` quando `onboarding_complete` e verdadeiro, ou `/onboarding` quando nao.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Login.test.jsx`. Expected: FAIL.
- [ ] **Step 3: `AuthLayout`.** Acrescentar `data-ui="app"` ao `div` raiz; o painel direito mantem o cartao branco, com cantos `rounded-sm` e sombra mais leve; o botao primario dos formularios e `variant="accent"` (sand). Nao mudar o carrossel nem os textos `t('auth.*')`.
- [ ] **Step 4: `Login`.** Substituir `GlassAuthShell` por `AuthLayout` nos tres modos (login, recuperacao, recuperacao enviada); passar `AuthField`/`FieldLabel` ao estilo claro com os icones em `n-400`; as faixas de erro/aviso/sucesso passam para fundo claro (`bg-red-50 text-red-800 border-red-200`, `bg-amber-50 text-amber-800 border-amber-200`, `bg-emerald-50 text-emerald-800 border-emerald-200`); a linha "Lembrar" e "Esqueci a password" fica na mesma linha (esta ultima a direita, cor `ocean-700`); remover a etiqueta de micro-texto em maiusculas por cima do titulo e a pilula SSL passa a uma linha de texto discreta em `n-500`. Toda a logica (estado, bloqueio, contagem, redirecionamentos) fica igual.
- [ ] **Step 5: Correr.** Expected: PASS; `npx vitest run` e `npm run build` sem erros.
- [ ] **Step 6: Commit.** `git add -A src && git commit -m "feat: login com layout dividido e campos claros"`

### Task 9: Verificacao final da Fase 1 no browser

**Files:** nenhum (so verificacao); correcoes de pequenos desvios entram em commits `fix:` proprios.

- [ ] **Step 1: Testes e build.** Run: `npx vitest run` e `npm run build`. Expected: todos os testes passam, build sem erros.
- [ ] **Step 2: Arrancar.** Iniciar o dev server (`vite`, via `preview_start`) e abrir `/login` em 1280 px e 375 px.
- [ ] **Step 3: Login.** Verificar: painel esquerdo com foto e proposta de valor (so em desktop), formulario claro, "Esqueci a password" a direita da opcao "Lembrar", botao sand, recuperacao de password a funcionar, consola sem erros.
- [ ] **Step 4: App.** Entrar por `/demo` e verificar em 1280 px: barra lateral com 5 seccoes, Crescimento e Configuracao recolhidas, item ativo destacado, pesquisa Ctrl K (abre, filtra "calend", Enter navega), notificacoes e menu do utilizador (Ver perfil, Sair) a funcionar, botoes e campos das paginas Reservas e Definicoes com o novo aspeto, consola sem erros.
- [ ] **Step 5: Telemovel.** Em 375 px: barra inferior igual, botao "+" abre o menu "Mais" com cabecalhos por seccao e itens bloqueados com selo.
- [ ] **Step 6: Fora de ambito.** Abrir `/viajante/entrar` e `/book/<slug>` e confirmar que o aspeto nao mudou (sem classes `app:` ativas; sem `data-ui` no documento).
- [ ] **Step 7: Tour.** Com `startTour` (Definicoes > "Rever tour"), confirmar que os passos encontram as ancoras (`nav-dashboard`, `nav-unidades`, `nav-reservas`, `nav-financeiro`, `nav-site`).
- [ ] **Step 8: Registo.** Se houver desvios corrigidos, commits `fix:`; no fim `git status` limpo.

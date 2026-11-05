# Redesenho da app do operador, Fase 3 (Operacao: Reservas, Calendario, Unidades, Guias, Frota) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar as paginas de Operacao para os componentes e o aspeto "azul da marca" (tabelas densas, filtros em chips, campos e botoes dos componentes `ui`, estados vazios compactos), **sem alterar nenhum comportamento**: as mesmas colunas, as mesmas acoes, os mesmos pedidos ao backend com os mesmos dados.

**Architecture:** Cada pagina grande e primeiro partida em ficheiros por responsabilidade por **mudanca literal** (sem tocar numa linha de logica) e protegida por testes de caracterizacao escritos antes de migrar; so depois se trocam as tabelas escritas a mao pelo `Table`, os filtros pelo `FilterChips`, e os campos pelos `Input`/`Select`/`Textarea`. O aspeto novo entra pelos componentes partilhados (que ja o trazem so dentro da app do operador, via `app:`); o codigo das paginas usa as classes normais.

**Tech Stack:** React 18, Vite, Tailwind 3, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (secoes 5.4 e 7: Fase 3). Fases 1 e 2 ja publicadas. Caminhos relativos a `frontend/`; comandos dentro de `frontend/`.

**Estado atual medido (base deste plano):**
- `pages/Reservations.jsx` 1478 linhas: tres tabelas por tipo de operador (`ActivityTable`, `RentacarTable`, `RestaurantTable`), cada uma com **vista de cartoes no telemovel** (`md:hidden`) e tabela no ecra largo (`hidden md:block`); seis modais (`ManifestoModal`, `RescheduleModal`, `NoShowModal`, `LevantamentoModal`, `DevolucaoModal`, `RestaurantCreateModal`); linha de filtros com 9 `<input>`, 4 `<select>`, 4 `<textarea>`, 28 `<button>` escritos a mao. As linhas das tabelas **nao tem clique**; as acoes sao botoes.
- `components/units/UnitForm.jsx` 1452 linhas com **quatro formularios** (`TourForm`, `HotelRoomForm`, `RentacarVehicleForm`, `RestaurantTableForm`) e cinco editores auxiliares.
- `pages/Calendar.jsx` 647 linhas: a grelha unidades x dias e uma matriz, nao uma tabela de dados; barra com 2 `<select>`.
- `pages/Guides.jsx` 812 linhas (cartao, formulario, dois modais, separador de disponibilidade com tabela); `pages/Fleet.jsx` 229; `pages/Units.jsx` 298 + `components/units/UnitList.jsx` 319.
- **Nenhuma destas paginas tem testes.** A maior parte do texto esta fixo em portugues (ex.: so 28 chamadas a `t()` em `Reservations.jsx`).

**Decisoes de desenho (para o utilizador rever):**
1. **Mudanca visual, nao funcional.** Nenhuma coluna, acao, filtro ou campo e acrescentado ou removido. A unica funcionalidade nova admitida e a **ordenacao por clique** em colunas numericas/de data (Data, Total, Pax), que o `Table` ja suporta; a ordem inicial continua a ser a do servidor.
2. **Textos nao se traduzem nesta fase.** O texto fixo em portugues fica como esta (e uma divida de i18n a tratar a parte); qualquer texto **novo** usa `t()` com chaves nas quatro linguas.
3. **A grelha do Calendario nao passa a `Table`** (e uma matriz com celulas interativas); so a barra de filtros e os cartoes/legenda sao migrados.
4. **Fora de ambito** (itens de Operacao que nao estao na lista do spec): `Housekeeping`, `Maintenance`, `MenuDigital`, `Pedidos`. Podem ser uma Fase 3b com o mesmo metodo.
5. **Verificacao visual com dados:** como o backend local nao se arranca (usa a base de producao), a Tarefa 15 usa um servidor de **dados falsos descartavel** (fora do repositorio) para ver as paginas preenchidas.

## Global Constraints

- **Comportamento identico:** mesmos pedidos aos servicos com os mesmos argumentos e formas de dados (numeros continuam numeros; vazio continua a ser o que era: `''`, `null` ou omitido); mesmas rotas, ancoras `data-tour` e nomes de ficheiros publicos de rotas. Mudancas de ficheiro (partir paginas) sao **literais**.
- Sem emojis; icones so `lucide-react`; comentarios em portugues sem acentos; ficheiros mantem o fim de linha existente (confirmar com `file`).
- Componentes partilhados (`ui/*`, `financial/KpiCard`) **nao mudam**; se uma pagina precisar de algo que lhes falta, para-se e regista-se (nao se altera `Table` nesta fase).
- Usar os componentes existentes: `Table`, `FilterChips`, `Select`/`Input`/`Textarea` (de `ui/Input.jsx`), `Badge`, `EmptyState`, `Button`, `Modal`, `PageHeader`. Botao principal = `Button` por omissao (sand dentro da app); acoes secundarias `variant="secondary"` ou `ghost`.
- Visual alvo (o mesmo do Dashboard aprovado): cartoes brancos com borda `n-200` e cantos de 8 px; texto de tabela 13 px; etiquetas em minusculas normais; numeros `tabular-nums`; estados com `Badge`; vazios com `EmptyState` compacto.
- Testes: `fireEvent`/`findBy*`/`waitFor` de `@testing-library/react` (nao `user-event`: da avisos `act()` neste repo); `MemoryRouter` com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; `vi.mock` dos servicos; **datas do teste em hora local** e independentes do dia; saida limpa; sem `console.error` (os handlers existentes que fazem `console.error` nao se mexem, mas os testes nao os devem disparar).
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit. Linha de base: 280/280.

## Review Focus

- Todas as acoes de uma linha (avancar estado, editar, apagar, voucher, reagendar, no-show, levantamento, devolucao, atribuir guia, ver) continuam a existir e a chamar o mesmo servico com os mesmos argumentos (teste de caracterizacao antes e depois).
- A vista de **cartoes do telemovel** de cada tabela (`md:hidden`) continua igual; so a tabela do ecra largo e migrada.
- Os formularios (unidades, guias, frota, reservas) submetem **exatamente o mesmo objeto** (chaves, tipos e valores vazios): teste de payload antes e depois.
- Um operador de um tipo que a pagina nao suporta bem (ex.: hotel em `Reservations`) nao rebenta: testes para os quatro tipos e para tipo em falta.
- Calendario: navegacao de semana atraves da virada de mes e de ano, e filtro por unidade/guia, com datas independentes do dia em que o teste corre.

---

### Task 1: Reservas, rede de seguranca e divisao literal do ficheiro

**Files:** Create `src/pages/reservations/shared.jsx` (helpers usados por varias partes: `formatDate`, `SourceBadge`, `STATUS_NEXT` e o que mais seja partilhado), `ActivityTable.jsx`, `RentacarTable.jsx`, `RestaurantTable.jsx`, `ManifestoModal.jsx`, `RescheduleModal.jsx`, `NoShowModal.jsx`, `LevantamentoModal.jsx`, `DevolucaoModal.jsx`, `RestaurantCreateModal.jsx` (cada um com o que so ele usa, ex.: `parseRentacarMeta`, `FuelSelector`, `parseRestaurantMeta`, `deriveTurno`); Modify `src/pages/Reservations.jsx` (fica so com `Reservations()` e imports); Test `src/__tests__/Reservations.test.jsx`.

**Interfaces:** cada ficheiro exporta por omissao o seu componente com as **mesmas props de hoje**; `shared.jsx` exporta por nome os helpers. `Reservations` continua `export default` de `pages/Reservations.jsx`.

- [ ] **Step 1: Testes de caracterizacao (devem passar ANTES de mover).** Com servicos mockados (`reservationsService`, `unitsService`, `staffService`, os servicos de guias/frota que a pagina chame; ler os imports) e `useAuthStore` com `operator_type` `activity`, `rentacar`, `restaurant`, `hotel` e em falta: para cada tipo a pagina renderiza o titulo e o texto de coluna/seccao proprio do tipo (ex.: cabecalho "Tour" nas atividades, texto especifico do rent-a-car e do restaurante: ler as colunas atuais) sem excecoes; o filtro de estado `Confirmada` esconde as reservas de outros estados e `Todas` volta a mostra-las; `Nova reserva` abre o formulario; o botao de ver (`aria-label` `reservations.view`) abre o detalhe da reserva; a acao de avancar estado chama `changeStatus(id, proximoEstado)` com o argumento certo; `servicos a falhar` (todos rejeitam) nao rebenta. Fixtures com datas relativas a hoje.
- [ ] **Step 2: Correr e confirmar que passa (linha de base).** Run: `npx vitest run src/__tests__/Reservations.test.jsx`. Expected: PASS antes de qualquer movimento.
- [ ] **Step 3: Mover literalmente** (extrair intervalos de linhas com ferramentas de shell, nao reescrever a mao; verificar com diff que os corpos ficaram identicos).
- [ ] **Step 4: Correr.** `npx vitest run` e `npm run build`. Expected: tudo passa; `pages/Reservations.jsx` com menos de 400 linhas.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "refactor: Reservas partidas em ficheiros por responsabilidade"`

### Task 2: Reservas, barra de filtros

**Files:** Modify `src/pages/Reservations.jsx` (a linha de filtros, ~linhas 1236-1300 antes da divisao); Test `src/__tests__/Reservations.test.jsx`.

**Interfaces:** consome `FilterChips({ options: [{value,label}], value, onChange })` e `Select`/`Input` de `components/ui/Input`. O filtro de estado passa a `FilterChips` com as mesmas opcoes (`''` -> "Todas", e `reservations.status.<estado>` para os outros); o selector de tour/unidade, o campo de data e o resto passam a `Select`/`Input` compactos; `statusFilter`, `tourFilter` e os outros estados e a logica de `filtered` **nao mudam**.

- [ ] **Step 1: Testes (falham so no que muda).** Os testes da Tarefa 1 continuam verdes; acrescentar: o filtro de estado e um grupo de botoes `aria-pressed` (o selecionado tem `aria-pressed="true"`); mudar o `Select` de tour filtra a lista; o campo de data filtra; a contagem do subtitulo (`N resultado(s)`) acompanha.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Reservations.test.jsx`. Expected: FAIL nos novos.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: filtros de Reservas com chips e campos do design system"`

### Task 3: Reservas, tabela de atividades

**Files:** Modify `src/pages/reservations/ActivityTable.jsx`; Test `src/__tests__/ReservationsActivityTable.test.jsx`.

**Interfaces:** no ecra largo, o `<table>` escrito a mao passa a `Table({ columns, rows, emptyMessage })` com as colunas **exatamente as de hoje, pela mesma ordem** (Ref, Tour, Data, Cliente, Pax centrado, Origem, Estado, Total a direita, acoes), os mesmos conteudos de celula (reutilizar o JSX de cada celula em `render`) e as mesmas acoes na ultima coluna. `sortValue` apenas em Data (`check_in`), Pax e Total (o valor numerico que a celula mostra). A vista de cartoes `md:hidden` **nao se toca**. O estado `actionLoading`, `assignRes` e todos os handlers ficam como estao.

- [ ] **Step 1: Testes (falham so no que muda).** Renderiza as nove colunas com os cabecalhos de hoje; cada linha mostra os mesmos valores (Ref = 8 primeiros caracteres do id, data formatada com `formatDate`, Total formatado como hoje); cada botao de acao chama o handler certo com a reserva certa (ver, editar, apagar, voucher, reagendar, no-show, atribuir guia, avancar estado: ler quais existem por estado da reserva e testar as que a logica atual permite, incluindo as que **nao** aparecem para estados finais); clicar no cabecalho Data ordena (ascendente, depois descendente, depois ordem original); sem reservas mostra o vazio compacto; reserva com campos em falta (`customer_name` ausente) mostra `—` e nao rebenta.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/ReservationsActivityTable.test.jsx`. Expected: FAIL nos novos.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: tabela de reservas de atividades com o componente Table"`

### Task 4: Reservas, tabela de rent-a-car

Mesmo metodo da Tarefa 3 em `src/pages/reservations/RentacarTable.jsx` (teste em `src/__tests__/ReservationsRentacarTable.test.jsx`): colunas e acoes como hoje (incluindo `onLevantamento` e `onDevolucao`, que dependem do estado), cartoes do telemovel intactos, `sortValue` so em datas e totais. Casos especificos: um aluguer `confirmed` mostra a acao de levantamento e nao a de devolucao; um `checked_in` mostra a devolucao; campos de matricula/metadados em falta nao rebentam (`parseRentacarMeta`). Commit: `feat: tabela de reservas de rent-a-car com o componente Table`.

### Task 5: Reservas, tabela de restaurante

Mesmo metodo em `src/pages/reservations/RestaurantTable.jsx` (teste em `src/__tests__/ReservationsRestaurantTable.test.jsx`): colunas e acoes como hoje (incluindo `onDetails`), turno derivado (`deriveTurno`) igual, cartoes intactos. Caso especifico: reserva sem hora/turno mostra o mesmo texto de hoje. Commit: `feat: tabela de reservas de restaurante com o componente Table`.

### Task 6: Reservas, modais

**Files:** Modify os seis modais em `src/pages/reservations/`; Test `src/__tests__/ReservationsModals.test.jsx`.

**Interfaces:** nos modais, os `<input>`, `<select>`, `<textarea>` escritos a mao passam a `Input`/`Select`/`Textarea` (etiqueta, `required`, `error` quando o modal ja tem erro por campo); a caixa de confirmacao/`checkbox` nativa pode manter-se (so classes consistentes); botoes de rodape com `Button` (cancelar `secondary`, confirmar principal). A estrutura `Modal`, os titulos e **os payloads submetidos nao mudam**.

- [ ] **Step 1: Testes de caracterizacao do payload (passam ANTES de migrar).** Para cada modal, preencher os campos e confirmar: `RescheduleModal` chama o servico com a nova data; `NoShowModal` com o motivo/valores atuais; `LevantamentoModal` com `km_out`, combustivel, `caucao` e `caucao_paid` como numeros/booleanos exatamente como hoje; `DevolucaoModal` com `km_in`, `caucao_retained`, etc.; `RestaurantCreateModal` com mesa, ocasiao e `lista_espera`; `ManifestoModal` com o filtro por tour e data (so leitura). Usar `toHaveBeenCalledWith` com o objeto completo.
- [ ] **Step 2: Correr e confirmar verde.** Run: `npx vitest run src/__tests__/ReservationsModals.test.jsx`. Expected: PASS.
- [ ] **Step 3: Migrar os campos** modal a modal.
- [ ] **Step 4: Correr.** Expected: PASS (os mesmos testes, sem alteracoes), mais um teste por modal de que os campos tem etiqueta associada (`getByLabelText`); suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: modais de Reservas com campos do design system"`

### Task 7: Reservas, formulario, detalhe e cartao

**Files:** Modify `src/components/reservations/ReservationForm.jsx`, `ReservationDetailModal.jsx`, `ReservationCard.jsx`; Test `src/__tests__/ReservationForm.test.jsx`.

**Interfaces:** mesmas props e mesmos pontos de submissao. Campos do formulario -> `Input`/`Select`/`Textarea`; botoes -> `Button`; o `ReservationCard` (usado no telemovel e em listas) so ganha classes consistentes (cartao branco, borda, cantos de 8 px) e `Badge` onde hoje tem classes soltas. `StatusBadge` (tem teste proprio) **nao muda**.

- [ ] **Step 1: Testes (verde antes e depois).** Preencher o formulario e submeter chama `onSave`/o servico com o objeto exato de hoje (incluindo valores vazios e numeros); erro de validacao do formulario aparece; o detalhe mostra os mesmos campos e acoes; o cartao mostra cliente, estado e total e responde aos mesmos botoes.
- [ ] **Step 2: Migrar e Step 3: correr** (`npx vitest run`, `npm run build`).
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "feat: formulario, detalhe e cartao de reserva com o design system"`

### Task 8: Calendario

**Files:** Modify `src/pages/Calendar.jsx` (barra de filtros ~linhas 448-520), `src/components/calendar/CalendarView.jsx`; Test `src/__tests__/Calendar.test.jsx`.

**Interfaces:** os dois `<select>` (unidade e guia) -> `Select`; os botoes de navegacao de semana/hoje -> `Button` (`ghost`/`secondary`); legenda e cartoes em estilo consistente; a grelha unidades x dias **mantem a estrutura e a logica** (so classes de cor e tipografia). `toDateStr`, `addDays`, `getWeekStart`, `getWeekDays` nao mudam.

- [ ] **Step 1: Testes de caracterizacao (verde antes).** Com servicos mockados: a grelha mostra os sete dias da semana atual e as unidades; "semana seguinte" e "anterior" mudam os dias; atravessar o fim de um mes e de um ano (fake `Date` em `2026-12-29` e em `2026-03-01`, restaurado em `afterEach`) mostra os dias corretos; filtrar por unidade esconde as outras; filtrar por guia filtra as reservas; uma reserva multi-dia ocupa as celulas certas.
- [ ] **Step 2: Migrar; Step 3: correr** (mesmos testes verdes mais `os selects tem etiqueta`; suite e build limpos).
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "feat: Calendario com barra de filtros do design system"`

### Task 9: Unidades (pagina e lista)

**Files:** Modify `src/pages/Units.jsx`, `src/components/units/UnitList.jsx`; Test `src/__tests__/Units.test.jsx`.

**Interfaces:** `TourCard`/cartoes de unidade e a lista passam a cartoes no estilo aprovado, o vazio a `EmptyState` com o botao de adicionar, as acoes (editar, apagar, ativar/desativar, submeter ao Conect, ver QR) com `Button`/`Badge` do sistema; `TableQrModal` so ganha classes. Mesmos handlers e mesmas props.

- [ ] **Step 1: Testes (verde antes e depois).** Para cada tipo de operador a lista mostra as unidades com nome e preco formatado como hoje; cada acao chama o handler certo; o estado ativo/inativo alterna; sem unidades mostra o vazio com a acao de criar; `Nova unidade` abre o modal com o `UnitForm` do tipo certo.
- [ ] **Step 2: Migrar; Step 3: correr** (suite e build limpos).
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "feat: pagina e lista de Unidades com o design system"`

### Task 10: UnitForm, rede de seguranca e divisao literal

**Files:** Create `src/components/units/forms/TourForm.jsx`, `HotelRoomForm.jsx`, `RentacarVehicleForm.jsx`, `RestaurantTableForm.jsx`, `editors.jsx` (os cinco editores auxiliares e `OtaFields`/`ConectFields`/`SectionLabel`/`LANGUAGES` partilhados); Modify `src/components/units/UnitForm.jsx` (fica so com o despacho por tipo); Test `src/__tests__/UnitForm.test.jsx`.

**Interfaces:** `UnitForm` mantem o `export default` e as props (`unit, operatorType, onSave, onCancel, loading, error`); cada formulario por tipo exporta por omissao o seu componente com as mesmas props; `editors.jsx` exporta por nome.

- [ ] **Step 1: Testes de payload (verde antes de mover).** Para cada um dos quatro formularios preencher o minimo valido e submeter: `onSave` recebe o objeto exato de hoje (ler o `handleSubmit`/`onSave` de cada um; chaves, numeros vs texto, `description` serializada em JSON para quarto/viatura/mesa, prefixos compostos como "Mesa N"); editar uma unidade existente pre-preenche os campos (`parseRoomMeta`, `parseVehicleMeta`, `parseTableMeta`, `stripComposedPrefix`, `stripMesaPrefix`); campos obrigatorios em falta mostram o erro de hoje; `error` recebido via prop e mostrado.
- [ ] **Step 2: Correr e confirmar verde.** Run: `npx vitest run src/__tests__/UnitForm.test.jsx`. Expected: PASS.
- [ ] **Step 3: Mover literalmente** (shell, sem retranscrever; confirmar corpos identicos).
- [ ] **Step 4: Correr.** `npx vitest run` e `npm run build`; `UnitForm.jsx` com menos de 80 linhas.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "refactor: UnitForm partido num ficheiro por tipo de unidade"`

### Task 11: Formulario de tours

**Files:** Modify `src/components/units/forms/TourForm.jsx` e `editors.jsx` (os editores usados por tours: comodidades, itens incluidos, paragens, horarios, escaloes de preco); Test `src/__tests__/UnitForm.test.jsx` (acrescentar).

**Interfaces:** `<input>`/`<textarea>` -> `Input`/`Textarea`; seccoes com titulo (`SectionLabel`) em estilo consistente; botoes de adicionar/remover linha com `Button` (`ghost`/`secondary`, `aria-label` onde so ha icone); rodape Cancelar (secondary) + Guardar (principal, `loading`). O objeto submetido e a ordem dos campos **nao mudam**.

- [ ] **Step 1: Testes.** Os de payload da Tarefa 10 continuam verdes sem editar; acrescentar para os editores: adicionar e remover um item incluido, uma paragem, um horario e um escalao altera o `onSave` como hoje; campos com etiqueta associada.
- [ ] **Step 2: Migrar; Step 3: correr** (suite e build limpos).
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "feat: formulario de tours com o design system"`

### Task 12: Formularios de quarto, viatura e mesa

Mesmo metodo da Tarefa 11 em `HotelRoomForm.jsx`, `RentacarVehicleForm.jsx` e `RestaurantTableForm.jsx` (testes acrescentados a `UnitForm.test.jsx`): campos -> `Input`/`Select`/`Textarea`, seccoes e rodape como na Tarefa 11, payloads inalterados (incluindo `description` em JSON e os campos de documentos/quilometragem da viatura). Commit: `feat: formularios de quarto, viatura e mesa com o design system`.

### Task 13: Guias

**Files:** Modify `src/pages/Guides.jsx`; Test `src/__tests__/Guides.test.jsx`.

**Interfaces:** `GuideCard` em estilo de cartao aprovado com `Badge` e `Button`; `GuideForm`, `HistoryModal` e `AssignModal` com `Input`/`Select`/`Textarea`/`Button`; a tabela do separador `AvailabilityTab` passa a `Table` (colunas como hoje; a grelha de disponibilidade por dia pode manter celulas proprias dentro das colunas). Handlers e payloads inalterados.

- [ ] **Step 1: Testes (verde antes e depois).** Lista de guias mostra nome, estado e unidades; criar/editar chama o servico com o objeto de hoje; abrir o historico e atribuir uma reserva chamam os servicos certos; o separador de disponibilidade mostra as linhas e alterna a disponibilidade como hoje; sem guias mostra o vazio compacto; servicos a falhar nao rebenta.
- [ ] **Step 2: Migrar; Step 3: correr** (suite e build limpos).
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "feat: pagina de Guias com o design system"`

### Task 14: Frota

**Files:** Modify `src/pages/Fleet.jsx`, `src/components/fleet/FleetSelector.jsx`; Test `src/__tests__/Fleet.test.jsx`.

**Interfaces:** `FleetForm` e a lista/cartoes com `Input`/`Select`/`Button`/`Badge`/`EmptyState`; `FleetSelector` mantem a API. Payload e handlers inalterados.

- [ ] **Step 1: Testes (verde antes e depois).** Lista com o subtitulo "N disponivel(is) de M", criar/editar com o payload de hoje, apagar, estado de disponibilidade; `FleetSelector` chama `onChange` como hoje.
- [ ] **Step 2: Migrar; Step 3: correr** (suite e build limpos).
- [ ] **Step 4: Commit.** `git add -A src && git commit -m "feat: pagina de Frota com o design system"`

### Task 15: Verificacao no browser com dados falsos

**Files:** nenhum no repositorio; criar **fora do repositorio** (diretoria de scratch) um servidor Node minimo `mock-api.js` na porta 3001 com `Access-Control-Allow-Origin: *`, que responde as listas necessarias com dados de exemplo e a `{ data: [] }` para o resto. **Nao arrancar o backend real.**

- [ ] **Step 1: Servidor de dados falsos.** Rotas: `GET /api/v1/reservations` (reservas de atividades, hotel, rent-a-car e restaurante conforme `operator_type`, datas relativas a hoje, estados variados), `GET /api/v1/units`, guias, frota, atribuicoes, notificacoes (`[]`), `GET /api/v1/messages/unread-count` (`{data:{count:0}}`), financeiro (`{data:{atual:{...},anterior:{...},variacao:{...}}}`). Respostas no formato `{ data: ... }` que o frontend espera.
- [ ] **Step 2: Arrancar o frontend** (`preview_start saldesk-frontend`) com uma sessao ficticia no `localStorage` (`saldesk-auth`) e verificar em 1280 px e 375 px, para cada tipo (`activity`, `hotel`, `rentacar`, `restaurant`): Reservas (filtros, tabela preenchida, abrir o formulario e um modal), Calendario (grelha preenchida, navegar semana), Unidades (cartoes, abrir o formulario de cada tipo), Guias, Frota; consola sem erros alem dos esperados; sem scroll horizontal a 375 px; tirar capturas para o utilizador.
- [ ] **Step 3: Fora de ambito.** `/viajante/entrar` e `/book/<slug>` sem `data-ui` e sem mudanca; Financeiro continua a abrir.
- [ ] **Step 4: Limpar** a sessao ficticia e parar o servidor; `git status` limpo.

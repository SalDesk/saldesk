# Dashboard do operador, Etapa 2 (agendas de hotel, rent-a-car e restaurante) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a hotel, rent-a-car e restaurante a mesma moldura da vista "Hoje" das atividades (cartao de destaque, 4 numeros, agenda do dia, coluna da direita), mantendo os mapas de quartos, frota e mesas.

**Architecture:** Funcoes puras novas em `pages/dashboard/agendaTipos.js` transformam as reservas de cada tipo em `Evento` (o mesmo tipo da Etapa 1). Um hook `useMolduraComum` carrega os dados comuns aos tres (resumo, receita por dia, reservas do mes, por pagar, 7 dias, avaliacao). Cada dashboard monta `HeroCard`, `StatTiles`, `DayAgenda`, `AttentionPanel`, `Shortcuts`, `NextDaysStrip` (Etapa 1) e, por baixo, o seu mapa atual.

**Tech Stack:** React 18, Vite, Tailwind (tokens), vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-dashboard-operador-agenda-design.md` (secoes 3, 4, 5 e 7; Etapa 1 implantada: `components/dashboard/{DayAgenda,HeroCard,StatTiles,Shortcuts,NextDaysStrip}.jsx`, `pages/dashboard/agendaLogic.js`).

## Global Constraints

- So frontend; sem base de dados nem backend.
- `components/ui/*` nao muda. Sem cores hexadecimais nem cores nomeadas do Tailwind nos ficheiros novos ou reescritos.
- Textos novos em pt, en, de, nl, sob `dashboard.*`.
- Hotel: chegadas as **14:00**, partidas as **11:00** (decisao do dono), duracao 60 min.
- Rent-a-car: hora = `start_time` da reserva, senao "Sem hora marcada"; duracao 60 min.
- Restaurante: hora = `start_time`; fim = + `duration_minutes`, senao **90 min**.
- Pedidos novos em paralelo; cada falha cai para vazio sem apagar o resto.
- "Requer atencao" de cada tipo mantem a logica atual (mesmos itens).
- Atividades (`ActivityDashboard.jsx`) e `ResumoView` nao mudam.
- TDD; commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisoes deste plano (rulings ao escrever)

- **Mapas mantem-se.** O anti-objetivo "nao perder informacao que o Hoje atual mostra" cobre o mapa de quartos, a frota e o mapa de mesas (com o seu detalhe ao clicar). Ficam numa seccao a largura toda, por baixo da grelha agenda/coluna direita. As listas de check-ins/check-outs, levantamentos/devolucoes e turnos saem: a agenda mostra o mesmo.
- **Anel = ocupacao de hoje** (rotulo "Ocupação hoje") para os tres tipos, com os calculos que os dashboards atuais ja fazem (spec 5: "reaproveitam os calculos que os dashboards atuais desses tipos ja fazem"; nenhum deles tem ocupacao mensal). Restaurante: mesas com reserva ativa hoje / mesas ativas.
- **Chegadas/partidas, levantamentos/devolucoes** usam as definicoes atuais dos dashboards (chegada/levantamento: `check_in` = hoje e `pending`/`confirmed`; partida/devolucao: `check_out` = hoje e `checked_in`), para a agenda bater com as contagens.
- **Pre-pedido do restaurante:** `listOrders()` (ultimos 200 pedidos) cruzado por `reservation_id`; sem pre-pedido a parte nao aparece.

## Review Focus

1. Hotel: o mesmo hospede chega e outro sai do mesmo quarto hoje -> dois eventos distintos (11:00 partida e 14:00 chegada), nunca um so. (Task 1, `hotel_chegada_e_partida_no_mesmo_quarto_sao_dois_eventos`)
2. Reserva devolvida por dois pedidos (estadia de hoje + `checked_in` ultrapassada) -> um so evento (o dashboard ja faz `uniaoPorId`; a funcao pura recebe a lista ja unida e nao duplica ids). (Task 1, `ids_repetidos_dao_um_so_evento`)
3. Restaurante: `menu_item`/`tasting_menu` nunca entram como mesa nem como evento. (Task 1, `restaurante_ignora_pratos_e_menus`)
4. Rent-a-car sem `start_time` -> "Sem hora marcada", nunca desaparece. (Task 1, `rentacar_sem_hora_vai_para_sem_hora`)
5. Mes anterior a 0 ou resumo em falta -> sem pilula de variacao e grafico plano. (Task 3, `molduras_sem_resumo_nao_rebentam` em cada dashboard)

---

### Task 1: Eventos de hotel, rent-a-car e restaurante

**Files:**
- Create: `frontend/src/pages/dashboard/agendaTipos.js`
- Modify: `frontend/src/pages/dashboard/agendaLogic.js` (exportar `paraHora`)
- Test: `frontend/src/__tests__/agendaTipos.test.js`

**Interfaces:**
- Consumes: `paraMinutos`, `DURACAO_POR_OMISSAO_MIN` de `agendaLogic.js`.
- Produces (todos devolvem `Evento[]` da Etapa 1, mais o campo opcional `detalhe: string` e `tipo: 'chegada'|'partida'|'levantamento'|'devolucao'|'mesa'`):
  - `HORA_CHEGADA_HOTEL = '14:00'`, `HORA_PARTIDA_HOTEL = '11:00'`, `DURACAO_MESA_MIN = 90`
  - `eventosHotel({ reservas, unidades, hoje, t }) -> Evento[]`
  - `eventosRentacar({ reservas, unidades, hoje, t }) -> Evento[]`
  - `eventosRestaurante({ reservas, unidades, pedidos, hoje, t }) -> Evento[]`
  - `paraHora(minutos: number) -> 'HH:MM'` (exportado de `agendaLogic.js`)
  - `t` e a funcao de traducao (os testes passam `(k, v) => k + (v ? JSON.stringify(v) : '')`).

Regras:
- Um evento por reserva; `id` = `${tipo}|${reserva.id}`; ids repetidos na entrada contam uma vez.
- `titulo` = `t('dashboard.agenda.<tipo>', { name: customer_name || '—' })` (ex.: pt "Chegada · Ana Silva").
- `pessoas` = `guests` (minimo 1); `capacidade` = null (sem barra); `pendentes` = 1 se `status === 'pending'`; `clientes` = [customer_name]; `guias` = [].
- `detalhe`:
  - Hotel: `[nome do quarto, t('dashboard.agenda.guests', { n }), t('dashboard.agenda.nights', { n: noites })]` (noites = dias entre check_in e check_out, minimo 1).
  - Rent-a-car: `[marca modelo (meta.brand/meta.model) ou unit.name, meta.plate]`.
  - Restaurante: `[t('dashboard.restaurant.table', { n: meta.number }) ou unit.name, t('dashboard.agenda.guests', { n }), t('dashboard.agenda.preOrder') se houver pedido com esse reservation_id]`.
  - Partes vazias omitidas, unidas por " · ".
- Restaurante: unidades `menu_item`/`tasting_menu` e reservas nelas ignoradas; so `pending`/`confirmed`/`checked_in`.

- [ ] **Step 1: Write the failing tests** (`agendaTipos.test.js`), com `HOJE = '2026-11-20'`, `t = (k, v) => k + (v ? JSON.stringify(v) : '')`:
  - `hotel_chegadas_as_14_e_partidas_as_11` — chegada (`check_in` HOJE, confirmed) -> `inicio '14:00'`, `fimMin 900`, `tipo 'chegada'`; partida (`check_out` HOJE, checked_in) -> `'11:00'`, `tipo 'partida'`; reserva a meio da estadia (nem chega nem sai hoje) -> nenhum evento.
  - `hotel_chegada_e_partida_no_mesmo_quarto_sao_dois_eventos`.
  - `hotel_detalhe_quarto_hospedes_noites` — quarto "Suite 12", 2 hospedes, 3 noites -> `detalhe` = `'Suite 12 · dashboard.agenda.guests{"n":2} · dashboard.agenda.nights{"n":3}'`.
  - `hotel_pendente_conta_como_por_confirmar` — `pendentes` 1.
  - `ids_repetidos_dao_um_so_evento` — a mesma reserva duas vezes -> 1 evento.
  - `rentacar_levantamento_com_hora_e_devolucao` — `start_time '09:30:00'` -> `inicio '09:30'`, `fimMin 630`; detalhe com marca, modelo e matricula da meta.
  - `rentacar_sem_hora_vai_para_sem_hora` — `inicio null`.
  - `restaurante_hora_duracao_e_mesa` — `start_time '20:00'`, `duration_minutes 120` -> `fimMin 1320`; sem `duration_minutes` -> `fimMin 1290`; mesa `meta.number 4` -> detalhe comeca por `'dashboard.restaurant.table{"n":4}'`.
  - `restaurante_marca_pre_pedido` — pedido `{ reservation_id: r.id }` -> detalhe termina em `'dashboard.agenda.preOrder'`.
  - `restaurante_ignora_pratos_e_menus` e `so_estados_ativos_no_restaurante` (cancelled/checked_out fora).
  - `entradas_em_falta_nao_rebentam` — cada funcao com `{}` devolve `[]`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/__tests__/agendaTipos.test.js` — Expected: FAIL (modulo em falta).
- [ ] **Step 3: Implement** `agendaTipos.js` e exportar `paraHora` de `agendaLogic.js`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: eventos da agenda de hotel, rent-a-car e restaurante`

---

### Task 2: DayAgenda aceita detalhe e resumo proprios; textos novos

**Files:**
- Modify: `frontend/src/components/dashboard/DayAgenda.jsx`, `frontend/src/components/dashboard/HeroCard.jsx`, `frontend/src/i18n/{pt,en,de,nl}.json`, `frontend/src/__tests__/i18nDashboard.test.js`
- Test: `frontend/src/__tests__/dashboardMoldura.test.jsx`

**Interfaces:**
- Produces: `<HeroCard ... rotuloOcupacao={string?} />` — rotulo do anel, por omissao `t('dashboard.hero.occupancy')`.
- Produces: `<DayAgenda ... resumo={string?} />` — quando presente substitui o texto "N tours · N pessoas" do cabecalho; `Evento.detalhe` (string) quando presente substitui a linha secundaria composta (lotacao/guia/local).

Chaves novas (pt / en; de e nl traduzidos):
- `dashboard.agenda.chegada` "Chegada · {{name}}" / "Arrival · {{name}}"; `.partida` "Partida · {{name}}" / "Departure · {{name}}"; `.levantamento` "Levantamento · {{name}}" / "Pick-up · {{name}}"; `.devolucao` "Devolução · {{name}}" / "Return · {{name}}"; `.mesa` "{{name}}" / "{{name}}"; `.guests` "{{n}} pessoa(s)" / "{{n}} guest(s)"; `.nights` "{{n}} noite(s)" / "{{n}} night(s)"; `.preOrder` "pré-pedido" / "pre-order"; `.empty` "Nada agendado para hoje" / "Nothing scheduled today"
- `dashboard.hero.occupancyToday` "Ocupação hoje" / "Occupancy today"; `.roomsOccupied` "{{n}} de {{total}} quartos" / "{{n}} of {{total}} rooms"; `.vehiclesRented` "{{n}} de {{total}} viaturas" / "{{n}} of {{total}} vehicles"; `.tablesTaken` "{{n}} de {{total}} mesas" / "{{n}} of {{total}} tables"; `.arrivals` "{{n}} chegadas" / "{{n}} arrivals"; `.departures` "{{n}} partidas · {{p}} por confirmar" / "{{n}} departures · {{p}} to confirm"; `.pickups` "{{n}} levantamentos" / "{{n}} pick-ups"; `.returns` "{{n}} devoluções" / "{{n}} returns"; `.peopleTables` "em {{n}} reservas · {{p}} por confirmar" / "in {{n}} bookings · {{p}} to confirm"
- `dashboard.agenda.summaryHotel` "{{a}} chegadas · {{d}} partidas" / "{{a}} arrivals · {{d}} departures"; `.summaryRentacar` "{{a}} levantamentos · {{d}} devoluções" / "{{a}} pick-ups · {{d}} returns"; `.summaryRestaurant` "{{n}} reservas · {{p}} pessoas" / "{{n}} bookings · {{p}} people"

- [ ] **Step 1: Write the failing tests:** em `dashboardMoldura.test.jsx`: `detalhe_proprio_substitui_a_linha_composta` (evento com `detalhe: 'Suite 12 · 2 pessoa(s)'` e `capacidade: null` -> esse texto exato, sem progressbar); `resumo_proprio_no_cabecalho` (`resumo="2 chegadas · 1 partidas"` -> esse texto, e nao "tours"); `hero_rotulo_do_anel_proprio` (`rotuloOcupacao="Ocupação hoje"` -> esse texto e nao "Ocupação do mês"). Em `i18nDashboard.test.js`: acrescentar as chaves acima ao objeto `esperado` do teste "os grupos da moldura nova existem...".
- [ ] **Step 2: Run** `npx vitest run src/__tests__/dashboardMoldura.test.jsx src/__tests__/i18nDashboard.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: agenda aceita detalhe e resumo proprios; textos dos outros tipos`

---

### Task 3: Hook de dados comuns da moldura

**Files:**
- Create: `frontend/src/pages/dashboard/useMolduraComum.js`
- Test: `frontend/src/__tests__/useMolduraComum.test.jsx`

**Interfaces:**
- Produces: `useMolduraComum() -> { carregado: boolean, resumo, receitaDia: [], mes: [], porPagar: [], semana: [], avaliacao: number|null }` — pedidos em paralelo: `getResumo(inicio, fim)`, `getReceita(inicio, TODAY, 'day')`, `listReservations(estadiaNoMes())`, `listReservations({ payment_status: 'pending,partial' })`, `listReservations(estadiaProximosDias(7))`, `/reviews/stats` (media so com `total > 0`). Cada falha -> vazio/null. `porPagar` ja filtrado com `unpaidReservations(…, TODAY)`.

- [ ] **Step 1: Write the failing tests:** `carrega_os_seis_pedidos_em_paralelo` (todos chamados antes de qualquer resolver: mocks pendentes, contar chamadas); `cada_falha_cai_para_vazio` (todos a rejeitar -> `carregado` true, listas `[]`, `resumo`/`avaliacao` null); `avaliacao_so_com_total`; `por_pagar_filtrado` (reserva futura fica de fora).
- [ ] **Step 2: Run** `npx vitest run src/__tests__/useMolduraComum.test.jsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: hook com os dados comuns da moldura do dashboard`

---

### Task 4: Hotel com a moldura

**Files:**
- Modify: `frontend/src/pages/dashboard/HotelDashboard.jsx`
- Test: `frontend/src/__tests__/HotelDashboard.test.jsx`

**Interfaces:** Consumes Tasks 1–3 e os componentes da Etapa 1 (`HeroCard`, `StatTiles`, `DayAgenda`, `Shortcuts`, `NextDaysStrip`), `useAgora`, `serieReceitaAcumulada`, `variacaoPercentual`, `valorMedio`, `porReceber`, `localeDe`.

Montagem: `HeroCard` (receita/variacao/serie do hook; `ocupacao` = calculo atual `kpis.ocupacao`; `volume` = `hero.roomsOccupied`; `rotuloOcupacao` = `hero.occupancyToday` (Task 2); `hojeValor` = `hero.arrivals`; `hojeDetalhe` = `hero.departures` com partidas e pendentes de hoje); `StatTiles`: Reservas pendentes (qualquer mes, como hoje: `dashboard.hotel.pendingReservations`), Avaliacao, Valor medio, Por receber; grelha `DayAgenda` (`eventosHotel`, `resumo` = `agenda.summaryHotel`, vazio = `EmptyState` com `agenda.empty`, `onAbrir` -> `/calendario`) + coluna (`AttentionPanel` com os itens atuais, `Shortcuts`, `NextDaysStrip` com contagem de chegadas por dia de `semana`); por baixo, a seccao do mapa de quartos atual (com o detalhe do quarto). Sai a fila de 5 `KpiCard` e as listas de check-ins/check-outs.

- [ ] **Step 1: Update the tests first:** acrescentar `getReceita` ao mock de `financeiroService` e as respostas aos pedidos novos (mes, por pagar, semana, `/reviews/stats`) nos helpers do teste. Substituir `mantem os cinco indicadores e os blocos de check-in e check-out` por `agenda_com_partida_as_11_e_chegada_as_14_e_cartao_de_destaque` (texto "11:00", "14:00", "Partida · …", "Chegada · …", "Ocupação hoje", "Reservas pendentes"); ajustar `estadia a meio, check-out e check-in de hoje...` para verificar agenda + mapa + contadores do cartao; manter os testes de "Requer atencao", mapa, pendentes de qualquer mes, ocupacao com check-in ultrapassado, reserva duplicada, falhas; acrescentar `molduras_sem_resumo_nao_rebentam` e `clicar_num_evento_abre_o_calendario`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/HotelDashboard.test.jsx` — Expected: FAIL nos testes novos.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/__tests__/HotelDashboard.test.jsx src/__tests__/dashboard.smoke.test.jsx` — Expected: PASS (o smoke procura `'Check-outs hoje'`: trocar `TEXTO_HOTEL` por `'Mapa de Quartos — Hoje'` ou o titulo atual do mapa).
- [ ] **Step 5: Commit** `feat: vista Hoje do hotel com cartao de destaque e agenda de chegadas e partidas`

---

### Task 5: Rent-a-car com a moldura

**Files:** Modify `frontend/src/pages/dashboard/RentacarDashboard.jsx`; Test `frontend/src/__tests__/RentacarDashboard.test.jsx` (+ `TEXTO_RENTACAR` no smoke).

Montagem igual a Task 4 com: anel = alugados / viaturas ativas (calculo atual), `volume` = `hero.vehiclesRented`; `hojeValor` = `hero.pickups`, `hojeDetalhe` = `hero.returns`; tiles: Viaturas disponiveis (`dashboard.rentacar.availableVehicles`), Avaliacao, Valor medio, Por receber; agenda `eventosRentacar`, `resumo` = `agenda.summaryRentacar`; 7 dias contam levantamentos; por baixo a frota atual (com o detalhe e o atalho "Manutencao"). "Requer atencao" com os alertas de documentos atuais.

- [ ] **Step 1: Update the tests first** (mesma abordagem da Task 4): `agenda_com_levantamento_com_hora_e_devolucao_sem_hora`, `cartao_mostra_viaturas_alugadas_e_ocupacao_hoje`; manter os de documentos/revisoes, frota, aluguer ultrapassado, duplicados, falhas; `molduras_sem_resumo_nao_rebentam`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/RentacarDashboard.test.jsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** com o smoke — Expected: PASS.
- [ ] **Step 5: Commit** `feat: vista Hoje do rent-a-car com cartao de destaque e agenda de levantamentos e devolucoes`

---

### Task 6: Restaurante com a moldura

**Files:** Modify `frontend/src/pages/dashboard/RestaurantDashboard.jsx`; Test `frontend/src/__tests__/RestaurantDashboard.test.jsx` (+ `TEXTO_RESTAURANT` no smoke).

Montagem: pedido extra `listOrders().catch(() => [])` (`services/ordersService`); anel = mesas com reserva ativa hoje / mesas ativas (sem pratos/menus), `volume` = `hero.tablesTaken`; `hojeValor` = `hero.peopleToday` (soma de pessoas), `hojeDetalhe` = `hero.peopleTables`; tiles: Reservas no mes, Avaliacao, Valor medio, Por receber; agenda `eventosRestaurante` com `resumo` = `agenda.summaryRestaurant`; 7 dias contam reservas; por baixo o mapa de mesas atual (com o detalhe). "Requer atencao" atual. Os 3 blocos de turnos saem (a agenda ordena por hora).

- [ ] **Step 1: Update the tests first:** `agenda_por_hora_com_mesa_e_pre_pedido`, `cartao_mostra_mesas_ocupadas_e_pessoas_de_hoje`; manter mapa e detalhe da mesa, atencao, avaliacao, falhas, "nao repete as acoes do cabecalho"; substituir `mantem os indicadores e as reservas por turno`; `molduras_sem_resumo_nao_rebentam`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/RestaurantDashboard.test.jsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run` (suite completa) e `npm run build` — Expected: PASS e build OK.
- [ ] **Step 5: Commit** `feat: vista Hoje do restaurante com cartao de destaque e agenda de mesas`

---

### Task 7: Verificacao no browser

- [ ] API falsa na scratchpad com `TYPE=hotel|rentacar|restaurant` (quartos/viaturas/mesas, reservas de hoje com e sem hora, uma partida e uma chegada no mesmo quarto, um pre-pedido), sessao falsa em `localStorage['saldesk-auth']`.
- [ ] Para cada tipo, a 1280 px e a 375 px: cartao, numeros, agenda, coluna da direita e mapa por baixo; sem scroll horizontal; consola sem erros alem do socket.
- [ ] Atividades e "Resumo" iguais a Etapa 1.
- [ ] Apagar API falsa, sessao falsa e tamanho do ecra.

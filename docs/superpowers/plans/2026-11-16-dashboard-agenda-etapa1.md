# Dashboard do operador, Etapa 1 (moldura + agenda de atividades) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a vista "Hoje" do dashboard de atividades pela moldura nova (cartao de destaque, 4 numeros com icone, agenda do dia, coluna da direita) e dar a todos os tipos o cabecalho novo.

**Architecture:** Logica pura nova em `pages/dashboard/agendaLogic.js` (eventos, estados, series, metricas), testada sem React. Componentes de apresentacao novos e independentes do tipo de operador em `components/dashboard/*`. `ActivityDashboard.jsx` passa a montar a moldura com esses componentes; os outros tipos ficam como estao.

**Tech Stack:** React 18, Vite, Tailwind (tokens ocean/sand/neutros e `--success/--warning/--error`), vitest + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-16-dashboard-operador-agenda-design.md` (maqueta: `.superpowers/brainstorm/6621-1794869755/content/dashboard-c-com-agenda.html`)

## Global Constraints

- So frontend. Sem alteracoes de base de dados nem de backend.
- `components/ui/*` nao muda.
- Sem cores hexadecimais nem cores nomeadas do Tailwind (`text-green-*`, `bg-amber-*`, ...) nos ficheiros novos; usar tokens (`ocean-*`, `sand-*`, `n-*`, `[var(--success)]`, `[var(--warning)]`, `[var(--error)]`).
- Sem bibliotecas novas (grafico e anel em SVG/CSS a mao).
- Textos novos em i18n nos 4 idiomas (pt, en, de, nl), chaves sob `dashboard.*`.
- Numeros com `tabular-nums`; titulos e numeros grandes em `font-display` (Sora), resto `font-body`.
- Hora e data: hora local do dispositivo (como o `TODAY` de `pages/dashboard/shared.jsx`).
- Pedidos novos em paralelo com os atuais; cada falha cai para vazio sem apagar o resto.
- Hotel, rent-a-car, restaurante e generico mantem a vista "Hoje" atual; `ResumoView` nao muda.
- TDD: cada passo de codigo e precedido por um teste que falhou.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Tour com reservas mas sem hora em lado nenhum (nem `start_time` na reserva nem na ficha) -> aparece em "Sem hora marcada", nunca desaparece. (Task 1, teste `sem_hora_vai_para_o_grupo_sem_hora`)
2. `start_time` vindo da base de dados como `"14:00:00"` e da ficha como `"14:00"` -> sao o mesmo horario (um so evento). (Task 1, teste `hora_com_segundos_e_a_mesma_hora`)
3. Reservas canceladas ou `checked_out`/`no_show` de hoje -> nao entram na agenda nem nas pessoas de hoje (so `pending`, `confirmed`, `checked_in`, como hoje). (Task 1, teste `so_estados_ativos_entram`)
4. Evento que atravessa a meia-noite ou dura mais do que o dia (fim > 24:00) -> continua "a decorrer" ate ao fim do dia, sem rebentar. (Task 1, teste `fim_depois_da_meia_noite`)
5. Mes sem receita / mes anterior a 0 -> grafico plano a zeros e sem pilula de variacao (nunca "Infinity%" nem "NaN"). (Task 2 e Task 4, testes `serie_sem_dados_da_zeros` e `sem_mes_anterior_sem_pilula`)

---

## File Structure

| Ficheiro | Responsabilidade |
|---|---|
| `frontend/src/pages/dashboard/agendaLogic.js` (novo) | Funcoes puras: eventos de atividades, estado do evento, ordenacao, serie acumulada, metricas, saudacao. |
| `frontend/src/hooks/useAgora.js` (novo) | Hora atual (Date), atualizada a cada 60 s. |
| `frontend/src/components/dashboard/DayAgenda.jsx` (novo) | Linha do tempo de eventos normalizados. |
| `frontend/src/components/dashboard/HeroCard.jsx` (novo) | Cartao em gradiente: receita + grafico, anel de ocupacao, "Hoje". |
| `frontend/src/components/dashboard/StatTiles.jsx` (novo) | Grelha de numeros com icone. |
| `frontend/src/components/dashboard/Shortcuts.jsx` (novo) | Quatro atalhos. |
| `frontend/src/components/dashboard/NextDaysStrip.jsx` (novo) | Faixa dos proximos 7 dias (extraida de `ActivityDashboard.jsx`). |
| `frontend/src/components/dashboard/DashboardHeader.jsx` | Sem mudanca de props; recebe o novo subtitulo. |
| `frontend/src/pages/Dashboard.jsx` | Saudacao por hora + subtitulo "data por extenso · HH:MM" para todos os tipos. |
| `frontend/src/pages/dashboard/ActivityDashboard.jsx` | Monta a moldura nova. |
| `frontend/src/i18n/{pt,en,de,nl}.json` | Chaves novas. |
| Testes: `__tests__/agendaLogic.test.js` (novo), `__tests__/dashboardMoldura.test.jsx` (novo), `__tests__/ActivityDashboard.test.jsx`, `__tests__/i18nDashboard.test.js`, `__tests__/dashboard.smoke.test.jsx` (se depender do subtitulo antigo) |

### Tipo partilhado `Evento` (produzido pela Task 1, consumido pelas Tasks 3 e 5)

```js
/** @typedef {{
 *   id: string,                // `${unit_id}|${HH:MM ou 'sem-hora'}`
 *   inicio: string|null,       // 'HH:MM'
 *   inicioMin: number|null,    // minutos desde 00:00
 *   fimMin: number|null,       // inicioMin + duracao
 *   titulo: string,            // nome do tour
 *   local: string,             // meta.meeting_point ou ''
 *   pessoas: number,           // soma de guests (minimo 1 por reserva)
 *   capacidade: number|null,   // capacidade do horario, senao do tour; null se nenhuma
 *   pendentes: number,         // reservas com status 'pending'
 *   guias: string[],           // nomes distintos, pela ordem das reservas
 *   clientes: string[],        // customer_name das reservas, pela ordem
 * }} Evento */
```

---

### Task 1: Logica da agenda de atividades

**Files:**
- Create: `frontend/src/pages/dashboard/agendaLogic.js`
- Test: `frontend/src/__tests__/agendaLogic.test.js`

**Interfaces:**
- Produces:
  - `paraMinutos(hora: string|null|undefined) -> number|null` ("14:00" e "14:00:00" -> 840; invalido -> null)
  - `eventosAtividades({ reservas, tours, atribuicoes }) -> Evento[]` — `reservas`: reservas de hoje; `tours`: unidades; `atribuicoes`: resposta de `listAssignments()` (`{ reservation_id, status, staff: { name } }`).
  - `estadoDoEvento(evento: Evento, agoraMin: number) -> 'sem_hora'|'concluido'|'a_decorrer'|'a_seguir'`
  - `ordenarAgenda(eventos: Evento[]) -> { semHora: Evento[], comHora: Evento[] }`
  - constante `DURACAO_POR_OMISSAO_MIN = 60`

Regras (do spec, secao 5 e 4):
- So reservas com `status` em `['pending','confirmed','checked_in']`.
- Agrupar por `(unit_id, horario)`; horario = `paraMinutos(r.start_time)` se existir, senao `paraMinutos(meta.start_time)` da ficha (`description` em JSON; JSON invalido = sem meta), senao sem hora.
- Capacidade: `meta.time_slots` com `time` igual ao horario (comparar por `paraMinutos`) e `capacity` numerica > 0 -> essa; senao `tour.capacity` > 0; senao `null`.
- Duracao: `Number(meta.duration) * 60` se > 0, senao `DURACAO_POR_OMISSAO_MIN`. Sem hora -> `inicioMin` e `fimMin` null.
- Reserva cujo `unit_id` nao corresponde a nenhum tour: ignorada.
- Guias: atribuicoes com `reservation_id` de uma reserva do evento e `status !== 'cancelled'`, `staff.name` distintos.
- `estadoDoEvento`: sem hora -> `'sem_hora'`; `agoraMin >= fimMin` -> `'concluido'`; `agoraMin >= inicioMin` -> `'a_decorrer'`; senao `'a_seguir'`. `fimMin` acima de 1440 vale 1440.
- `ordenarAgenda`: `comHora` por `inicioMin`, empate por `titulo` (localeCompare); `semHora` por `titulo`.

- [ ] **Step 1: Write the failing tests** em `agendaLogic.test.js`:

```js
const TOUR = { id: 't1', name: 'Buggy', capacity: 16, description: JSON.stringify({ start_time: '09:00', duration: 2, meeting_point: 'Santa Maria' }) };
const SLOTS = { id: 't2', name: 'Mergulho', capacity: 20, description: JSON.stringify({ duration: 1.5, time_slots: [{ time: '09:00', capacity: 8 }, { time: '15:00', capacity: '6' }] }) };
const SEM = { id: 't3', name: 'Kite', capacity: 6, description: null };
const r = (o) => ({ id: 'r' + Math.random(), unit_id: 't1', status: 'confirmed', guests: 2, customer_name: 'Ana Silva', start_time: null, ...o });

it('paraMinutos aceita HH:MM e HH:MM:SS e recusa lixo', () => {
  expect(paraMinutos('14:00')).toBe(840);
  expect(paraMinutos('14:00:00')).toBe(840);
  [null, undefined, '', 'abc', '25:99'].forEach(v => expect(paraMinutos(v)).toBeNull());
});
it('agrupa_por_tour_e_usa_a_hora_e_a_duracao_da_ficha', () => {
  const [e] = eventosAtividades({ reservas: [r({}), r({ guests: 3, status: 'pending' })], tours: [TOUR], atribuicoes: [] });
  expect(e).toMatchObject({ id: 't1|09:00', inicio: '09:00', inicioMin: 540, fimMin: 660, titulo: 'Buggy', local: 'Santa Maria', pessoas: 5, capacidade: 16, pendentes: 1 });
});
it('tour_com_horarios_da_um_evento_por_horario_com_a_capacidade_do_horario', () => {
  const ev = eventosAtividades({ reservas: [r({ unit_id: 't2', start_time: '09:00:00' }), r({ unit_id: 't2', start_time: '15:00:00' })], tours: [SLOTS], atribuicoes: [] });
  expect(ev.map(e => [e.inicio, e.capacidade, e.fimMin - e.inicioMin])).toEqual([['09:00', 8, 90], ['15:00', 6, 90]]);
});
it('hora_com_segundos_e_a_mesma_hora', () => {
  const ev = eventosAtividades({ reservas: [r({ start_time: '09:00:00' }), r({ start_time: null })], tours: [TOUR], atribuicoes: [] });
  expect(ev).toHaveLength(1);
});
it('sem_hora_vai_para_o_grupo_sem_hora', () => {
  const ev = eventosAtividades({ reservas: [r({ unit_id: 't3' })], tours: [SEM], atribuicoes: [] });
  expect(ev[0]).toMatchObject({ inicio: null, inicioMin: null, fimMin: null, capacidade: 6 });
  expect(ordenarAgenda(ev).semHora).toHaveLength(1);
  expect(estadoDoEvento(ev[0], 600)).toBe('sem_hora');
});
it('so_estados_ativos_entram', () => {
  const ev = eventosAtividades({ reservas: ['cancelled', 'checked_out', 'no_show'].map(s => r({ status: s })), tours: [TOUR], atribuicoes: [] });
  expect(ev).toEqual([]);
});
it('guias_distintos_e_sem_atribuicoes_canceladas', () => {
  const a = r({ id: 'ra' }); const b = r({ id: 'rb' });
  const atr = [{ reservation_id: 'ra', status: 'confirmed', staff: { name: 'Djo' } }, { reservation_id: 'rb', status: 'confirmed', staff: { name: 'Djo' } }, { reservation_id: 'rb', status: 'cancelled', staff: { name: 'Kiko' } }];
  expect(eventosAtividades({ reservas: [a, b], tours: [TOUR], atribuicoes: atr })[0].guias).toEqual(['Djo']);
});
it('estado_pela_hora', () => {
  const [e] = eventosAtividades({ reservas: [r({})], tours: [TOUR], atribuicoes: [] }); // 09:00-11:00
  expect([estadoDoEvento(e, 500), estadoDoEvento(e, 540), estadoDoEvento(e, 659), estadoDoEvento(e, 660)]).toEqual(['a_seguir', 'a_decorrer', 'a_decorrer', 'concluido']);
});
it('sem_duracao_conta_60_minutos', () => {
  const t = { ...TOUR, description: JSON.stringify({ start_time: '10:00' }) };
  expect(eventosAtividades({ reservas: [r({})], tours: [t], atribuicoes: [] })[0].fimMin).toBe(660);
});
it('fim_depois_da_meia_noite', () => {
  const t = { ...TOUR, description: JSON.stringify({ start_time: '23:00', duration: 3 }) };
  const [e] = eventosAtividades({ reservas: [r({})], tours: [t], atribuicoes: [] });
  expect(estadoDoEvento(e, 1439)).toBe('a_decorrer');
});
it('ordena_por_hora_e_depois_por_nome', () => {
  const t4 = { ...TOUR, id: 't4', name: 'Alfa' };
  const ev = eventosAtividades({ reservas: [r({}), r({ unit_id: 't4' }), r({ unit_id: 't2', start_time: '15:00' })], tours: [TOUR, t4, SLOTS], atribuicoes: [] });
  expect(ordenarAgenda(ev).comHora.map(e => e.titulo)).toEqual(['Alfa', 'Buggy', 'Mergulho']);
});
it('reserva_de_tour_desconhecido_e_ficha_com_json_invalido_nao_rebentam', () => {
  const t = { ...SEM, description: '{nao e json' };
  expect(eventosAtividades({ reservas: [r({ unit_id: 'x' }), r({ unit_id: 't3' })], tours: [t], atribuicoes: undefined })).toHaveLength(1);
});
```

- [ ] **Step 2: Run** `cd frontend && npx vitest run src/__tests__/agendaLogic.test.js` — Expected: FAIL (modulo `agendaLogic` nao existe).
- [ ] **Step 3: Implement** as funcoes acima em `agendaLogic.js` (sem React, sem imports de servicos).
- [ ] **Step 4: Run** o mesmo comando — Expected: PASS (12 testes).
- [ ] **Step 5: Commit** `feat: logica da agenda do dia (eventos de atividades, estados, ordenacao)`

---

### Task 2: Metricas, serie da receita e saudacao

**Files:**
- Modify: `frontend/src/pages/dashboard/agendaLogic.js`
- Create: `frontend/src/hooks/useAgora.js`
- Test: `frontend/src/__tests__/agendaLogic.test.js`

**Interfaces:**
- Produces:
  - `serieReceitaAcumulada(serie: {periodo:string, receita:number}[], inicioMes: 'YYYY-MM-DD', hoje: 'YYYY-MM-DD') -> number[]` — um valor por dia de `inicioMes` a `hoje` (inclusive), acumulado; dias sem entrada somam 0; entradas fora do intervalo ignoradas.
  - `variacaoPercentual(atual: number, anterior: number) -> number|null` — `null` se `anterior` <= 0 ou algum nao finito; senao arredondado as unidades.
  - `valorMedio(receita: number, numReservas: number) -> number|null` — `null` se `numReservas` <= 0.
  - `porReceber(reservas) -> number` — soma de `max(0, total_price - amount_paid)` (campos em falta = 0).
  - `saudacao(hora: number) -> 'morning'|'afternoon'|'evening'` — 5–11 morning, 12–18 afternoon, resto evening.
  - `useAgora(): Date` em `hooks/useAgora.js` — `new Date()` no inicio e a cada 60 000 ms (`setInterval`, limpo ao desmontar).

- [ ] **Step 1: Write the failing tests:**

```js
it('serie_acumulada_por_dia', () => {
  expect(serieReceitaAcumulada([{ periodo: '2026-11-02', receita: 100 }, { periodo: '2026-11-04', receita: 50 }, { periodo: '2026-10-31', receita: 999 }], '2026-11-01', '2026-11-05'))
    .toEqual([0, 100, 100, 150, 150]);
});
it('serie_sem_dados_da_zeros', () => {
  expect(serieReceitaAcumulada(undefined, '2026-11-01', '2026-11-03')).toEqual([0, 0, 0]);
});
it('variacao_percentual', () => {
  expect(variacaoPercentual(1120, 1000)).toBe(12);
  expect(variacaoPercentual(500, 0)).toBeNull();
  expect(variacaoPercentual(NaN, 10)).toBeNull();
});
it('valor_medio_e_por_receber', () => {
  expect(valorMedio(920, 20)).toBe(46);
  expect(valorMedio(920, 0)).toBeNull();
  expect(porReceber([{ total_price: 200, amount_paid: 20 }, { total_price: 50 }, { total_price: 10, amount_paid: 30 }])).toBe(230);
});
it('saudacao_pela_hora', () => {
  expect([4, 5, 11, 12, 18, 19].map(saudacao)).toEqual(['evening', 'morning', 'morning', 'afternoon', 'afternoon', 'evening']);
});
```
Mais um teste de `useAgora` com `vi.useFakeTimers()` + `vi.setSystemTime`: render de um componente que mostra `useAgora().getMinutes()`; avancar 60 s muda o valor; desmontar limpa o intervalo (`vi.getTimerCount()` volta a 0).

- [ ] **Step 2: Run** `npx vitest run src/__tests__/agendaLogic.test.js` — Expected: FAIL (funcoes nao exportadas).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: metricas do dashboard (serie acumulada, variacao, valor medio, por receber) e useAgora`

---

### Task 3: Componentes da moldura

**Files:**
- Create: `frontend/src/components/dashboard/{DayAgenda,HeroCard,StatTiles,Shortcuts,NextDaysStrip}.jsx`
- Modify: `frontend/src/i18n/{pt,en,de,nl}.json`, `frontend/src/__tests__/i18nDashboard.test.js`
- Test: `frontend/src/__tests__/dashboardMoldura.test.jsx`

**Interfaces:**
- Consumes: `Evento`, `estadoDoEvento`, `ordenarAgenda` (Task 1).
- Produces:
  - `<DayAgenda eventos={Evento[]} agoraMin={number} onAbrir={(Evento) => void} vazio={ReactNode} />`
  - `<HeroCard receita={number} variacao={number|null} serie={number[]} ocupacao={number} volume={string} hojeValor={string} hojeDetalhe={string} mesNome={string} />`
  - `<StatTiles tiles={{ id, icon: LucideIcon, label: string, value: string, tone: 'ocean'|'sand'|'success'|'warning' }[]} />`
  - `<Shortcuts />` (navega com `useNavigate`)
  - `<NextDaysStrip dias={string[]} contagens={Record<string,number>} hoje={string} lang={string} onAbrir={() => void} />`

Chaves i18n novas (pt / en; de e nl traduzidos pelo implementador):
- `dashboard.greeting.morning` "Bom dia, {{name}}" / "Good morning, {{name}}"; `.afternoon` "Boa tarde, {{name}}" / "Good afternoon, {{name}}"; `.evening` "Boa noite, {{name}}" / "Good evening, {{name}}"
- `dashboard.agenda.title` "Agenda de hoje" / "Today's schedule"; `.summary` "{{tours}} tours · {{people}} pessoas" / "{{tours}} tours · {{people}} people"; `.noTime` "Sem hora marcada" / "No time set"; `.done` "Concluído" / "Done"; `.now` "A decorrer, termina às {{time}}" / "In progress, ends at {{time}}"; `.toConfirm` "{{n}} por confirmar" / "{{n}} to confirm"; `.nearlyFull` "Quase cheio" / "Nearly full"; `.guide` "guia {{name}}" / "guide {{name}}"
- `dashboard.hero.revenue` "Receita de {{month}}" / "{{month}} revenue"; `.vsPrev` "{{pct}}% vs mês anterior" / "{{pct}}% vs last month"; `.occupancy` "Ocupação do mês" / "Monthly occupancy"; `.today` "Hoje" / "Today"; `.peopleToday` "{{n}} pessoas" / "{{n}} people"; `.inTours` "em {{n}} tours · {{p}} por confirmar" / "in {{n}} tours · {{p}} to confirm"; `.participants` "{{n}} participantes" / "{{n}} participants"
- `dashboard.tiles.reservations` "Reservas no mês" / "Bookings this month"; `.rating` "Avaliação média" / "Average rating"; `.avgValue` "Valor médio por reserva" / "Average booking value"; `.toReceive` "Por receber" / "To receive"
- `dashboard.shortcuts.title` "Atalhos" / "Shortcuts"; `.checkin` "Check-in"; `.blockDay` "Bloquear dia" / "Block a day"; `.message` "Enviar mensagem" / "Send message"; `.payment` "Registar pagamento" / "Record payment"

Regras de apresentacao:
- `DayAgenda`: grupo "Sem hora marcada" no topo (so se houver); depois `comHora`. Cada evento e um `<button>` (nome acessivel = titulo) que chama `onAbrir`. Linha secundaria: `pessoas/capacidade` (ou so `pessoas` sem capacidade), `guia <primeiro>` (+N se houver mais), `local`, separados por " · ", partes vazias omitidas. Barra de lotacao (`role="progressbar"`, `aria-valuenow` = % limitado a 100) so com capacidade; >= 80% usa tom sand. Pilula: `concluido` -> "Concluído"; senao `pendentes > 0` -> "N por confirmar"; senao >= 80% -> "Quase cheio". `a_decorrer`: atributo `data-estado="a_decorrer"`, contorno ocean, linha "A decorrer, termina às HH:MM" (fim limitado a 23:59), iniciais (primeira letra do primeiro e do ultimo nome, maiusculas) dos primeiros 3 clientes + "+N". `concluido`: `data-estado="concluido"` e opacidade reduzida. Sem eventos: mostra `vazio`.
- `HeroCard`: gradiente `from-ocean-800 to-ocean-600`, texto branco; receita `€` + `toLocaleString('pt-PT')` arredondada; pilula so se `variacao !== null` (sinal "+" se > 0); grafico SVG de area com a `serie` (todas a zero -> linha plana; 1 ponto -> linha plana); anel com `conic-gradient` (ocupacao 0–100, limitada); tres zonas empilhadas abaixo de `md`.
- `StatTiles`: 4 colunas em `lg`, 2 abaixo.
- `Shortcuts`: Check-in -> `/reservas`; Bloquear dia -> `/calendario`; Enviar mensagem -> `/mensagens`; Registar pagamento -> `/financeiro`.
- `NextDaysStrip`: o mesmo comportamento e aspeto da faixa atual de `ActivityDashboard.jsx` (contagem so quando > 0, hoje destacado), em layout compacto.

- [ ] **Step 1: Write the failing tests** em `dashboardMoldura.test.jsx` (MemoryRouter + `useNavigate` simulado, `lang='pt'`):
  - `agenda_mostra_sem_hora_no_topo_e_os_eventos_por_hora` — eventos [sem hora "Kite", 14:00 "Mergulho", 09:00 "Buggy"] -> textos por ordem: "Sem hora marcada", "Kite", "Buggy", "Mergulho".
  - `evento_a_decorrer_tem_estado_iniciais_e_hora_de_fim` — Buggy 540–660, `agoraMin=600`, clientes ['Ana Silva','Joao Lima','Maria Sousa','Rui Costa'] -> botao "Buggy" com `data-estado="a_decorrer"`, texto "A decorrer, termina às 11:00", "AS", "JL", "MS", "+1".
  - `evento_concluido_e_esbatido` — `agoraMin=700` -> `data-estado="concluido"` e "Concluído".
  - `pilulas_por_confirmar_e_quase_cheio` — pendentes 2 -> "2 por confirmar"; 18/20 sem pendentes -> "Quase cheio" e barra com `aria-valuenow="90"`.
  - `linha_secundaria_omite_partes_vazias` — sem capacidade, sem guia, sem local, pessoas 3 -> linha exatamente "3".
  - `clicar_num_evento_chama_onAbrir` e `agenda_vazia_mostra_o_conteudo_vazio`.
  - `hero_formata_receita_e_variacao` — receita 8420, variacao 12 -> "€8 420" (espaco fino do pt-PT: comparar com `(8420).toLocaleString('pt-PT')`) e "+12% vs mês anterior"; `sem_mes_anterior_sem_pilula` — variacao null -> sem "vs mês anterior".
  - `anel_limita_a_ocupacao` — ocupacao 140 -> texto "100%".
  - `atalhos_levam_aos_ecras` — os quatro botoes navegam para `/reservas`, `/calendario`, `/mensagens`, `/financeiro`.
  - `sem_cores_hexadecimais_ou_nomeadas` — `container.innerHTML` de cada componente nao casa `/#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/` nem `/(?:text|bg|border|fill|ring|from|to)-(?:green|yellow|blue|red|amber)-\d/`.
  - Em `i18nDashboard.test.js`: acrescentar `'greeting','agenda','hero','tiles','shortcuts'` a `NAMESPACES` (o teste de paridade existente passa a cobri-los).
- [ ] **Step 2: Run** `npx vitest run src/__tests__/dashboardMoldura.test.jsx src/__tests__/i18nDashboard.test.js` — Expected: FAIL (componentes e chaves em falta).
- [ ] **Step 3: Implement** os cinco componentes e as chaves nos 4 idiomas.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: componentes da moldura nova do dashboard (agenda, cartao de destaque, numeros, atalhos, 7 dias)`

---

### Task 4: Cabecalho novo (todos os tipos)

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`
- Test: `frontend/src/__tests__/dashboardMoldura.test.jsx` (ou o teste existente do Dashboard que renderiza `Dashboard.jsx`; verificar `dashboard.smoke.test.jsx` e `dashboardUi.test.jsx`)

**Interfaces:**
- Consumes: `saudacao` (Task 2), `useAgora` (Task 2), chaves `dashboard.greeting.*` (Task 3).

Titulo: `t('dashboard.greeting.<saudacao(agora.getHours())>', { name })`. Subtitulo: `agora.toLocaleDateString(<locale>, { weekday: 'long', day: 'numeric', month: 'long' })` com a primeira letra maiuscula + " · " + `HH:MM` (dois digitos). Locale: pt -> 'pt-PT', en -> 'en-GB', de -> 'de-DE', nl -> 'nl-NL'. Igual para todos os tipos e para as duas vistas.

- [ ] **Step 1: Write the failing tests** (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(new Date(2026, 10, 20, 11, 42))`, os servicos simulados como em `ActivityDashboard.test.jsx`):
  - `cabecalho_saudacao_e_data_com_hora` — operador `{ name: 'Zy Tours', operator_type: 'hotel' }` -> heading "Bom dia, Zy Tours" e texto "Sexta-feira, 20 de novembro · 11:42" (construir o esperado com o mesmo `toLocaleDateString('pt-PT', ...)` para nao depender da versao do ICU).
  - `boa_tarde_as_15h` — 15:05 -> "Boa tarde, Zy Tours".
  - `em_ingles` — `lang='en'` -> "Good morning, Zy Tours".
  - Atualizar testes que esperavam o subtitulo antigo "tipo · AAAA-MM" (procurar `typeLabel` nos testes).
- [ ] **Step 2: Run** `npx vitest run src/__tests__/dashboardMoldura.test.jsx` — Expected: FAIL.
- [ ] **Step 3: Implement** em `Dashboard.jsx`.
- [ ] **Step 4: Run** `npx vitest run` (suite completa) — Expected: PASS.
- [ ] **Step 5: Commit** `feat: cabecalho do dashboard com saudacao pela hora, data e hora atual`

---

### Task 5: ActivityDashboard com a moldura nova

**Files:**
- Modify: `frontend/src/pages/dashboard/ActivityDashboard.jsx`
- Test: `frontend/src/__tests__/ActivityDashboard.test.jsx`, `frontend/src/__tests__/ActivityDashboard.firstOfMonth.test.jsx`

**Interfaces:**
- Consumes: Tasks 1–3 (`eventosAtividades`, `serieReceitaAcumulada`, `variacaoPercentual`, `valorMedio`, `porReceber`, `useAgora`, todos os componentes); servicos `getReceita` (`financeiroService`) e `listAssignments` (`assignmentService`).

Pedidos: acrescentar ao `Promise.all` atual `getReceita(periodo.inicio, TODAY, 'day').catch(() => [])` e `listAssignments().catch(() => [])`. Manter os restantes pedidos e o cruzamento com a meteorologia.

Montagem (ordem do spec, secao 3):
- `HeroCard`: `receita` = `resumo.atual.receita` (0 sem resumo); `variacao` = `variacaoPercentual(atual.receita, anterior.receita)`; `serie` = `serieReceitaAcumulada(receitaDia, periodo.inicio, TODAY)`; `ocupacao` = `kpis.ocupacao` (calculo atual); `volume` = `hero.participants` com `kpis.participantes`; `hojeValor` = `hero.peopleToday` com a soma das pessoas dos eventos; `hojeDetalhe` = `hero.inTours` com n.º de eventos e soma de `pendentes`; `mesNome` = nome do mes no locale.
- `StatTiles` (4): Reservas no mes = reservas do mes com status nao `cancelled` (icone `BookOpen`, tom ocean); Avaliacao media (calculo atual, `Star`, sand); Valor medio = `valorMedio(receita, n.º de reservas confirmadas/checked_in/checked_out do mes)` formatado em € ou "—" (`Euro`, success); Por receber = `porReceber(unpaidReservations(unpaidRes, TODAY))` em € (`AlertTriangle`, warning).
- Grelha `lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]`: esquerda `DayAgenda` (eventos de `eventosAtividades({ reservas: todayRes, tours, atribuicoes })`, `agoraMin` de `useAgora()`, `onAbrir` -> `navigate('/calendario')`, `vazio` = o `EmptyState` atual com "+ Nova reserva"); direita `AttentionPanel` (itens atuais, sem mudanca), `Shortcuts`, `NextDaysStrip`.
- Remover a tabela "Tours de hoje" e os 5 `KpiCard` desta vista.

- [ ] **Step 1: Update the tests first.** Em `ActivityDashboard.test.jsx` acrescentar mocks de `getReceita` (financeiroService) e `listAssignments` (`../services/assignmentService`), e:
  - substituir `mostra a tabela de tours de hoje` por `mostra_a_agenda_de_hoje_com_hora_guia_e_lotacao` (tour com `start_time` 09:00 na ficha, 2 reservas 5 pessoas, atribuicao com `staff.name: 'Djo'` -> botao com nome do tour, texto "5/10", "guia Djo", "09:00");
  - substituir `mostra os cinco indicadores...` por `mostra_o_cartao_de_destaque_e_os_quatro_numeros` (resumo atual 1120 / anterior 1000 -> "+12% vs mês anterior"; "Reservas no mês", "Avaliação média", "Valor médio por reserva", "Por receber" presentes);
  - substituir `sem mes anterior nao mostra variacao` por `sem_mes_anterior_sem_pilula`;
  - substituir `a barra de lotacao nunca passa dos 100%...` por `a_lotacao_da_agenda_nunca_passa_dos_100_nem_rebenta_sem_capacidade`;
  - `por_receber_soma_o_que_falta_pagar` (reserva iniciada `payment_status:'partial'`, total 200, pago 50 -> "€150" no numero "Por receber");
  - `falha_da_receita_por_dia_ou_das_atribuicoes_nao_apaga_o_resto` (os dois a rejeitar -> agenda e cartao continuam);
  - `clicar_num_evento_abre_o_calendario` (`navigateMock` com `/calendario`);
  - manter todos os testes de "Requer atencao", 7 dias, estados vazios e falhas, ajustando apenas seletores que dependiam da tabela.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/ActivityDashboard.test.jsx src/__tests__/ActivityDashboard.firstOfMonth.test.jsx` — Expected: FAIL nos testes novos/substituidos.
- [ ] **Step 3: Implement** a montagem em `ActivityDashboard.jsx` (o calculo de `kpis` atual mantem-se para ocupacao, participantes e avaliacao).
- [ ] **Step 4: Run** `npx vitest run` e `npm run build` — Expected: suite toda PASS, build OK.
- [ ] **Step 5: Commit** `feat: vista Hoje das atividades com cartao de destaque e agenda do dia`

---

### Task 6: Verificacao no browser

**Files:** nenhum de produto (API falsa na scratchpad, como nas verificacoes anteriores; apagar no fim).

- [ ] **Step 1:** Arrancar o frontend (`preview_start`) com a API simulada (operador de atividades com 4 tours, um com dois horarios, reservas de hoje, uma atribuicao de guia, receita por dia, um mes anterior). Sessao falsa em `localStorage['saldesk-auth']`.
- [ ] **Step 2:** Em 1280 px confirmar contra a maqueta: cabecalho, cartao de destaque, 4 numeros, agenda com um evento "a decorrer", coluna da direita. Expected: sem erros na consola.
- [ ] **Step 3:** Em 375 px: uma coluna, sem scroll horizontal (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 4:** Mudar para "Resumo" e para um operador hotel: Resumo igual ao de antes; hotel com o cabecalho novo e o resto como antes.
- [ ] **Step 5:** Screenshots para o dono; apagar a API falsa e a sessao falsa.

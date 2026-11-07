# Redesenho da app do operador, Fase 5b (Gestao: Financeiro) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar a pagina Financeiro para os componentes e o aspeto "azul da marca", **sem alterar nenhum comportamento**: os mesmos pedidos aos servicos com os mesmos argumentos, as mesmas contas e os mesmos textos.

**Architecture:** O mesmo metodo das Fases 3, 3b, 4 e 5a. A pagina (1528 linhas, onze sub-componentes) e primeiro protegida por testes que a renderizam por inteiro e **partida em ficheiros por mudanca literal** (a divisao da Fase 3); depois, area a area, escrevem-se testes de caracterizacao que passam **antes** de migrar, testes novos de design system que falham (RED), e so entao se trocam separadores, tabelas, campos e estados vazios pelos componentes `ui` e as cores em hexadecimal ou nomeadas por tokens. Os graficos (`recharts`) passam a usar `var(--token)` nos atributos de cor.

**Tech Stack:** React 18, Vite, Tailwind 3, recharts, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (seccoes 5.4 e 7, Fase 5; risco "paginas muito grandes: migrar por blocos"). Planos anteriores, de que este herda metodo e restricoes: `docs/superpowers/plans/2026-11-06-redesign-fase5a-gestao.md` e `docs/superpowers/plans/2026-11-04-redesign-fase3-operacao.md`. Caminhos relativos a `frontend/`; comandos dentro de `frontend/`. Seguinte: **5c** Colaboradores e detalhe.

**Estado atual medido (base deste plano):**
- `pages/Financial.jsx`: 1528 linhas, **fins de linha CRLF**. Cinco areas: **Receitas** (cinco sub-separadores: Visao Geral, Por Tour, Previsao, Caixa, Receitas Manuais), **Despesas**, **Salarios**, **Comissoes**, **Obrigacoes**, **Resultado** (seis separadores de topo; quatro atras de `PlanGuard plan="pro" feature="financeiro-completo"`, `Comissoes` livre).
- Onze sub-componentes na propria pagina: `CostEditModal`, `TransacoesTable`, `Comparativo`, `PorTourTab`, `PrevisaoTab`, `CaixaTab`, `ExpenseModal`+`DespesasTab`, `ReceitaManualModal`+`ReceitasManuaisTab`, `SalariosTab`+`SalaryForm`, `ComissoesTab`, `ObrigacoesTab`, `ResultadoTab`.
- Escritos a mao: sete tabelas, dois separadores de topo e de sub-nivel, tres grupos de botoes (periodo, granularidade, moeda), ~25 `<input>`/`<select>`/`<textarea>`, estados vazios soltos, ~40 cores em hexadecimal ou `yellow-*`/`red-*`/`green-*`/`blue-*` (`#1A7A4A`, `#ECFDF5`, `#B91C1C`, `#0D5470`, `#E5E8EC`, `#6B7280` e a paleta `CAT_COLORS` de 14 cores) e `text-error` (que no Tailwind e `#DC2626`, diferente do token `--error`).
- Componentes de grafico em `components/financial/`: `KpiCard` e `RevenueChart` sao **partilhados com os seis dashboards** (ja migrados); `ChannelChart`, `ServiceBarChart` e `TopCustomersList` so a Financeiro os usa. `MetricCard`, `PdfReport`, `SimpleChart`, `UnitTable` nao sao usados por esta pagina e ficam como estao.
- Servicos: `financeiroService` (`getResumo`, `getReceita`, `getUnidades`, `getTopClientes`, `getCanais`, `getTransacoes`, `getForecast`, `getReceitasManuais` e CRUD, `exportExcel`, `exportPdf`), `expensesService` (`listExpenses`, `addExpenseLocal`, `updateExpenseLocal`, `deleteExpenseLocal`, `getSalaryConfig`, `setSalaryConfig`, `getSalaryPayments`, `addSalaryPayment`, `getObligations`, `setObligations`), `sellerService` (`listSellerCommissions`, `markCommissionPaid`, `getSellerCommissionPct`), `staffService.listStaff`. Custos por tour em `localStorage` (`saldesk_tour_costs_v1`).
- **Nao ha testes.** Texto fixo em portugues (so `useT()` chamado sem uso).

**Decisoes de desenho (para o utilizador rever):**
1. **Mudanca visual, nao funcional.** Nada e acrescentado ou removido; `window.confirm` dos botoes de eliminar mantem-se (trocar por `ConfirmDialog` mudaria o comportamento).
2. **Divisao do ficheiro por mudanca literal** para `pages/financial/` (um ficheiro por sub-componente, mais `shared.jsx` com constantes e funcoes de apoio); `Financial.jsx` fica com a pagina, `SECTIONS`, `RECEITAS_TABS`, `PRESETS` e `GRANULARIDADES` (menos de 350 linhas). Os ficheiros novos herdam o fim de linha CRLF.
3. **Separadores:** os de topo e os de Receitas passam a `Tabs` (perdem os icones; nos separadores bloqueados pelo plano o rotulo e um no com o cadeado, que e informacao). Os grupos de periodo, granularidade e moeda passam a `FilterChips`; o interruptor de moeda flutuante das outras areas fica como esta (so tokens).
4. **Tabelas** passam a `Table` (com `compact` nas largas). Como o `Table` nao aceita classe por linha, o destaque "melhor/pior margem" da tabela Por Tour passa do fundo da linha para um fundo no nome do tour (`--success-light`/`--error-light`), com `data-destaque="melhor|pior"` para os testes. Botoes de editar/eliminar ganham `aria-label` (`Editar despesa`, `Eliminar despesa`, `Editar receita`, `Eliminar receita`, `Editar custos`).
5. **Cores:** hexadecimal e cores nomeadas passam a tokens (`--success`, `--warning`, `--error`, `--info` e `-light`, `--ocean-*`, `--sand-*`, `--n*`); `text-error` passa a `text-[var(--error)]`. Em SVG e `recharts` usa-se `var(--token)`. `CAT_COLORS` mapeia as 14 cores uma a uma para tokens; as tres sem equivalente de marca mudam: roxo `#7C3AED` -> `var(--sand-600)`, `#D97706` -> `var(--warning)`, `#9BA3AF` -> `var(--n400)`.
6. **Componentes partilhados com os dashboards:** `KpiCard` e `RevenueChart` so trocam cadeias por tokens **de valor identico** (`#1A7A4A`->`--success`, `#0D5470`->`--ocean-700`, `#E5E8EC`->`--n200`, `#6B7280`->`--n500`); `text-error` do `KpiCard` nao muda (alteraria os dashboards). `ChannelChart` e `ServiceBarChart` passam a tokens com os mesmos valores (a barra `#A8D8E8` fica `--ocean-200`, `#A8D9E8`).
7. **Campos:** `<input type="month">`, pesquisa, filtros e formularios dos modais passam a `Input`/`Select`/`Textarea`; o interruptor "Despesa recorrente mensal" passa a `Toggle`.
8. **Fora de ambito, registado (ja existentes, ficam como estao e os testes fixam):** (a) `sazonal` vem de `/financial/receita` como `{ periodo, receita }` mas a Visao Geral/Resultado le `date` e `value`/`total` para o grafico "Receitas vs Despesas" (a receita desse grafico e sempre zero em producao); (b) `listExpenses`, `getReceitasManuais`, `getObligations`, `getSalaryPayments` sem `.catch` (promessa rejeitada nao tratada se falharem); (c) `ultimos30()` usa `toISOString` (UTC) enquanto as outras datas sao locais; (d) o `Insurance` da Obrigacoes e um componente definido dentro do render; (e) `markCommPaid` nao e esperado antes de marcar a comissao como paga.
9. **Verificacao visual com dados:** Tarefa 10, com o servidor de dados falsos descartavel (fora do repositorio).

## Global Constraints

- **Comportamento identico:** mesmos pedidos aos servicos com os mesmos argumentos, mesmas contas (conversao `EUR_CVE = 110`, margens, folha, limiares), mesmos textos, mesmas rotas, mesmos nomes de ficheiros exportados (`export default function Financial`).
- Sem emojis; icones so `lucide-react`; comentarios em portugues sem acentos; **os ficheiros mantem o fim de linha existente** (CRLF em `Financial.jsx` e nos novos ficheiros; `file` para confirmar; editar com `python` a partir de um ficheiro de script na diretoria de scratch, que normaliza `\r\n`->`\n` e repoe no fim; nunca `sed -i`; **nunca escrever `\b` num `str` Python nao cru**).
- Componentes `ui/*` **nao mudam**; se a pagina precisar de algo que lhes falta, para-se e regista-se. Usar: `Table`, `Tabs`, `FilterChips`, `Input`, `Select`, `Textarea`, `Toggle`, `EmptyState`, `Button`, `Card`, `Modal`, `PageHeader`.
- Visual alvo: o do Dashboard e das fases anteriores (cartoes brancos, borda `n-200`, cantos de 8 px, estados com tokens, vazios com `EmptyState`).
- Testes: `fireEvent`/`findBy*`/`waitFor` (nao `user-event`); `MemoryRouter` com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; `vi.mock` estrito dos servicos e de `../hooks/usePlan` (`canAccess`); **`recharts` simulado** por componentes que desenham `<div data-chart="..." data-fill data-stroke data-tickfill data-cursorfill data-border data-data>` (o `ResponsiveContainer` real nao desenha nada no jsdom); **datas em hora local, relativas a hoje, com margem de dias** (Cabo Verde e UTC-1); prazos (INPS, seguros) com `vi.useFakeTimers` + `vi.setSystemTime`; `window.confirm` espiado; a guarda de `console.error`/`console.warn` le as contagens **antes** de restaurar os espioes; valores esperados pela mesma formula da pagina, nunca por intervalos fixos.
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit. Linha de base: 1121/1121 (55 ficheiros). Trabalhar numa branch `redesign/fase5b-financeiro`.

## Review Focus

- **Moeda CVE** em todas as areas: cada valor e arredondado a `valor * 110` com ` CVE` (e `€` + arredondado em EUR); o interruptor existe em duas formas (barra de Receitas e flutuante nas outras areas) e o estado e partilhado.
- **Resultado e o periodo:** despesas e folha respeitam `periodo.inicio`/`periodo.fim` (nao o mes corrente); a folha usa os pagamentos reais por `YYYY-MM`; margem a verde >= 20, amarelo entre 0 e 20, vermelho abaixo de 0; sinal e valor absoluto do resultado liquido.
- **Plano e bloqueios:** sem `canAccess('financeiro-completo')` as quatro areas pro mostram o bloqueio e os separadores levam cadeado; Comissoes e Receitas nunca sao bloqueadas.
- **Cargas preguicosas e falhas:** a previsao so se pede a primeira vez que se abre o separador (falha -> "Dados de previsao nao disponiveis"); `listStaff` so se pede ao abrir Despesas/Salarios/Comissoes; falhas de `carregar`, `getTransacoes`, `listStaff`, `getForecast` nao rebentam a pagina.
- **Dados em falta:** `resumo` nulo, unidade sem nome, transacao sem `units`, `total_price` nulo, comissao sem reserva, listas vazias: travessao ou vazio, nunca excecao; datas de prazo invalidas.

---

### Task 1: Rede de seguranca da pagina inteira e divisao literal do ficheiro

**Files:** Create `src/pages/financial/shared.jsx` (exporta por nome `EUR_CVE`, `TOUR_COSTS_KEY`, `PAYMENT_METHODS`, `PAYMENT_STATUS`, `PM_LABEL`, `PS_LABEL`, `PS_COLOR`, `SRC_LABEL`, `COST_FIELDS`, `EXPENSE_CATEGORIES`, `MANUAL_REVENUE_CATEGORIES`, `CAT_COLORS`, `MONTHS_PT`, `mesAtual`, `mesAnterior`, `esteAno`, `ultimos30`, `fmtDate`, `fmtMoney`, `loadCosts`, `saveCosts`, `unitTotalCost`, linhas 45-150 menos `SECTIONS`, `RECEITAS_TABS`, `PRESETS`, `GRANULARIDADES`), `CostEditModal.jsx`, `TransacoesTable.jsx`, `Comparativo.jsx`, `PorTourTab.jsx`, `PrevisaoTab.jsx`, `CaixaTab.jsx`, `DespesasTab.jsx` (com `ExpenseModal`), `ReceitasManuaisTab.jsx` (com `ReceitaManualModal`), `SalariosTab.jsx` (com `SalaryForm`), `ComissoesTab.jsx`, `ObrigacoesTab.jsx`, `ResultadoTab.jsx`; Modify `src/pages/Financial.jsx` (fica com a pagina e `SECTIONS`, `RECEITAS_TABS`, `PRESETS`, `GRANULARIDADES`); Test `src/__tests__/Financial.test.jsx`.

**Interfaces:** cada ficheiro exporta por omissao o seu componente com as **mesmas props de hoje** (`CostEditModal({ open, onClose, unitId, unitName, costs, onSave })`, `TransacoesTable({ transacoes, currency, loading })`, `Comparativo({ resumo, currency })`, `PorTourTab({ unidades, currency, costs, onEditCosts })`, `PrevisaoTab({ forecast, currency, loading })`, `CaixaTab({ transacoes, currency, loading })`, `DespesasTab({ currency, staff })`, `ReceitasManuaisTab({ currency, onChange })`, `SalariosTab({ currency })`, `ComissoesTab({ currency })`, `ObrigacoesTab({ currency })`, `ResultadoTab({ resumo, currency, sazonal, periodo })`); `shared.jsx` exporta por nome. Cada ficheiro importa so o que usa (`lucide-react`, `recharts`, servicos, `ui/*`, `LoadingSpinner`, `shared`). Servicos mockados nos testes: `financeiroService`, `expensesService`, `sellerService`, `staffService.listStaff`, `../hooks/usePlan`; `PlanGuard` real.

- [ ] **Step 1: Criar a branch e escrever o teste da pagina inteira (verde ANTES de mover).** Fixtures completas (resumo com `atual`/`anterior`/`variacao`, receita por periodo, duas unidades, dois clientes, canais direto e OTA, tres transacoes pago/pendente/dinheiro, previsao, uma despesa e uma receita manual, dois colaboradores e um vendedor de praia com duas comissoes, configuracao e pagamento de salario, obrigacoes). Testes: `renderiza_a_visao_geral_com_os_pedidos_e_os_kpis` (cinco chamadas com `inicio`/`fim` dos ultimos 30 dias e granularidade `day`; `getTransacoes` com as mesmas datas; `getReceita` do ano com `month`); `abre_cada_sub_separador_de_receitas_sem_rebentar` (Por Tour, Previsao, Caixa, Receitas Manuais, com texto esperado de cada um); `abre_cada_area_de_topo_sem_rebentar` (Despesas, Salarios, Comissoes, Obrigacoes, Resultado, com um texto esperado de cada uma); `sem_o_plano_as_quatro_areas_pro_mostram_o_bloqueio_e_Comissoes_nao` (`canAccess` falso); `previsao_so_se_pede_na_primeira_abertura`; `listStaff_so_se_pede_ao_abrir_despesas_salarios_ou_comissoes`; `interruptor_de_moeda_converte_com_110_e_vale_nas_outras_areas`; `exportar_chama_exportExcel_e_exportPdf_com_o_periodo`; `falha_do_carregamento_nao_rebenta`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Financial.test.jsx`. Expected: PASS antes de qualquer movimento.
- [ ] **Step 3: Mover literalmente** (intervalos de linhas com ferramentas de shell, sem retranscrever; acrescentar so as linhas de `import`/`export default`; `diff` dos corpos contra o original deve ser vazio). Confirmar com `grep` que cada identificador usado em cada ficheiro esta importado (o build nao detecta variaveis em falta).
- [ ] **Step 4: Correr.** `npx vitest run` e `npm run build`. Expected: tudo passa; `pages/Financial.jsx` com menos de 350 linhas; `file` mostra CRLF em todos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "refactor: dividir o Financeiro em ficheiros por responsabilidade"`

### Task 2: Estrutura da pagina (separadores, periodo, granularidade, moeda)

**Files:** Modify `src/pages/Financial.jsx`; Test `src/__tests__/Financial.test.jsx` (acrescentar).

**Interfaces:** consome `Tabs({ tabs: [{id,label}], value, onChange })` e `FilterChips({ options: [{value,label}], value, onChange })`. Separadores de topo: ids `receitas`, `despesas`, `salarios`, `comissoes`, `obrigacoes`, `resultado`, rotulo `Receitas` etc.; nos bloqueados o rotulo e `<>Despesas <Lock size={11} /></>`. Sub-separadores: ids `geral`, `portour`, `previsao`, `caixa`, `manuais`. Periodo: valor = indice do preset; granularidade: `day|week|month`; moeda: `EUR|CVE` (barra de Receitas). O interruptor flutuante usa tokens (`bg-ocean-900` e `text-ocean-300` ja sao da marca; sem hexadecimais).

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** `mudar_de_preset_repete_os_pedidos_com_as_datas_do_preset` (Este mes, Mes anterior, Este ano, com a formula da pagina); `mudar_a_granularidade_repete_getReceita`; `o_botao_do_preset_activo_e_o_unico_destacado`; `exportar_so_aparece_em_Receitas`; `o_cadeado_aparece_so_nos_separadores_pro_bloqueados`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Financial.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: `role="tablist"` dos dois niveis com `aria-selected` correcto; os grupos de periodo, granularidade e moeda tem `aria-pressed`; nenhuma classe `bg-n-100 rounded-sm p-0.5` dos grupos antigos; o nome acessivel de um separador bloqueado continua a ser o rotulo. Migrar como acima.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: estrutura do Financeiro com Tabs e FilterChips"`

### Task 3: Visao Geral (tabelas, graficos, KPIs)

**Files:** Modify `src/pages/financial/TransacoesTable.jsx`, `Comparativo.jsx`, `src/components/financial/ChannelChart.jsx`, `ServiceBarChart.jsx`, `RevenueChart.jsx`, `KpiCard.jsx`, e a parte "geral" de `src/pages/Financial.jsx` (cabecalhos de `Card`); Test `src/__tests__/FinancialReceitas.test.jsx`.

**Interfaces:** consome `Table`, `Input`, `Select`, `EmptyState`, `Card`. `TransacoesTable`: pesquisa `<Input aria-label="Pesquisar transacoes">`, dois `<Select aria-label="Metodo de pagamento" / "Estado do pagamento">`, tabela com colunas Data, Cliente, Servico, Canal, Metodo, Montante, Estado (`compact`), estado com cor por `PS_COLOR` convertido a tokens (`pago` -> `--success-light`/`--success`, `pendente` -> `--warning-light`/`--warning`, `parcial` -> `--info-light`/`--info`, `reembolsado` -> `--n100`/`--n500`); vazio com `EmptyState icon={Receipt} title="Sem transacoes no periodo"`. `Comparativo`: `Table` de quatro colunas (a primeira a esquerda, as outras `align: 'right'`), cores `--success`/`--error`/`--n400`. Graficos: `RevenueChart` (`stopColor`, grade, eixos, cursor, area, ponto), `ChannelChart` (`COLORS`), `ServiceBarChart` (`COLORS`, grade, eixos, cursor) e `KpiCard` (`#1A7A4A`) trocam hexadecimais por `var(--...)` de **valor identico** (decisao 6). `PS_COLOR` e `COLORS` ficam em tokens.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `kpis_receita_directas_ticket_medio_e_margem` (directas sao `direct|public|manual`; ticket medio; margem liquida so com custos guardados em `localStorage`; crescimento); `canais_consolidam_directa_e_public`; `top_clientes_mostra_5_com_barra_proporcional`; `top_5_servicos_por_receita_ordenados_e_com_nome_cortado_aos_16`; `comparativo_mostra_actual_anterior_e_variacao_com_seta` (receita em moeda, ocupacao em `p.p.`, neutro com travessao) e `comparativo_nao_aparece_sem_periodo_anterior`; `transacoes_filtram_por_pesquisa_metodo_e_estado_e_contam`; `transacoes_mostram_no_maximo_50`; `transacoes_com_campos_em_falta_dao_travessao`; `actualizar_repete_getTransacoes`; `sem_transacoes_mostra_o_vazio`; `sem_dados_nos_graficos_mostra_os_textos_vazios` (`Sem dados para o periodo seleccionado`, `Sem dados`, `Sem dados de servicos`); `moeda_cve_converte_todos_os_valores`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/FinancialReceitas.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: as duas tabelas tem `role="table"` com as colunas esperadas; os campos de filtro tem nome acessivel; nenhuma cor hexadecimal nem `green-`/`yellow-`/`blue-` sobra em `TransacoesTable`/`Comparativo`; os graficos simulados recebem cores `var(--...)` (nenhum `#` em `data-fill`, `data-stroke`, `data-tickfill`, `data-cursorfill`, `data-border`); o vazio das transacoes usa `EmptyState`; **os testes `ResumoView`, `dashboardUi` e `MetricCard` continuam verdes sem mudanca**. Migrar como acima.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Visao Geral do Financeiro com o design system"`

### Task 4: Por Tour, Previsao e Caixa

**Files:** Modify `src/pages/financial/PorTourTab.jsx`, `CostEditModal.jsx`, `PrevisaoTab.jsx`, `CaixaTab.jsx`; Test `src/__tests__/FinancialReceitas.test.jsx` (acrescentar).

**Interfaces:** consome `Table`, `EmptyState`, `Card`, `Input`. `PorTourTab`: `Table` com colunas Tour, Reservas, Receita bruta, Custo, Margem, `%`, acoes (`compact`); a primeira celula leva `data-destaque="melhor"` (`--success-light`) ou `"pior"` (`--error-light`) conforme `margemPct` maximo/minimo (so se maximo != minimo); margem `--success`/`--error`; botao `aria-label="Editar custos"`; vazio `EmptyState icon={Layers} title="Sem dados de tours no periodo."`. `CostEditModal`: cinco `Input` com `label` (`Guia / Instrutor`, `Transporte`, `Bilhetes / Entrada`, `Refeicoes`, `Outros`), total em `--n800`. `PrevisaoTab`: aviso `bg-[var(--warning-light)] border-[var(--warning)]`, vazios com `EmptyState`. `CaixaTab`: tres cartoes em `Card`, tons `--success`/`--warning`, tabela em `Table`, vazio com `EmptyState icon={Wallet}`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `por_tour_calcula_custo_margem_e_percentagem_a_partir_dos_custos_guardados`; `melhor_e_pior_margem_so_se_forem_diferentes`; `editar_custos_abre_o_modal_com_os_valores_e_guardar_grava_em_localStorage` (`saldesk_tour_costs_v1`) e `o_total_do_modal_soma_os_cinco`; `por_tour_sem_dados_mostra_o_vazio`; `previsao_mostra_kpis_semanas_e_o_aviso_abaixo_de_80_da_media`; `previsao_sem_dados_mostra_a_mensagem_e_o_endpoint`; `previsao_em_carga_mostra_o_spinner`; `caixa_soma_total_confirmado_e_por_confirmar` (so `payment_method === 'cash'`); `caixa_sem_dinheiro_mostra_o_vazio`.
- [ ] **Step 2: Correr.** Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: tabelas com `role="table"`; `data-destaque` nas linhas certas; `Editar custos` tem nome acessivel; os campos do modal tem `label`; nenhum hexadecimal, `yellow-`, `red-` ou `text-error` sobra nas quatro peças. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Por Tour, Previsao e Caixa do Financeiro com o design system"`

### Task 5: Despesas

**Files:** Modify `src/pages/financial/DespesasTab.jsx` (e `shared.jsx` so em `CAT_COLORS`); Test `src/__tests__/FinancialDespesas.test.jsx`.

**Interfaces:** consome `Table`, `Input`, `Select`, `Textarea`, `Toggle`, `EmptyState`, `Card`, `Button`, `Modal`. `CAT_COLORS` passa a `['var(--ocean-700)','var(--ocean-500)','var(--ocean-400)','var(--ocean-300)','var(--ocean-200)','var(--sand-500)','var(--sand-300)','var(--success)','var(--error)','var(--sand-600)','var(--warning)','var(--n700)','var(--n500)','var(--n400)']`. Filtros: `<Input type="month" aria-label="Mes">`, `<Select aria-label="Categoria">`. Tabela: Data, Categoria, Colaborador, Valor (`--error`), Recorrente (chip `--ocean-50`/`--ocean-700`), Notas, acoes (`Editar despesa`, `Eliminar despesa`). Grafico de pizza: `Cell fill` com `CAT_COLORS`. Alerta de recorrentes em falta: `--warning-light`. Modal: `Toggle label="Despesa recorrente mensal"`. Servicos mockados: `expensesService`, `staffService` (via `staff` por props), `window.confirm` espiado.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `lista_so_o_mes_e_a_categoria_filtrados_ordenada_por_data_desc`; `total_do_periodo_e_resumo_por_categoria_ordenado_com_os_quatro_maiores`; `grafico_de_pizza_ate_8_categorias_e_detalhe_com_percentagem`; `alerta_de_recorrentes_em_falta_este_mes` (recorrente sem despesa nao recorrente da mesma categoria no mes; mostra ate 3); `registar_despesa_chama_addExpenseLocal_com_valor_numerico_e_acrescenta`; `editar_chama_updateExpenseLocal_e_substitui`; `eliminar_pede_confirmacao_e_so_apaga_se_confirmar`; `colaborador_so_aparece_nas_categorias_salarios_e_comissoes_vendedores_e_com_staff`; `sem_despesas_mostra_o_vazio`; `em_carga_mostra_o_spinner`.
- [ ] **Step 2: Correr.** Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: tabela com `role="table"` e acoes com nome acessivel; os campos do modal tem `label` associado (`getByLabelText('Valor')`); o `Toggle` alterna e entra em `is_recurring: true` no `addExpenseLocal`; nenhum hexadecimal, `yellow-`, `red-`, `text-error` na pagina (com despesas, alerta e modal aberto); cores do grafico `var(--...)`. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Despesas do Financeiro com o design system"`

### Task 6: Receitas manuais

**Files:** Modify `src/pages/financial/ReceitasManuaisTab.jsx`; Test `src/__tests__/FinancialReceitasManuais.test.jsx`.

**Interfaces:** o mesmo desenho da Tarefa 5 (filtros, cartoes de categoria, `Table` com Data, Categoria, Valor `--success` com prefixo `+`, Notas, acoes `Editar receita` e `Eliminar receita`; modal com `Input`/`Select`/`Textarea`). Servicos mockados: `financeiroService.getReceitasManuais`, `createReceitaManual`, `updateReceitaManual`, `deleteReceitaManual`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `lista_filtrada_por_mes_e_categoria_ordenada_por_data_desc`; `total_e_cartoes_por_categoria_em_euro_e_cve`; `registar_chama_createReceitaManual_e_onChange`; `editar_chama_updateReceitaManual_com_o_id_e_onChange`; `eliminar_pede_confirmacao_chama_deleteReceitaManual_e_onChange`; `sem_receitas_mostra_o_vazio`; `em_carga_mostra_o_spinner`; `na_pagina_inteira_um_CRUD_repete_getResumo_e_a_receita_do_ano` (`refreshAposReceitaManual`).
- [ ] **Step 2: Correr.** Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: `role="table"`, acoes com nome acessivel, campos com `label`, nenhum hexadecimal ou `text-error` sobra. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Receitas manuais do Financeiro com o design system"`

### Task 7: Salarios e Comissoes

**Files:** Modify `src/pages/financial/SalariosTab.jsx`, `ComissoesTab.jsx`; Test `src/__tests__/FinancialPessoal.test.jsx`.

**Interfaces:** `SalariosTab`: quatro KPIs em `Card` (`padding="px-4 py-3"`), tons `--error`, `--success`, `--warning`; `Table` com Colaborador (nome + funcao), Salario base, Subsidios, INPS patronal, Custo total/mes, Estado (chip `--success-light`/`--success` ou `--warning-light`/`--warning`), acoes (`Editar salario <nome>`, `Pagar <nome>` como `Button size="sm"`); `SalaryForm` com os `Input` existentes e o resumo em `Card`; modal de pagamento com `Button`. `ComissoesTab`: um `Card` por vendedor, tons do total/pago/pendente `--n800`/`--success`/`--warning`, chips de estado, botao `Pagar` por comissao como botao de texto `text-[var(--ocean-700)]`, vazio com `EmptyState icon={Users}`. Servicos mockados: `staffService.listStaff`, `expensesService` (`getSalaryConfig`, `setSalaryConfig`, `getSalaryPayments`, `addSalaryPayment`), `sellerService`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `so_colaboradores_activos_e_kpis_de_folha_pagos_e_por_pagar`; `custo_total_e_base_mais_subsidios_mais_inps` (INPS por omissao 15%); `pago_se_ha_pagamento_do_mes_e_ano_correntes`; `pagar_chama_addSalaryPayment_com_staffId_mes_ano_e_valor_calculado`; `editar_salario_chama_setSalaryConfig_com_numeros_e_actualiza`; `subsidios_mostram_alimentacao_e_transporte_ou_travessao`; `sem_colaboradores_activos_mostra_o_vazio`; `comissoes_so_de_vendedor_de_praia_activo_e_do_mes_corrente`; `comissao_do_vendedor_usa_commission_pct_ou_o_valor_guardado`; `pagar_uma_comissao_chama_markCommissionPaid_e_marca_paga`; `registar_pag_paga_todas_as_pendentes_do_mes`; `sem_vendedores_mostra_o_vazio`; `falha_em_listStaff_mostra_o_vazio_das_comissoes`.
- [ ] **Step 2: Correr.** Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: `role="table"` na folha; acoes com nome acessivel; campos do `SalaryForm` com `label`; nenhum hexadecimal, `yellow-` ou `text-error` sobra. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Salarios e Comissoes do Financeiro com o design system"`

### Task 8: Obrigacoes

**Files:** Modify `src/pages/financial/ObrigacoesTab.jsx`; Test `src/__tests__/FinancialObrigacoes.test.jsx`.

**Interfaces:** quatro `Card` (INPS, IUR, Seguros, Subscricao SalDesk); selector do INPS `Select aria-label="Estado do INPS"`; notas do IUR `Textarea`; novo seguro: `Input` (nome), `Input type="date"`, `Input type="number"`, botao `Button` com `aria-label="Adicionar seguro"`; remover seguro `aria-label="Remover seguro"`; aviso de prazo `--error-light`/`--error`; seguro critico (<= 30 dias) `--warning-light`/`--warning`; plano e renovacao com `Select`/`Input`. Servicos mockados: `expensesService.getObligations` e `setObligations`; relogio com `vi.useFakeTimers`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `mostra_inps_com_dia_15_e_contribuicoes`; `aviso_de_prazo_so_entre_1_e_5_dias_antes_do_dia_15` (dia 10, dia 12, dia 15, dia 16); `mudar_o_estado_do_inps_grava_com_setObligations`; `notas_do_iur_gravam_ao_escrever`; `adicionar_seguro_exige_nome_grava_com_valor_numerico_e_limpa_os_campos`; `seguro_critico_a_30_dias_ou_menos_mostra_os_dias_e_o_aviso` (29, 30, 31 dias; sem data mostra `Sem data`); `remover_seguro_grava_a_lista_sem_ele`; `sem_seguros_mostra_o_texto`; `plano_e_renovacao_gravam`; `falha_em_setObligations_nao_rebenta` (`.catch(() => {})`).
- [ ] **Step 2: Correr.** Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: campos com nome acessivel; nenhum hexadecimal, `yellow-`, `red-`, `text-error`, `bg-n-50 ... focus:border-ocean-700` a mao sobra. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Obrigacoes do Financeiro com o design system"`

### Task 9: Resultado

**Files:** Modify `src/pages/financial/ResultadoTab.jsx`; Test `src/__tests__/FinancialResultado.test.jsx`.

**Interfaces:** seis cartoes em `Card` com os tons por limiar (`--ocean-700`, `--error`, `--success`, `--warning`, `--n900`); grafico `BarChart`: grade `var(--n200)`, eixos `fill: 'var(--n500)'`, tooltip `border: '1px solid var(--n200)'`, barras `var(--ocean-700)` e `var(--error)`; decomposicao em `Card`; botoes de exportar mantidos. Servicos mockados: `expensesService.listExpenses`/`getSalaryPayments`, `financeiroService.exportExcel`/`exportPdf`; `recharts` simulado.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `despesas_so_do_periodo_seleccionado_nao_do_mes_corrente`; `folha_so_dos_pagamentos_do_periodo_por_ano_mes`; `resultado_e_receita_menos_despesas_menos_folha_e_margem_sobre_a_receita`; `margem_a_verde_a_amarelo_e_a_vermelho_nos_limiares_20_e_0`; `sem_receita_a_margem_e_zero`; `decomposicao_mostra_sinais_e_o_valor_absoluto_do_resultado`; `grafico_dos_ultimos_6_meses_soma_despesas_e_folha_por_mes`; `receita_do_grafico_le_date_e_value_ou_total` (fixa a forma errada, ver decisao 8a); `exportar_chama_exportPdf_e_exportExcel_com_o_periodo`; `em_carga_mostra_o_spinner`; `moeda_cve_converte_os_cartoes_mas_nao_o_grafico`.
- [ ] **Step 2: Correr.** Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: nenhum hexadecimal, `text-error` ou `text-[#...]` sobra; as cores do grafico sao `var(--...)`; os botoes de exportar continuam com os nomes. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Resultado do Financeiro com o design system"`

### Task 10: Verificacao no browser com dados falsos e revisao final

**Files:** nenhum no repositorio; estender **fora do repositorio** o `mock-api5a.js` da diretoria de scratch (porta 3001; o `frontend/.env` aponta para la). **Nao arrancar o backend real.**

- [ ] **Step 1: Dados.** Acrescentar rotas para `/financial/resumo`, `/financial/receita` (forma real `{ periodo, receita, num_reservas }`), `/financial/unidades`, `/financial/clientes`, `/financial/canais`, `/financial/transacoes`, `/financial/forecast`, receitas manuais, despesas, salarios, obrigacoes, comissoes e colaboradores (ler os servicos para os caminhos exactos). Sessao ficticia no `localStorage` (`saldesk-auth`) com plano `business`.
- [ ] **Step 2: Ver** `/financeiro` a 1280 px e 375 px: os cinco sub-separadores e as cinco areas; sem scroll horizontal da pagina; os graficos (area com gradiente, circular, barras horizontais, barras verticais) desenham-se com as cores dos tokens (**confirmar que `var(--...)` em `stopColor`, `fill` e `stroke` funciona de facto no browser**); registar e eliminar uma despesa e uma receita manual; editar custos de um tour; mudar periodo e moeda; consola sem erros alem do `socket.io` do mock. Confirmar tambem que um dashboard (Resumo) continua igual. Medir por JavaScript quando as capturas falharem.
- [ ] **Step 3: Fora de ambito.** `/viajante/entrar` e portais sem `data-ui` e sem mudanca.
- [ ] **Step 4: Limpar** a sessao ficticia, parar os servidores; `git status` limpo.
- [ ] **Step 5: Revisao final** da branch inteira (um revisor independente, modelo mais capaz) com o pacote `review-package`; corrigir Critical/Important num so passo com teste RED->GREEN; os Minor vao para o ledger. So com autorizacao explicita do utilizador, fundir em `main`, empurrar e implantar o frontend como nas fases anteriores.

# Redesenho da app do operador, Fase 5a (Gestao: RH, Meteorologia, Previsao, Analytics) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar as quatro paginas mais pequenas do grupo "Gestao" para os componentes e o aspeto "azul da marca", **sem alterar nenhum comportamento**: os mesmos pedidos aos servicos com os mesmos dados, as mesmas contas e os mesmos textos.

**Architecture:** O mesmo metodo das Fases 3, 3b e 4: cada pagina e primeiro protegida por testes de caracterizacao (nenhuma tem testes), que passam **antes** de qualquer migracao e **depois** dela; so depois se trocam separadores, tabelas, campos e estados vazios pelos componentes `ui` e as cores em hexadecimal ou nomeadas por tokens. Os graficos (`recharts`) e os SVG passam a usar `var(--token)` nos atributos de cor. As paginas nao se partem em ficheiros (140 a 677 linhas).

**Tech Stack:** React 18, Vite, Tailwind 3, recharts, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (seccoes 5.4 e 7, Fase 5). Planos anteriores, de que este herda metodo e restricoes: `docs/superpowers/plans/2026-11-06-redesign-fase4-clientes.md` e `docs/superpowers/plans/2026-11-06-redesign-fase3b-housekeeping-manutencao-menu-pedidos.md`. Caminhos relativos a `frontend/`; comandos dentro de `frontend/`.

**Fase 5 dividida em tres planos independentes** (o spec manda publicar cada fase a parte): **5a** (este: RH, Meteorologia, Previsao, Analytics, ~1575 linhas), **5b** Financeiro (1528 linhas, onze sub-componentes e quatro graficos) e **5c** Colaboradores e detalhe (`Staff.jsx` 1476 + `StaffDetail.jsx` 554). 5b e 5c terao plano proprio, com a divisao literal do ficheiro que a Fase 3 usou.

**Estado atual medido (base deste plano):**
- `pages/RH.jsx` (140 linhas): cartoes de numeros, listas de pedidos de ferias (aprovar/rejeitar) e de documentos a expirar, grelha de colaboradores; 1 cor nomeada (`amber`).
- `pages/Weather.jsx` (304 linhas): grelha de 7 dias, alertas de conflito, detalhe do dia, resumo; cores `red-*`/`blue-*`, 4 hexadecimais (verde do WhatsApp e do aviso); `services/weatherService.js` devolve `color` e `bg` em hexadecimal por codigo de tempo.
- `pages/Demand.jsx` (454 linhas, "Previsao"): KPIs, tres separadores a mao (Historico, Proximos 30 dias, Sugestoes), grafico de barras, 11 hexadecimais (graficos e verdes).
- `pages/Analytics.jsx` (677 linhas): score de saude (medidor em SVG), barras, grafico de barras por pais, funil, resumo, taxa de abandono, tabela de concorrencia com edicao na linha; 6 hexadecimais e 6 cores nomeadas, `CHART_COLORS` em hexadecimal.
- **Nenhuma tem testes.** Texto fixo em portugues.

**Decisoes de desenho (para o utilizador rever):**
1. **Mudanca visual, nao funcional.** Nada e acrescentado ou removido.
2. **Cores:** hexadecimal e `red-*`/`green-*`/`yellow-*`/`blue-*`/`amber-*` passam a tokens (`--success`, `--warning`, `--error`, `--info` e as `-light`, `--ocean-*`, `--sand-*`, `--n*`). Nos SVG e nos atributos do `recharts` usa-se a cadeia `var(--token)` (ex.: `fill="var(--ocean-700)"`); o verde da marca do WhatsApp passa a `--success`. Os tokens nao tem hifen entre `n` e o numero (`var(--n500)`), ao contrario das classes.
3. **Os separadores da Previsao passam a `Tabs`** (perdem os icones).
4. **A tabela de concorrencia da Analytics passa a `Table`** com a edicao do preco na propria celula, como hoje; os botoes de editar e guardar ganham `aria-label`.
5. **`weatherService.weatherInfo` passa a devolver `var(--token)` em `color`** (so a Meteorologia o usa); o campo `bg` nao e usado por ninguem e fica como esta.
6. **Fora de ambito, registado (ja existentes, ficam como estao e sao fixados pelos testes):** a Analytics le `reviews.average_rating` mas o endpoint devolve `average` (o rating medio aparece sempre vazio); a Analytics mostra um "indice de popularidade por tour" **inventado** com `Math.random()` (rotulado como estimativa); a Previsao pede `listReservations({ from, to, status: 'confirmed,pending' })` e o backend ignora `from`/`to` e nao entende o `status` com virgula.
7. **Verificacao visual com dados:** Tarefa 5, com o servidor de dados falsos descartavel (fora do repositorio).

## Global Constraints

- **Comportamento identico:** mesmos pedidos aos servicos com os mesmos argumentos, mesmas contas (score, limiares, medias, agrupamentos), mesmos textos, mesmas rotas e nomes de ficheiros.
- Sem emojis; icones so `lucide-react`; comentarios em portugues sem acentos; ficheiros mantem o fim de linha existente (`file`; editar com `python` a partir de um ficheiro de script, nunca `sed -i` nos CRLF).
- Componentes partilhados (`ui/*`) **nao mudam**; se uma pagina precisar de algo que lhes falta, para-se e regista-se (ex.: o `Table` nao aceita classe por linha).
- Usar: `Table`, `Tabs`, `FilterChips`, `Input`, `EmptyState`, `Button`, `Card`, `Badge`, `PageHeader`.
- Visual alvo: o do Dashboard e das fases anteriores (cartoes brancos, borda `n-200`, cantos de 8 px, estados com tokens, vazios com `EmptyState`).
- Testes: `fireEvent`/`findBy*`/`waitFor` (nao `user-event`); `MemoryRouter` com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; `vi.mock` estrito dos servicos; **`recharts` simulado** por componentes que desenham `<div data-chart="..." data-fill data-stroke>` com as props de cor (o `ResponsiveContainer` real nao desenha nada no jsdom); **datas em hora local, relativas a hoje, com margem de dias** (a Cabo Verde e UTC-1: as paginas que contam dias a partir da meia-noite UTC dao n+1 depois das 23h; esperar o valor pela mesma formula, nunca por intervalos fixos); a guarda de `console.error`/`console.warn` le as contagens **antes** de restaurar os espioes; `Math.random` fixado quando a pagina o usa.
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit. Linha de base: 1025/1025.

## Review Focus

- Analytics: o score de saude (com e sem `health_score` do servidor), as origens de clientes construidas a partir dos clientes quando o servidor nao as da, o funil em falta mostra o aviso, a taxa de abandono (limiares 60 e 80, aviso acima de 70) e a concorrencia guardada em `localStorage` (`saldesk_competition_v1`) com a posicao acima/abaixo do mercado.
- Previsao: um mes e "alto" acima de 1,25 vezes a media e "baixo" abaixo de 0,75 (so meses com receita), sem dados a sugestao diz-o, e as reservas dos proximos 30 dias agrupam-se por data de entrada.
- Meteorologia: so ha conflito quando ha mau tempo **e** reservas (pendentes, confirmadas ou com check-in); a falha do servico mostra o erro com "Tentar novamente"; clicar no mesmo dia outra vez fecha o detalhe.
- RH: aprovar e rejeitar chamam `updateLeaveStatus` com os argumentos certos, mostram o aviso certo e recarregam; a falha mostra o aviso de erro.
- Todas: servicos a falhar nao rebentam (cada pagina trata a falha a sua maneira) e dados em falta (`null`, listas vazias) dao travessao ou vazio.

---

### Task 1: RH

**Files:** Modify `src/pages/RH.jsx`; Test `src/__tests__/RH.test.jsx`.

**Interfaces:** consome `Badge`/`Card` e os tokens; `StatCard` troca `bg-amber-50 text-amber-600` por `bg-[var(--warning-light)] text-[var(--warning)]`; as listas ficam em `Card`; os botoes de aprovar/rejeitar mantem `aria-label` `Aprovar` e `Rejeitar`. Servicos mockados: `staffService` (`getHrOverview`, `updateLeaveStatus`), `ExpiryBadge` real, `useToast` (store real com `toast` espiado) e `useNavigate` real dentro de `MemoryRouter`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Fixtures: dois pedidos de ferias (um `vacation`, um `sick`), tres itens a expirar (documento e certificacao) e quatro colaboradores. Testes: `os_tres_cartoes_contam_pendentes_a_expirar_e_activos`; `pedido_mostra_nome_tipo_datas_e_dias` (`daysBetween` inclusivo: 5 dias para 5 dias seguidos; tipo desconhecido mostra o valor tal e qual); `aprovar_chama_updateLeaveStatus_com_staff_leave_e_approved_e_avisa_e_recarrega` (`toast.success('Pedido aprovado')`, `getHrOverview` chamado outra vez); `rejeitar_...rejected_e_Pedido rejeitado`; `falha_ao_actualizar_mostra_Erro ao actualizar pedido`; `a_expirar_mostra_documento_e_certificacao_com_o_estado`; `sem_pedidos_e_sem_a_expirar_mostram_os_textos_vazios`; `clicar_num_colaborador_navega_para_colaboradores_id`; `falha_ao_carregar_mostra_Erro ao carregar RH` e a pagina fica vazia (zeros).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/RH.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: nenhuma classe `amber-` nem hexadecimal sobra (com e sem itens a expirar); os cartoes de aviso usam o token de aviso quando ha pendentes. Migrar como acima.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de RH com o design system"`

### Task 2: Meteorologia

**Files:** Modify `src/pages/Weather.jsx`, `src/services/weatherService.js` (so as cadeias `color` de `weatherInfo`); Test `src/__tests__/Weather.test.jsx`.

**Interfaces:** consome `EmptyState`, `Button`, `Card`; `weatherInfo(code)` continua a devolver `{ label, iconName, color, bg }` com `color` em `var(--ocean-500)` etc. (sol e `var(--sand-500)`, nublado e nevoeiro `var(--n500)`, neve `var(--n400)`, garoa `var(--ocean-500)`, chuva e aguaceiros `var(--ocean-700)`, trovoada `var(--error)`). `WeatherCard`, alertas, detalhe e resumo usam tokens (`bg-red-50`/`border-red-*` -> `--error-light`; `bg-blue-50` -> `--info-light`; `bg-[#ECFDF5]` -> `--success-light`; o botao do WhatsApp `bg-[var(--success)]`). Servicos mockados: `weatherService` (`getWeatherForecast`; `weatherInfo`, `isBadWeather` e `dayLabel` reais), `reservationsService.listReservations`, `islandsService.listIslands`, `authStore` (`operator.island_id`) e `useNavigate`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Previsao de 7 dias com datas a partir de hoje (hora local), dois dias de mau tempo (codigo de chuva) e reservas em dois dias. Testes: `titulo_com_a_ilha_e_chamada_a_previsao_com_lat_lng`; `grelha_de_7_dias_com_temperaturas_precipitacao_e_n_tours`; `hoje_tem_destaque`; `conflito_so_com_mau_tempo_e_reservas_activas` (reserva cancelada nao conta; mau tempo sem reservas nao conta); `alerta_de_conflito_mostra_tours_e_participantes_e_contactar_clientes_navega_para_reservas_date` (`/reservas?date=AAAA-MM-DD`); `clicar_num_dia_abre_o_detalhe_e_clicar_outra_vez_fecha`; `detalhe_lista_tours_cliente_pax_e_whatsapp_so_com_telefone` (ligacao `wa.me/<digitos>`); `resumo_max_hoje_precipitacao_total_dias_sem_mau_tempo_e_conflitos`; `sem_conflitos_mostra_Sem conflitos meteorologicos`; `falha_do_servico_mostra_o_erro_e_tentar_novamente_recarrega`; `falha_nas_reservas_nao_rebenta` (`.catch(() => [])`); `weatherInfo_devolve_etiqueta_e_icone_por_codigo` (etiquetas e `iconName` dos oito intervalos, sem fixar `color`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Weather.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: nenhuma classe hexadecimal, `red-`, `blue-` ou `green-` sobra no HTML (com conflito e sem conflito); a cor do icone de cada dia e uma cadeia `var(--` (`weatherInfo(code).color.startsWith('var(--')` para todos os codigos); o erro usa `EmptyState`. Migrar como acima.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Meteorologia com o design system"`

### Task 3: Previsao de procura

**Files:** Modify `src/pages/Demand.jsx`; Test `src/__tests__/Demand.test.jsx`.

**Interfaces:** consome `Tabs({ tabs: [{id,label}], value, onChange })` (ids `historico`, `proximo30`, `sugestoes`; rotulos `Historico`, `Proximos 30 dias`, `Sugestoes`), `EmptyState`, `Card`. Todas as cores de graficos e de cartoes passam a tokens: `CartesianGrid stroke="var(--n200)"`, eixos `fill: 'var(--n500)'`, linha da media `var(--sand-500)`, barras do ano anterior `var(--n200)`, barras do ano actual `var(--success)` (epoca alta), `var(--ocean-700)` (baixa) e `var(--ocean-400)` (normal); o `ChartTooltip` ja usa a cor que o grafico lhe da. Servicos mockados: `financeiroService.getReceita`, `reservationsService.listReservations`; `recharts` simulado (ver Global Constraints).

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Receita mensal do ano corrente e do anterior (formas `{ date, value }` e `{ date, total }`), e reservas nos proximos 30 dias. Testes: `pede_receita_dos_dois_anos_por_mes_e_as_reservas_com_o_filtro_actual` (`getReceita('<ano>-01-01','<ano>-12-31','month')`; `listReservations({ from, to, status: 'confirmed,pending' })` com as datas de hoje e hoje+29); `kpis_receita_acumulada_variacao_melhor_mes_e_reservas_30d`; `variacao_sem_ano_anterior_mostra_travessao`; `epoca_alta_acima_de_1_25_da_media_e_baixa_abaixo_de_0_75` (so meses com receita); `grafico_usa_dados_dos_12_meses_e_a_linha_da_media`; `sem_dados_mostra_o_vazio_do_grafico`; `separador_proximos_30_dias_agrupa_por_data_de_entrada_e_destaca_3_ou_mais`; `dias_com_mais_actividade_top_5_ordenados`; `sem_reservas_mostra_o_vazio`; `separador_sugestoes_uma_por_mes_alto_ou_baixo_ate_6` e `sem_dados_historicos_mostra_a_sugestao_unica`; `comparativo_anual_so_com_melhor_mes`; `actualizar_repete_os_tres_pedidos`; `servicos_a_falhar_dao_zeros` (os tres tem `.catch`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Demand.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: os separadores sao `role="tab"` com `aria-selected`; nenhuma classe hexadecimal ou `green-` sobra nos tres separadores; os graficos recebem cores `var(--...)` (`data-fill`/`data-stroke`) e nenhum `#`. Migrar como acima.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Previsao com o design system"`

### Task 4: Analytics

**Files:** Modify `src/pages/Analytics.jsx`; Test `src/__tests__/Analytics.test.jsx`.

**Interfaces:** consome `Table({ columns, rows })`, `Input`, `EmptyState`, `Card`, `Button`. `CHART_COLORS` passa a `['var(--ocean-700)', 'var(--ocean-500)', 'var(--ocean-400)', 'var(--ocean-300)', 'var(--sand-500)', 'var(--sand-300)', 'var(--ocean-200)', 'var(--ocean-100)']`; o medidor (`HealthGauge`: `var(--success)`, `var(--sand-500)`, `var(--error)`; trilho `var(--n200)`; textos `var(--n900)`/`var(--n500)`), as barras do score, o funil, as cores de limiar (`text-[var(--success)]`, `text-[var(--warning)]`, `text-[var(--error)]`) e o aviso de abandono (`--warning-light`) passam a tokens. A tabela de concorrencia passa a `Table` com as colunas Tour, Preco SalDesk, Preco Viator/GYG, Posicao no mercado e acoes; a celula do concorrente vira `Input` quando se edita; botoes `aria-label` `Editar preco` e `Guardar preco`. Servicos mockados: `analyticsService` (`getAnalyticsStats`, `getReviewsStats`, `getMarketingStats`), `customersService.listCustomers`, `financeiroService.getResumo`, `unitsService.listUnits`; `localStorage` real; `window.open` espiado; `Math.random` fixado; `recharts` simulado.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `pede_os_ultimos_30_dias_e_os_cinco_servicos` (`getResumo(inicio, fim)` com 30 dias; falhas individuais dao `null`/`[]`); `score_do_servidor_e_usado_quando_existe` e `score_calculado_a_partir_de_receita_ocupacao_e_avaliacoes` (limiares de cada componente; o rating le `average_rating` e por isso fica no valor por omissao; um teste fixa-o); `rotulo_do_medidor_bom_moderado_critico` (>=70, >=50) e `sem_dados`; `barras_do_score_mostram_valor_sobre_25`; `resumo_30_dias_receita_reservas_novos_clientes_e_rating_com_variacao`; `origens_vem_do_servidor_ou_dos_clientes_top_10_por_contagem` (percentagens e nomes dos paises); `sem_origens_mostra_os_dois_vazios`; `funil_em_falta_mostra_o_aviso` e `funil_calcula_a_percentagem_sobre_o_passo_anterior`; `relatorio_semanal_abre_mailto_com_assunto_e_corpo` (`window.open` com `mailto:` e os valores); `taxa_de_abandono_e_limiares` (60, 80; aviso so acima de 70; sem visitas mostra travessao); `popularidade_por_tour_usa_Math.random_fixado_e_marca_abaixo_de_50`; `concorrencia_posicao_acima_abaixo_e_na_media` (limiares 5 e 20; `Considera reduzir para aumentar conversao` so acima de 20); `editar_preco_guarda_em_localStorage_saldesk_competition_v1` e `os_precos_guardados_sao_lidos_ao_abrir`; `sem_tours_mostra_o_vazio_da_concorrencia`; `actualizar_repete_os_pedidos`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Analytics.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: nenhuma classe hexadecimal, `yellow-` ou `green-` sobra e nenhum `#` em `fill`, `stroke` ou `style` (pagina inteira, incluindo o medidor SVG e os graficos simulados); as cores dos graficos sao `var(--...)`; os botoes de editar e guardar a concorrencia tem nome acessivel; a tabela tem `role="table"` com as cinco colunas.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Analytics com o design system"`

### Task 5: Verificacao no browser com dados falsos

**Files:** nenhum no repositorio; estender **fora do repositorio** o `mock-api.js` da diretoria de scratch (porta 3001; o `frontend/.env` aponta para la). **Nao arrancar o backend real.**

- [ ] **Step 1: Dados.** Acrescentar rotas para: RH (`getHrOverview`, `updateLeaveStatus`), Meteorologia (a previsao vem do Open-Meteo, fora da API: o servico de tempo falha no sandbox, por isso verificar tambem o estado de erro e, se houver rede, o real), Previsao (`financeiroService.getReceita`), Analytics (`/analytics/stats`, `/reviews/stats`, `/marketing/stats`, `/customers`, `/financial/resumo`, `/units`). Ler os servicos para os caminhos exactos. Sessao ficticia no `localStorage` (`saldesk-auth`) com plano `business` (as paginas estao atras de `PlanGuard`).
- [ ] **Step 2: Ver** `/rh`, `/meteorologia`, `/previsao` e `/analytics` a 1280 px e 375 px: sem scroll horizontal da pagina; os graficos desenham-se com as cores dos tokens (confirmar que `var(--...)` nos atributos SVG funciona de facto no browser); abrir cada separador da Previsao; a tabela de concorrencia edita e guarda; consola sem erros alem do `socket.io` do mock. Medir por JavaScript quando as capturas falharem.
- [ ] **Step 3: Fora de ambito.** `/viajante/entrar` sem `data-ui` e sem mudanca.
- [ ] **Step 4: Limpar** a sessao ficticia, parar os servidores; `git status` limpo.
- [ ] **Step 5: Revisao final** da branch inteira (um revisor independente) e, so com autorizacao explicita do utilizador, fundir em `main`, empurrar e implantar o frontend como nas fases anteriores.

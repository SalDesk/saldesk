# Redesenho da app do operador, Fase 3b (Pedidos, Manutencao, Housekeeping, Menu Digital) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar as quatro paginas de Operacao que ficaram fora da Fase 3 para os componentes e o aspeto "azul da marca", **sem alterar nenhum comportamento**: os mesmos pedidos aos servicos com os mesmos dados, as mesmas acoes e os mesmos textos.

**Architecture:** O mesmo metodo da Fase 3: cada pagina e primeiro protegida por testes de caracterizacao (nenhuma tem testes hoje), que devem passar **antes** de qualquer migracao e **depois** dela; so depois se trocam filtros, tabelas, campos e modais pelos componentes `ui`. As paginas sao pequenas (260 a 674 linhas), por isso **nao se partem em ficheiros**. O aspeto novo entra pelos componentes partilhados (que ja o trazem so dentro da app do operador, via `app:`); o codigo das paginas usa as classes normais.

**Tech Stack:** React 18, Vite, Tailwind 3, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (seccoes 5.4 e 7). Plano anterior, de que este herda metodo e restricoes: `docs/superpowers/plans/2026-11-04-redesign-fase3-operacao.md`. Caminhos relativos a `frontend/`; comandos dentro de `frontend/`.

**Estado atual medido (base deste plano):**
- `pages/Pedidos.jsx` (260 linhas, restaurante): filtro de estado a mao (6 botoes), `<select>` de mesa, `<table>` a mao (Ref, Mesa, Itens, Total, Estado, Hora, acoes), modal de detalhe (`OrderDetailModal`, ja usa `Modal`), recarga automatica de 15 s.
- `pages/Maintenance.jsx` (467 linhas, rent-a-car): alertas por gravidade (cores em hexadecimal), `<table>` a mao do estado da documentacao, historico em lista, `MaintenanceModal` com 6 `<input>`, 2 `<select>`, 1 `<textarea>` a mao; grava tudo em `unit.description` (JSON) via `updateUnit`.
- `pages/Housekeeping.jsx` (388 linhas, hotel): 5 chips de estado (com ponto de cor), quartos por andar em cartoes (cores de fundo em hexadecimal), 2 `<select>` por cartao, modal de checklist **feito a mao** (`fixed inset-0`); o estado de limpeza, a atribuicao e a checklist vivem so em memoria (nao se gravam; assim fica).
- `pages/MenuDigital.jsx` (674 linhas, restaurante): separadores de categoria a mao, grelha de `DishCard`, lista de menus de degustacao, bloco do QR Code, tres modais (`Modal`); `DishForm` e `TastingMenuForm` ja usam `Input`/`Select`/`Textarea`.
- **Nenhuma tem testes.** Todo o texto esta fixo em portugues (0 chamadas a `t()`).

**Decisoes de desenho (para o utilizador rever):**
1. **Mudanca visual, nao funcional.** Nada e acrescentado ou removido; a ordem e os dados continuam os do servidor.
2. **Textos nao se traduzem nesta fase** (divida de i18n a tratar a parte). Texto **novo** usa `t()` com chaves nas quatro linguas (previsto: nenhum).
3. **Cores em hexadecimal passam a tokens** (`--success`, `--success-light`, `--error`, `--error-light`, `--warning`, `--warning-light`, `--info`, `--info-light`, ja usados pelo `Badge`). O fundo dos quartos do Housekeeping e dos alertas da Manutencao passa a tinta clara do token, sem borda colorida.
4. **O ponto de cor dos chips do Housekeeping desaparece** (o `FilterChips` nao o suporta e os componentes partilhados nao mudam); o estado continua visivel no `Badge` e no fundo de cada quarto.
5. **O modal de checklist do Housekeeping passa a `Modal`** (ganha Escape e bloqueio do scroll do fundo; mesmos botoes e mesmos efeitos).
6. **Fora de ambito, registado:** o Housekeeping envia `listReservations({ from, to })`, que o backend ignora (carrega todas as reservas; o filtro certo e `stay_from`/`stay_to`); a Pedidos nao tem vista de cartoes no telemovel (a tabela desliza dentro do cartao). Ambos ficam como estao.
7. **Verificacao visual com dados:** como o backend local nao se arranca, a Tarefa 5 usa o servidor de dados falsos descartavel (fora do repositorio).

## Global Constraints

- **Comportamento identico:** mesmos pedidos aos servicos com os mesmos argumentos e formas de dados (numeros continuam numeros; vazio continua a ser o que era), mesmas rotas e nomes de ficheiros.
- Sem emojis; icones so `lucide-react`; comentarios em portugues sem acentos; ficheiros mantem o fim de linha existente (confirmar com `file` e editar com `python`, nunca `sed -i`, nos ficheiros CRLF).
- Componentes partilhados (`ui/*`) **nao mudam**; se uma pagina precisar de algo que lhes falta, para-se e regista-se.
- Usar: `Table`, `FilterChips`, `Select`/`Input`/`Textarea` (de `ui/Input.jsx`), `Badge`, `EmptyState`, `Button`, `Modal`, `PageHeader`. Botao principal = `Button` por omissao; secundarias `variant="secondary"` ou `ghost`.
- Visual alvo: o do Dashboard e das paginas da Fase 3 (cartoes brancos, borda `n-200`, cantos de 8 px, texto de tabela 13 px, numeros `tabular-nums`, estados com `Badge`, vazios com `EmptyState`).
- Os campos do design system nao ligam a etiqueta ao campo por `htmlFor`: nos testes, localizar o campo pela etiqueta como em `Calendar.test.jsx` (`etiquetaDe`). Botoes so com icone ganham `aria-label` (nao muda comportamento).
- Testes: `fireEvent`/`findBy*`/`waitFor` (nao `user-event`); `MemoryRouter` com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; `vi.mock` estrito dos servicos; **datas em hora local, relativas a hoje, com margem de pelo menos 2 dias** (as paginas comparam datas com `new Date()`); espiar `console.error`/`console.warn` e exigir zero (excepto nos testes de servico a falhar, em que o erro registado e esperado).
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit. Linha de base: 853/853.

## Review Focus

- Uma reserva/unidade com `description` vazia ou JSON invalido nao rebenta nenhuma das paginas (cai para `{}`): testado em Manutencao e Menu Digital.
- Servicos a falhar (todos rejeitam) mostram o vazio e nao rebentam, nas quatro paginas.
- Depois de mudar o estado de um pedido, a linha e **substituida** e nao duplicada, e a recarga automatica mantem os filtros escolhidos (Pedidos).
- Quartos sem andar (`Sem andar`), saida e entrada no mesmo dia (alerta), e colaboradores a falhar (sem seletor de atribuicao) (Housekeeping).
- Operador sem `slug` mostra o aviso em vez do QR; prato sem categoria so aparece em "Todos" (Menu Digital).

---

### Task 1: Pedidos

**Files:** Modify `src/pages/Pedidos.jsx`; Test `src/__tests__/Pedidos.test.jsx`.

**Interfaces:** consome `FilterChips({ options: [{value,label}], value, onChange })`, `Select`, `Table({ columns, rows, compact })` (colunas `{ key, label, align, render }`), `EmptyState({ title })`. A tabela mantem as sete colunas (Ref, Mesa, Itens, Total a direita, Estado, Hora, acoes) e as acoes por linha (avancar, cancelar com `aria-label` `Cancelar`, ver com `aria-label` `Ver detalhes`); `statusFilter`, `unitFilter`, `carregar`, `handleAdvance`, `handleCancel` e o intervalo de 15 s nao mudam.

- [ ] **Step 1: Testes de caracterizacao (devem passar ANTES de migrar).** Mocks de `ordersService` (`listOrders`, `changeOrderStatus`) e `unitsService` (`listUnits`). Fixtures: pedidos em `received`, `preparing`, `ready`, `delivered` e `cancelled`, com `units.description` de mesa (`{"number":4}`), itens e notas. Testes: `lista_os_pedidos_com_mesa_itens_total_e_estado` (`Mesa 4`, `2x Bacalhau, 1x Agua`, `€37.50`, `Recebido`); `subtitulo_conta_os_pedidos`; `chip_de_estado_chama_listOrders_com_status` (clicar `Pronto` -> `listOrders` com `{ status: 'ready' }`; `Todos` -> `{}`); `filtro_de_mesa_envia_unit_id` (e a lista de mesas exclui `menu_item` e `tasting_menu`); `avancar_chama_changeOrderStatus_com_o_proximo_estado` (`received`->`preparing`, `preparing`->`ready`, `ready`->`delivered`) e a linha e substituida, sem duplicar; `cancelar_envia_cancelled` so em `received`/`preparing`/`ready`; `entregue_e_cancelado_nao_tem_avancar_nem_cancelar`; `ver_detalhes_abre_o_modal_com_itens_notas_e_total`; `recarrega_a_cada_15s_mantendo_o_filtro` (`vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })`, avancar 15 s, `listOrders` chamado de novo com o mesmo filtro); `sem_pedidos_mostra_o_vazio`; `servicos_a_falhar_nao_rebentam` (esperando o `console.error` do `carregar`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Pedidos.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Migrar** filtro de estado -> `FilterChips` (valores `''` e os cinco estados, mesmos rotulos), `<select>` -> `Select`, `<table>` -> `Table compact` com as colunas acima (`sortValue` nenhum), vazio -> `EmptyState` com o titulo `Sem pedidos.`. Acrescentar um teste novo: o filtro de estado e um grupo de botoes com `aria-pressed` (o escolhido a `true`).
- [ ] **Step 4: Correr.** Expected: todos PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Pedidos com o design system"`

### Task 2: Manutencao

**Files:** Modify `src/pages/Maintenance.jsx`; Test `src/__tests__/Maintenance.test.jsx`.

**Interfaces:** consome `FilterChips`, `Table({ columns, rows })`, `Input`, `Select`, `Textarea`, `EmptyState`, `Badge`. `DocCell` passa a componente **de modulo** `DocCell({ dateStr })` (hoje e declarado dentro do `map`; mesmo resultado). Os alertas (`computeAlerts`, `SEV_STYLE`) usam tokens em vez de hexadecimal; o formulario do `MaintenanceModal` mantem o mesmo estado `form` e o mesmo objeto gravado: `updateUnit(unit.id, { description: JSON.stringify({ ...meta, maintenance_history: [entry, ...history] }) })`, com as mesmas atualizacoes condicionais de `seguro_expiry`, `iuc_expiry`, `inspecao_expiry`, `next_revision_km` e `current_km`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Mocks de `unitsService` (`listUnits`, `updateUnit`). Viaturas com `description` JSON (marca, matricula, validades relativas a hoje: -3 dias = `Expirado`, +5 = `Urgente`, +20 = `Atencao`, +60 = sem alerta; `current_km`/`next_revision_km`). Testes: `alertas_ordenados_por_gravidade_com_texto_de_dias` (`expirado ha 3 dias`, `expira em 5 dias`); `alerta_de_revisao_por_km` (`atrasada 120km` e `em 300km`); `chips_filtram_urgentes_e_atencao` (rotulos `Todos (n)`, `Urgentes (n)`, `Atencao (n)`); `sem_alertas_mostra_toda_a_frota_em_dia`; `tabela_de_documentacao_mostra_datas_e_km` (`12.000 km` conforme o `toLocaleString` do ambiente: comparar com `Number(...).toLocaleString()`); `historico_ordenado_por_data_com_total_de_custo`; `registar_intervencao_grava_a_descricao_com_o_historico_novo` (preencher viatura, tipo `Seguro`, data, `next_date`; `updateUnit` chamado com o `id` e uma `description` cujo JSON tem `maintenance_history[0]` com `tipo`, `unit_id`, `date`, `next_date` e `seguro_expiry` igual a `next_date`); `registar_desactivado_sem_viatura`; `description_invalida_ou_vazia_nao_rebenta` (uma viatura com `description: '{'` e outra `null`); `servicos_a_falhar_nao_rebentam`. Ids/datas gerados (`Date.now`, `created_at`) comparam-se com `expect.any`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Maintenance.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Migrar** chips -> `FilterChips`; caixas de alerta e de "frota em dia" -> tinta clara dos tokens (sem hexadecimal, sem borda colorida); `<table>` a mao -> `Table` (colunas Viatura, Seguro, IUC, Inspecao, Km actual, Prox. revisao); historico mantem a lista mas com tokens no lugar de `text-[#1A7A4A]`; vazio -> `EmptyState`; campos do modal -> `Input`/`Select`/`Textarea` com as mesmas etiquetas, tipos, `step`, `placeholder` e `rows`. Teste novo: nenhuma classe com `#` hexadecimal sobra no HTML renderizado da pagina (`container.innerHTML` nao contem `[#`).
- [ ] **Step 4: Correr.** Expected: todos PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Manutencao com o design system"`

### Task 3: Housekeeping

**Files:** Modify `src/pages/Housekeeping.jsx`; Test `src/__tests__/Housekeeping.test.jsx`.

**Interfaces:** consome `FilterChips`, `Select`, `Modal({ open, onClose, title, size: 'sm', footer })`, `EmptyState`, `Badge`, `Button`. `HK[estado]` passa de `{ label, badge, dot, bg }` com hexadecimal para a mesma forma com classes de token (`clean` -> `--success-light`/`--success`, `dirty` -> `--error-light`/`--error`, `cleaning` -> `ocean-50`/`ocean-500`, `inspection` -> `--warning-light`/`--warning`, `blocked` -> `n-50`/`n-300`). `computeInitialHK`, `computePriority`, `groupByFloor`, os estados `hkStates`, `assignments`, `checklists`, `collapsed`, `filterState` e o pedido inicial (`listUnits`, `listReservations`, `api.get('/staff')`) nao mudam.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Mocks de `unitsService.listUnits`, `reservationsService.listReservations` e do modulo `services/api` (`{ default: { get } }`). Quartos com `description` `{"floor":2,"view":"Mar"}`, um sem andar, um `maintenance`, um `inactive` (nao aparece), reservas de hoje (`TODAY` calculado com `toLocaleDateString('en-CA')`): uma `checked_in` com saida hoje (-> `Sujo`), outra com entrada hoje no mesmo quarto (-> `Saida + Entrada` e o alerta). Testes: `quartos_agrupados_por_andar_e_sem_andar` (`Andar 2`, `Sem andar`); `estado_inicial_por_unidade_e_reserva` (`Bloqueado`, `Sujo`, `Limpo`); `ordem_por_prioridade` (double, urgent, occupied, vacant); `chips_mostram_contagens_e_filtram` (`Todos (n)`, `Sujos (n)`; aria-pressed); `alerta_de_saida_e_entrada_no_mesmo_dia`; `mudar_estado_pelo_seletor_actualiza_badge_e_contagens`; `atribuir_colaborador_so_com_colaboradores` (sem seletor quando `/staff` falha ou vem vazio); `checklist_abre_marca_itens_e_mostra_progresso` (`1/8`); `marcar_como_limpo_poe_o_quarto_limpo_e_fecha`; `fechar_nao_altera_o_estado`; `recolher_andar_esconde_os_quartos`; `sem_quartos_mostra_o_vazio`; `servicos_a_falhar_nao_rebentam`; `listReservations_e_chamado_uma_vez` (sem fixar os argumentos).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Housekeeping.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Migrar** chips -> `FilterChips` (rotulos iguais, sem ponto); cartao de quarto -> fundo e ponto pelos tokens; os dois `<select>` -> `Select`; modal de checklist -> `Modal` com o mesmo titulo (nome do quarto), os mesmos oito itens com caixas e os botoes `Fechar` e `Marcar como Limpo` no rodape; aviso de saida/entrada -> tinta `--error-light`; vazio -> `EmptyState`. Testes novos: `Escape_fecha_a_checklist`; nenhuma classe hexadecimal sobra no HTML.
- [ ] **Step 4: Correr.** Expected: todos PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Housekeeping com o design system"`

### Task 4: Menu Digital

**Files:** Modify `src/pages/MenuDigital.jsx`; Test `src/__tests__/MenuDigital.test.jsx`.

**Interfaces:** consome `FilterChips`, `EmptyState({ icon, title, action })`, `Button`, `Badge`. `DishCard` mantem as props `{ dish, onEdit, onDelete, onToggleAvailable, onSubmitConect }`; os tres botoes de icone ganham `aria-label` (`Alternar disponibilidade`, `Editar`, `Eliminar`). `buildDishPayload`, `DishForm`, `TastingMenuForm`, `handleSave`, `handleDelete`, `handleToggleAvailable`, `handleSubmitConect`, `copyMenuUrl` e `downloadQrCode` nao mudam.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Mocks de `unitsService` (`listUnits`, `createUnit`, `updateUnit`, `deleteUnit`, `updateConectStatus`), `services/api` (`get`), `useAuthStore` (`operator.slug`) e `ImageUploader`/`ConectRow` simples. Fixtures: pratos (`menu_item`) com `description` JSON (categoria, alergenios, dietas, `featured`, `daily_special` do dia de hoje), um indisponivel (`status: 'inactive'`), um sem categoria, um com `description` invalida, e um menu de degustacao (`tasting_menu`). Testes: `lista_so_pratos_e_conta_nos_rotulos` (`Todos (n)`, `Entradas (n)`); `separador_de_categoria_filtra` e `prato_sem_categoria_so_em_todos`; `cartao_mostra_preco_etiquetas_prato_do_dia_e_estrela`; `novo_prato_chama_createUnit_com_o_payload_de_buildDishPayload` (nome, `description` JSON, `unit_type: 'menu_item'`, `base_price` numerico, `price_unit: 'person'`, `capacity: 1`, `status`, `images`) e o prato entra no topo da lista; `editar_chama_updateUnit_com_o_id`; `eliminar_pede_confirmacao_e_chama_deleteUnit`; `alternar_disponibilidade_envia_status_e_is_active` (`inactive`<->`active`); `submeter_ao_conect_envia_pending_review_ou_draft`; `menu_de_degustacao_aparece_com_itens_e_o_criar_chama_createUnit` (ler `TastingMenuForm` para o payload); `copiar_url_escreve_a_ligacao_do_menu` (`navigator.clipboard.writeText` com `https://saldesk.cv/book/<slug>`); `descarregar_qr_pede_o_blob` (`api.get('/marketing/qrcode', { responseType: 'blob' })`); `sem_slug_mostra_o_aviso_em_vez_do_qr`; `sem_pratos_mostra_o_vazio_com_acao`; `servicos_a_falhar_nao_rebentam`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/MenuDigital.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Migrar** separadores -> `FilterChips`; etiquetas de dietas/alergenios -> tinta dos tokens; vazio -> `EmptyState` com `icon={ChefHat}`, titulo `Nenhum prato nesta categoria.` e o botao `Adicionar prato`; botao do QR -> `Button`; `aria-label` nos botoes de icone; menus de degustacao e QR em cartoes iguais aos das outras paginas. Teste novo: os separadores sao um grupo com `aria-pressed`; nenhuma classe hexadecimal sobra.
- [ ] **Step 4: Correr.** Expected: todos PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Menu Digital com o design system"`

### Task 5: Verificacao no browser com dados falsos

**Files:** nenhum no repositorio; estender **fora do repositorio** o `mock-api.js` da diretoria de scratch (porta 3001; o `frontend/.env` ja aponta para la). **Nao arrancar o backend real.**

- [ ] **Step 1: Dados.** Acrescentar rotas: `GET /orders` (pedidos do restaurante nos cinco estados) e `PATCH /orders/:id/status`; unidades `menu_item` e `tasting_menu` (restaurante), quartos com `floor` (hotel) e viaturas com validades e km (rent-a-car); `GET /staff` com colaboradores; `GET /marketing/qrcode` (blob pequeno). Sessao ficticia no `localStorage` (`saldesk-auth`) com token `fake-restaurant`, `fake-hotel` e `fake-rentacar` conforme a pagina.
- [ ] **Step 2: Ver** `/pedidos`, `/menu-digital` (restaurante), `/housekeeping` (hotel) e `/manutencao` (rent-a-car) a 1280 px e 375 px: tabelas sem overflow a 1280 px; sem scroll horizontal da pagina a 375 px; abrir cada modal; consola sem erros alem dos esperados. Medir por JavaScript quando as capturas falharem.
- [ ] **Step 3: Fora de ambito.** `/viajante/entrar` e `/book/<slug>` sem `data-ui` e sem mudanca.
- [ ] **Step 4: Limpar** a sessao ficticia, parar os servidores; `git status` limpo.
- [ ] **Step 5: Revisao final** da branch inteira (um revisor independente) e, so com autorizacao explicita do utilizador, fundir em `main`, empurrar e implantar o frontend como nas fases anteriores.

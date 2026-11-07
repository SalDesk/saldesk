# Redesenho da app do operador, Fase 5c (Gestao: Colaboradores e detalhe) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar as paginas Colaboradores (`Staff.jsx`, 1476 linhas) e detalhe do colaborador (`StaffDetail.jsx`, 554 linhas) para os componentes e o aspeto "azul da marca", **sem alterar nenhum comportamento**: os mesmos pedidos aos servicos com os mesmos argumentos, as mesmas contas e os mesmos textos.

**Architecture:** O mesmo metodo das Fases 3 a 5b. `Staff.jsx` e primeiro protegido por testes que o renderizam por inteiro e **partido em ficheiros por mudanca literal** (a divisao da Fase 3 e da 5b); `StaffDetail.jsx` nao se parte (554 linhas, como as paginas da 5a). Depois, area a area, escrevem-se testes de caracterizacao que passam **antes** de migrar, testes novos de design system que falham (RED), e so entao se trocam separadores, campos, cartoes e estados vazios pelos componentes `ui` e as cores em hexadecimal ou nomeadas por tokens.

**Tech Stack:** React 18, Vite, Tailwind 3, socket.io-client, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (seccoes 5.4 e 7, Fase 5). Planos anteriores, de que este herda metodo e restricoes: `docs/superpowers/plans/2026-11-07-redesign-fase5b-financeiro.md` (divisao literal, helpers de teste em `src/__tests__/helpers/`, `aria-label` duplicado nos campos com etiqueta) e `docs/superpowers/plans/2026-11-06-redesign-fase5a-gestao.md`. Caminhos relativos a `frontend/`; comandos dentro de `frontend/`. Seguinte: Fase 6 (Crescimento e Configuracao).

**Estado atual medido (base deste plano):**
- `pages/Staff.jsx`: 1476 linhas, **CRLF**. Quatro separadores (Colaboradores, Checklist, Tarefas, Chat) mais a seccao "Vendedores de Praia" e dois modais (criar/editar e eliminar). Sub-componentes na propria pagina: `StaffAvatar`, `StaffCard`, `StaffForm` (244 linhas), `TaskCard`+`KanbanBoard` (275), `ChecklistTab` (140), `MessageBubble`+`ChatTab` (354, com `socket.io-client`).
- `pages/StaffDetail.jsx`: 554 linhas, CRLF. Quatro separadores (Ferias, Salario, Documentos, Certificacoes), cada um uma funcao na propria pagina; `UploadButton` partilhado por Documentos e Certificacoes.
- Escritos a mao: dois grupos de separadores (um em "pilula" cinzenta com insignia vermelha de nao lidas), ~12 `<input>`/`<select>` soltos (pesquisa, competencias, comissao, zona, filtro das tarefas, nova tarefa, mensagem do chat), interruptor "Criar conta /staff", ~25 botoes de icone, cartoes e vazios soltos, 4 hexadecimais (`#1A7A4A`, `#ECFDF5`, `#FFF7E6`), ~30 cores nomeadas (`yellow-*`, `red-*`, `green-*`, `amber-*`), 14 usos de `text-error`/`bg-error`/`border-error`.
- **`sand-700` e `sand-200` nao existem no Tailwind** (`tailwind.config.js` so define `sand` 600, 500, 400, 300, 100 e 50): `text-sand-700`, `border-sand-200` e `bg-sand-200` nao geram CSS (o texto do selo "Vendedor", a borda do cartao do vendedor e a do aviso de limite aparecem sem cor). A migracao usa tokens que existem.
- Servicos: `staffService` (`listStaff`, `createStaff`, `updateStaff`, `deleteStaff`, `createStaffAccount`, `getStaff`, `listLeave`, `createLeave`, `updateLeaveStatus`, `getLeaveBalance`, `setLeaveBalance`, `listDocuments`, `createDocument`, `deleteDocument`, `listCertifications`, `createCertification`, `deleteCertification`), `assignmentService`, `reservationsService.listReservations`, `messageService`, `sellerService`, `unitsService.listUnits` (import dinamico no `StaffForm`), `expensesService` (`getSalaryConfig`, `getSalaryPayments`), `uploadService` (`uploadDocument`, `validateDocumentFile`), `toastStore.useToast`, `authStore` (`operator`, `token`), `usePlan`. Lista de tarefas do dia em `localStorage` (`saldesk_checklist_v1`) e mensagens fixadas em `saldesk_pins_<id>`.
- **Nenhuma das duas tem testes.** Texto fixo em portugues.

**Decisoes de desenho (para o utilizador rever):**
1. **Mudanca visual, nao funcional.** Nada e acrescentado ou removido; `window.confirm` do pagamento de comissoes mantem-se.
2. **Divisao literal de `Staff.jsx`** para `pages/staff/`: `shared.jsx` (constantes `ROLES_BY_TYPE`, `ROLES_DEFAULT`, `SELLER_ZONES`, `DAYS`, `PRIO`, `PRIO_COLORS`, `CHECKLIST_KEY`, `STARTER_STAFF_LIMIT`, `DEFAULT_TASKS`, `KANBAN_COLS`, `tryParseNotes` e o componente `StaffAvatar`), `StaffCard.jsx`, `StaffForm.jsx`, `KanbanBoard.jsx` (com `TaskCard`), `ChecklistTab.jsx`, `ChatTab.jsx` (com `MessageBubble`); `Staff.jsx` fica com a pagina (menos de 350 linhas). Fim de linha CRLF nos ficheiros novos.
3. **Separadores:** os quatro de `Staff` e os quatro de `StaffDetail` passam a `Tabs` (perdem os icones); a insignia de nao lidas do Chat passa ao contador do `Tabs` (`count`, "9+" acima de 9, ausente quando 0).
4. **Cores:** hexadecimal, cores nomeadas e `text-error`/`bg-error`/`border-error` passam a tokens (`--success`, `--warning`, `--error`, `--info` e `-light`, `--ocean-*`, `--sand-*`, `--n*`); nos atributos de cor em CSS inline usa-se `var(--token)`. `#FFF7E6` -> `--sand-50`; selo "Vendedor" -> `Badge variant="direct"`; aviso de limite Starter -> `--sand-50`/`--sand-300`/`n-800`.
5. **Campos:** pesquisa, competencias, comissao, zona, filtro das tarefas, nova tarefa do checklist, mensagem do chat e formularios dos modais passam a `Input`/`Select`/`Textarea`; os que tem etiqueta visivel levam tambem `aria-label` igual (o `ui/Input` nao associa a etiqueta); o interruptor "Criar conta /staff" passa a `Toggle`. Os botoes de icone ganham `aria-label` (os que tinham so `title` ficam com os dois).
6. **Cartoes e vazios:** cartoes do colaborador, do vendedor, da tarefa e da lista do checklist em `Card`; vazios (`Sem colaboradores registados`, listas do detalhe) em `EmptyState`. Os dias do horario e as tags de tours do vendedor continuam botoes com tokens (`FilterChips` e de escolha unica).
7. **Fora de ambito, registado (ja existentes, ficam como estao e os testes fixam):** (a) a seccao "Vendedores de Praia" chama `listSellerCommissions(id)` (assincrona) durante o render e le a promessa, por isso "Comissoes mes" e "Por pagar" mostram sempre €0, "Registar pagamento" nunca aparece e ha um pedido por vendedor a cada render; (b) `StaffForm` arranca com `skills` e `schedule` vazios mesmo ao editar (guardar envia `[]`); (c) `ChecklistTab` usa a data UTC (`toISOString`) e a hora local; (d) `ChatTab`/`KanbanBoard` registam falhas em `console.error`; (e) `ExpiryBadge` (partilhado com o portal da equipa) mantem `text-amber-600`; (f) `s.name.toLowerCase()` na pesquisa rebenta com um colaborador sem nome; (g) o separador Chat duplica a pagina Mensagens (migrada na Fase 4).
8. **Verificacao visual com dados:** Tarefa 9, com o servidor de dados falsos descartavel (fora do repositorio).

## Global Constraints

- **Comportamento identico:** mesmos pedidos aos servicos com os mesmos argumentos, mesmas contas, mesmos textos, mesmas rotas, `export default function Staff` e `export default function StaffDetail`.
- Sem emojis; icones so `lucide-react`; comentarios em portugues sem acentos; **os ficheiros mantem o fim de linha existente** (CRLF; `file`/`grep -c $'\r$'` para confirmar; editar com `python` a partir de um ficheiro de script na diretoria de scratch, que normaliza `\r\n`->`\n` e repoe no fim; nunca `sed -i` nos CRLF; **nunca escrever `\b` num `str` Python nao crua**; scripts Python escritos com a ferramenta Write, nao com heredoc com aspas).
- Componentes `ui/*` **nao mudam**; usar `Tabs`, `Input`, `Select`, `Textarea`, `Toggle`, `EmptyState`, `Button`, `Card`, `Badge`, `Modal`, `PageHeader`. `UpgradeModal` (de `PlanGuard`) e `ExpiryBadge` ficam como estao.
- Visual alvo: o do Dashboard e das fases anteriores (cartoes brancos, borda `n-200`, cantos de 8 px, estados com tokens, vazios com `EmptyState`).
- Testes: `fireEvent`/`findBy*`/`waitFor` (nao `user-event`); `MemoryRouter` com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; `vi.mock` estrito dos servicos; **`socket.io-client` simulado** como em `Messages.test.jsx` (`vi.hoisted` com `handlers`/`disconnect`, o teste dispara `message:new`); `authStore` simulado (`operator`, `getState().token`); `usePlan` real com `authStore` simulado (`plan`); `useToast` real com `useToastStore.getState().toasts`; **datas em hora local, relativas a hoje, com margem de dias** (Cabo Verde e UTC-1); relogio so de `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) onde a hora importa; `window.confirm` espiado; a guarda de `console.error`/`console.warn` le as contagens **antes** de restaurar os espioes (os testes de falha de Kanban/Chat declaram os erros esperados). Helpers partilhados em `src/__tests__/helpers/` (acrescentar o que faltar).
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit. Linha de base: 1285/1285 (62 ficheiros). Trabalhar numa branch `redesign/fase5c-colaboradores`.

## Review Focus

- **Limite do plano Starter:** com `plan === 'starter'` e 2 colaboradores, "Novo colaborador" abre o aviso de upgrade em vez do formulario, `handleSave` em modo criar volta a verificar e mostra o upgrade; nos outros planos nao ha limite nem aviso; o subtitulo muda de formato.
- **Criar colaborador e conta de acesso:** `createStaff(dados)` com `commission_pct` numero ou `null`, `create_access` so cria conta se houver email, as duas mensagens de toast (sucesso e "conta falhou"), erro do servidor no formulario; "Criar conta" do cartao so aparece com email e sem `user_id`.
- **Tarefas:** estados e servicos certos em cada movimento (`pending`->`startAssignment`, `in_progress`->`completeAssignment`, bloquear->`cancelAssignment`), `confirmed` conta na coluna Em Progresso, tarefa atrasada so se tem prazo passado e nao esta concluida/bloqueada, criar exige reserva, `notes_manager` e o JSON com os campos, falhas mostram o toast.
- **Chat e tempo real:** so entram mensagens relevantes da conversa aberta (grupo ou direto), sem duplicar as que o proprio envio ja acrescentou, mensagens fixadas gravam em `saldesk_pins_<id>`, broadcast envia uma mensagem direta por colaborador, o socket desliga ao sair do separador.
- **Dados em falta:** colaborador sem telefone/email/foto/avaliacao, tarefa com `notes_manager` que nao e JSON ou nulo, reserva sem unidade, listas vazias, saldo de ferias sem direito nem sugestao, configuracao salarial ausente, pagamentos de outro colaborador: travessao ou vazio, nunca excecao.

---

### Task 1: Rede de seguranca da pagina Colaboradores e divisao literal do ficheiro

**Files:** Create `src/pages/staff/shared.jsx`, `StaffCard.jsx`, `StaffForm.jsx`, `KanbanBoard.jsx`, `ChecklistTab.jsx`, `ChatTab.jsx`; Modify `src/pages/Staff.jsx`; Create `src/__tests__/helpers/staffFixtures.js`; Test `src/__tests__/Staff.test.jsx`.

**Interfaces:** cada ficheiro exporta por omissao o seu componente com as **mesmas props de hoje** (`StaffCard({ member, onEdit, onDelete, onCreateAccount, creatingAccountId })`, `StaffForm({ member, onSave, onCancel, loading, error, roles })`, `KanbanBoard({ staffList })`, `ChecklistTab()`, `ChatTab({ staffList })`); `shared.jsx` exporta por nome as constantes, `tryParseNotes` e `StaffAvatar`. Cada ficheiro importa so o que usa. Servicos mockados: os listados no estado medido, `socket.io-client`, `authStore` (`operator: { id, operator_type: 'activity', plan }`).

- [ ] **Step 1: Criar a branch e escrever o teste da pagina inteira (verde ANTES de mover).** `staffFixtures.js` com colaboradores (guia activo com email e conta, instrutor inactivo, vendedor de praia), atribuicoes (pendente, em curso, concluida, bloqueada, uma atrasada), reservas, grupos e mensagens. Testes: `lista_os_colaboradores_com_o_subtitulo_e_o_contador`; `abre_cada_separador_sem_rebentar` (Checklist, Tarefas, Chat e volta); `novo_colaborador_abre_o_formulario_e_cria_com_createStaff`; `editar_abre_o_formulario_com_os_valores_e_guarda_com_updateStaff`; `eliminar_pede_confirmacao_e_chama_deleteStaff`; `no_plano_starter_com_2_colaboradores_mostra_o_aviso_e_o_upgrade`; `criar_conta_do_cartao_chama_createStaffAccount_e_avisa`; `a_seccao_vendedores_de_praia_aparece_so_com_vendedores`; `sem_colaboradores_mostra_o_vazio`; `o_contador_de_nao_lidas_aparece_no_separador_chat`; `o_socket_liga_ao_abrir_o_chat_e_desliga_ao_sair`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Staff.test.jsx`. Expected: PASS antes de qualquer movimento.
- [ ] **Step 3: Mover literalmente** (intervalos de linhas com shell, sem retranscrever; so acrescentar `import`/`export default`; `diff` dos corpos contra o original vazio; verificar identificadores indefinidos com um analisador `@babel/parser`+`@babel/traverse` com controlo negativo, como na 5b).
- [ ] **Step 4: Correr.** `npx vitest run` e `npm run build`. Expected: tudo passa; `pages/Staff.jsx` com menos de 350 linhas; CRLF em todos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "refactor: dividir Colaboradores em ficheiros por responsabilidade"`

### Task 2: Estrutura da pagina e separador Colaboradores

**Files:** Modify `src/pages/Staff.jsx`, `src/pages/staff/StaffCard.jsx`, `src/pages/staff/shared.jsx` (`StaffAvatar`); Test `src/__tests__/StaffColaboradores.test.jsx`.

**Interfaces:** consome `Tabs({ tabs: [{id,label,count}], value, onChange })`, `Card`, `Badge`, `Input`, `EmptyState`. Ids: `staff`, `checklist`, `tasks`, `chat`; rotulos `Colaboradores`, `Checklist`, `Tarefas`, `Chat`. Cartoes: `StaffCard` em `Card padding="p-4"`, estado activo `--success`, "Conta activa" `--success`, selo `Badge variant="direct"`, botoes `aria-label` `Ferias, documentos e certificacoes` (o `title` actual), `Editar <nome>` e `Eliminar <nome>`, "Criar conta" mantem o texto; `StaffAvatar` com a bolinha de estado `bg-[var(--success)]`/`bg-n-300`. Seccao Vendedores: `Card`, caixa de pendentes `--warning-light`/`--warning`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** `pesquisa_so_aparece_com_mais_de_3_colaboradores_e_filtra_por_nome_ou_cargo`; `cartao_mostra_nome_cargo_telefone_email_trabalhos_avaliacao_e_estado` (avaliacao so se > 0; iniciais sem foto); `criar_conta_so_com_email_e_sem_user_id_e_mostra_a_conta_activa`; `a_conta_a_criar_desactiva_o_botao_e_mostra_A criar conta...`; `falha_ao_criar_conta_mostra_o_erro_do_servidor_ou_Erro ao criar conta`; `subtitulo_starter_e_dos_outros_planos`; `o_aviso_de_limite_so_no_starter_com_2_ou_mais_e_Fazer upgrade_abre_o_UpgradeModal`; `eliminar_confirma_com_o_nome_e_cancelar_fecha`; `vendedores_mostram_zona_percentagem_e_os_totais_a_zero` (fixa a decisao 7a: `listSellerCommissions` e chamada e os totais ficam €0, sem "Registar pagamento"); `listStaff_a_falhar_nao_rebenta_e_mostra_o_vazio`; `colaborador_sem_dados_opcionais_nao_rebenta`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/StaffColaboradores.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: `role="tablist"` com `aria-selected`, o contador do Chat (`count`) com "9+"; botoes de icone com nome acessivel; pesquisa com `aria-label`; vazio com `EmptyState`; nenhum hexadecimal, `green-`, `yellow-`, `red-`, `text-error` nem `sand-700`/`sand-200` no HTML do separador (com vendedor e banner). Migrar como acima.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Colaboradores com o design system"`

### Task 3: Formulario do colaborador

**Files:** Modify `src/pages/staff/StaffForm.jsx`; Test `src/__tests__/StaffForm.test.jsx`.

**Interfaces:** consome `Input`, `Select`, `Toggle`, `Button`. Campos com `label` e `aria-label` iguais (`Nome completo`, `Cargo`, `Estado`, `Telefone`, `Email`, `WhatsApp`, `Data de admissao`, `Comissao (%)`, `Zona de actuacao`); campo de competencias `Input aria-label="Competencias e certificacoes"` (Enter acrescenta); caixa do vendedor `bg-[var(--sand-50)] border-[var(--sand-300)]`; "Criar conta /staff" em `Toggle`; erro `--error-light`/`--error`. Servicos mockados: `unitsService.listUnits`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** `criar_envia_os_campos_com_commission_pct_null_quando_vazio_e_create_access_false`; `editar_nao_mostra_conta_de_acesso_e_mostra_o_estado`; `cargo_anterior_fora_da_lista_aparece_como_cargo_anterior`; `os_cargos_dependem_do_tipo_de_operador` (activity, hotel, rentacar, restaurant, desconhecido -> Administracao e Gestor/Supervisor); `competencias_acrescentam_com_Enter_sem_duplicar_e_removem`; `dias_do_horario_alternam_e_vao_no_pedido`; `ao_editar_skills_e_schedule_arrancam_vazios` (fixa a decisao 7b); `vendedor_mostra_comissao_zona_e_carrega_os_tours_com_listUnits` (so se o cargo e Vendedor de Praia; `seller_tour_ids` por tour; texto "todos" ou "N seleccionado(s)"); `comissao_vai_como_numero`; `criar_conta_com_o_interruptor_mostra_o_aviso`; `erro_e_o_estado_de_a_guardar_aparecem`; `foto_escolhida_mostra_a_pre_visualizacao` (FileReader simulado).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/StaffForm.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: todos os campos tem nome acessivel (`getByLabelText`); o interruptor e o `Toggle` (`create_access: true` vai no pedido); nenhum hexadecimal, cor nomeada ou `text-error` (excepto o asterisco do `ui/Input`); nenhum `<input>`/`<select>` escrito a mao (so o ficheiro escondido da foto). Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: formulario de colaborador com o design system"`

### Task 4: Tarefas (Kanban)

**Files:** Modify `src/pages/staff/KanbanBoard.jsx`, `src/pages/staff/shared.jsx` (`PRIO_COLORS`, `KANBAN_COLS`); Test `src/__tests__/StaffTarefas.test.jsx`.

**Interfaces:** `PRIO_COLORS` = `{ low: 'text-n-500 bg-n-100', medium: 'text-[var(--warning)] bg-[var(--warning-light)]', high: 'text-[var(--error)] bg-[var(--error-light)]', urgent: 'text-white bg-[var(--error)]' }`; `KANBAN_COLS[].color` em tokens (pendente `warning`, em progresso `ocean`, concluida `success`, bloqueada `error`); filtro `Select aria-label="Filtrar por colaborador"`; tarefa atrasada `border-[var(--error)]`/`text-[var(--error)]`; aviso de atraso `--error-light`; formulario da tarefa com `aria-label` nos seis campos. Servicos mockados: `assignmentService`, `reservationsService.listReservations`, `useToast` real.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** `agrupa_as_tarefas_por_coluna_e_confirmed_conta_em_progresso`; `titulo_vem_do_json_ou_do_texto_ou_da_atribuicao_com_o_fim_do_id`; `prioridade_por_omissao_media_e_as_quatro_etiquetas`; `tarefa_atrasada_so_com_prazo_passado_e_nao_concluida_nem_bloqueada` (aviso global e "Atrasada"); `mover_chama_o_servico_certo_e_muda_a_coluna` (pendente->start, em progresso->complete); `falha_ao_mover_mostra_o_toast_e_nao_muda` (erros de consola esperados); `filtro_por_colaborador_e_contador`; `abrir_a_tarefa_mostra_o_detalhe_e_as_accoes_por_estado` (Iniciar so pendente, Concluir pendente/confirmed/em progresso, Bloquear excepto bloqueada); `criar_exige_reserva_e_envia_notes_manager_em_json` (checklist por linhas, staff_id nulo se vazio); `falha_ao_criar_mostra_o_toast`; `reservas_canceladas_nao_aparecem_na_lista`; `sem_tarefas_mostra_Sem tarefas_em_cada_coluna`; `notes_manager_nulo_ou_invalido_nao_rebenta`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/StaffTarefas.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: o filtro e os campos do modal tem nome acessivel; as cores das colunas e das prioridades sao tokens (`var(--`); nenhum hexadecimal, `yellow-`, `green-`, `red-`, `text-error`, `bg-error` ou `border-error`; botoes de mover com texto "Mover para X" mantem o nome. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Tarefas de Colaboradores com o design system"`

### Task 5: Checklist do dia

**Files:** Modify `src/pages/staff/ChecklistTab.jsx`; Test `src/__tests__/StaffChecklist.test.jsx`.

**Interfaces:** lista em `Card padding="p-0"`; alerta `--warning-light`/`--warning`; "Tudo concluido" `--success-light`/`--success`; marca de concluido `text-[var(--success)]`; botao de configurar `aria-label="Configurar checklist"`; remover `aria-label="Remover tarefa - <texto>"`; nova tarefa `Input aria-label="Nova tarefa"`; botao `Adicionar`. A caixa de selecao continua `<input type="checkbox">` dentro do `label`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Com `Date` simulada: `mostra_as_tarefas_por_omissao_e_o_contador`; `marcar_grava_em_localStorage_com_a_hora_e_desmarcar_remove`; `tudo_concluido_mostra_o_selo`; `alerta_so_depois_das_8h_com_tarefas_por_completar` (7h e 8h); `a_barra_de_progresso_segue_a_percentagem`; `configurar_abre_o_painel_e_adicionar_com_Enter_ou_botao_grava`; `adicionar_texto_vazio_nao_faz_nada`; `remover_tarefa_grava_a_lista`; `sem_tarefas_mostra_o_texto`; `le_o_que_estava_guardado_e_ignora_json_invalido`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/StaffChecklist.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: botoes com nome acessivel; o campo "Nova tarefa" e o `Input`; nenhum hexadecimal, `yellow-`, `green-`, `text-error`, `bg-red-50`. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Checklist de Colaboradores com o design system"`

### Task 6: Chat

**Files:** Modify `src/pages/staff/ChatTab.jsx`; Test `src/__tests__/StaffChat.test.jsx`.

**Interfaces:** consome `Input`, `Button`, `Modal`, `EmptyState`. Botoes de icone com `aria-label`: `Broadcast`, `Novo grupo`, `Responder`, `Fixar`/`Desafixar`, `Enviar`; caixa de mensagem `Input aria-label="Escrever mensagem"`; aviso do broadcast `--sand-50`/`--sand-300`/`n-800`; conversa por escolher com `EmptyState icon={MessageSquare} title="Seleccionar uma conversa"`. As bolhas, a barra de fixadas e a pre-visualizacao de resposta mantem as classes de token existentes. Servicos mockados: `messageService`, `socket.io-client` (como `Messages.test.jsx`), `authStore`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** `lista_grupos_e_colaboradores_e_pede_listGroups`; `escolher_uma_conversa_pede_as_mensagens_com_group_id_ou_recipient_id`; `enviar_chama_sendMessage_com_o_payload_certo_e_nao_duplica_com_o_socket` (grupo e direto, `reply_to_id`); `message:new_so_entra_se_for_da_conversa_aberta` (grupo, direto do outro, direto do proprio operador, de outra conversa, sem conversa); `mensagens_proprias_e_alheias_com_nome_hora_e_resposta`; `fixar_grava_em_localStorage_e_mostra_a_barra_e_o_contador` e `ao_abrir_a_conversa_restaura_as_fixadas`; `responder_mostra_a_pre_visualizacao_e_cancelar_limpa`; `novo_grupo_chama_createGroup_e_acrescenta`; `broadcast_envia_uma_mensagem_directa_por_colaborador_e_fecha`; `falha_ao_listar_mensagens_mostra_sem_mensagens`; `falhas_de_envio_e_de_grupo_nao_rebentam` (erros de consola esperados); `o_socket_e_criado_com_o_token_e_desliga_ao_desmontar`; `sem_mensagens_mostra_Sem mensagens ainda`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/StaffChat.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: os botoes de icone e a caixa de mensagem tem nome acessivel; o vazio e o `EmptyState`; os campos dos modais tem nome acessivel; nenhum hexadecimal, `sand-200`, `sand-600` no aviso nem cor nomeada; o botao de enviar continua desactivado sem texto. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Chat de Colaboradores com o design system"`

### Task 7: Detalhe do colaborador, estrutura, Ferias e Salario

**Files:** Modify `src/pages/StaffDetail.jsx`; Test `src/__tests__/StaffDetail.test.jsx`.

**Interfaces:** consome `Tabs` (ids `ferias`, `salario`, `documentos`, `certificacoes`; rotulos `Ferias`, `Salario`, `Documentos`, `Certificacoes`), `Card`, `Input`, `Select`, `Textarea`, `EmptyState`, `Badge` (mantem `LEAVE_BADGE`). Cartoes de resumo e de linha (pedidos, pagamentos) em `Card`; caixas `bg-amber-50 border-amber-200` -> `--warning-light`/`--warning`; `text-error` do botao Rejeitar -> `text-[var(--error)]`; vazios (`Sem pedidos registados.`, `Sem pagamentos registados.`) com `EmptyState`; campos dos modais com `aria-label`; os botoes `Aprovar`, `Rejeitar`, `Eliminar` mantem o nome. `ExpiryBadge` fica. Servicos mockados: `staffService`, `expensesService`, `uploadService`, `useParams` real em `MemoryRouter` (`/colaboradores/s1`), `useToast` real.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** `mostra_o_nome_e_o_cargo_do_colaborador_ou_Colaborador`; `voltar_navega_para_colaboradores`; `ferias_mostra_direito_usados_restantes_e_os_pedidos` (`daysBetween` inclusivo; tipo desconhecido tal e qual); `sem_direito_mostra_a_sugestao_ou_a_instrucao`; `configurar_direito_chama_setLeaveBalance_com_o_ano_e_numero_e_recarrega`; `novo_pedido_exige_datas_chama_createLeave_e_avisa`; `aprovar_e_rejeitar_chamam_updateLeaveStatus_e_avisam`; `falhas_mostram_os_toasts` (carregar, criar, actualizar, guardar saldo); `salario_calcula_custo_total_inps_e_pago_no_ano` (so pagamentos do colaborador, ordenados por ano e mes desc); `sem_configuracao_salarial_mostra_a_instrucao_com_ligacao_ao_financeiro`; `sem_pagamentos_mostra_o_vazio`; `getStaff_a_falhar_nao_rebenta`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/StaffDetail.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: `role="tablist"` com `aria-selected`; os campos dos modais tem nome acessivel; vazios com `EmptyState`; nenhum hexadecimal, `amber-`, `text-error` (excepto o asterisco do `ui/Input`) em Ferias e Salario. Migrar a estrutura, Ferias e Salario.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: detalhe do colaborador (estrutura, Ferias e Salario) com o design system"`

### Task 8: Detalhe do colaborador, Documentos e Certificacoes

**Files:** Modify `src/pages/StaffDetail.jsx`; Test `src/__tests__/StaffDetail.test.jsx` (acrescentar).

**Interfaces:** mesmo desenho da Tarefa 7: linhas em `Card`, vazios em `EmptyState` (`Sem documentos guardados.`, `Sem certificacoes registadas.`), icone de documento `text-ocean-700` e de certificacao `text-[var(--sand-600)]`, `Eliminar` com `text-[var(--error)]` no hover, campos dos modais com `aria-label`. `UploadButton` mantem o ficheiro escondido (`<input type="file">`) e o `Button`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** `documentos_lista_com_ligacao_e_validade` (`ExpiryBadge` real: vencido, a vencer, longe); `novo_documento_exige_nome_e_ficheiro_senao_toast`; `carregar_ficheiro_valida_chama_uploadDocument_e_preenche_o_nome` (invalido -> toast, falha -> toast); `guardar_documento_chama_createDocument_e_recarrega`; `eliminar_documento_chama_deleteDocument_e_avisa`; `falhas_dos_documentos_mostram_os_toasts`; `certificacoes_listam_nome_emissor_e_validade`; `nova_certificacao_exige_nome_e_chama_createCertification`; `eliminar_certificacao_chama_deleteCertification`; `falhas_das_certificacoes_mostram_os_toasts`; `sem_documentos_ou_certificacoes_mostra_o_vazio`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/StaffDetail.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: vazios com `EmptyState`; campos dos modais com nome acessivel; botoes `Eliminar` com nome; nenhum hexadecimal, cor nomeada ou `text-error` nos dois separadores com modal aberto. Migrar.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos; `grep` final em `Staff.jsx`, `pages/staff/*` e `StaffDetail.jsx` sem hexadecimais, cores nomeadas, `text-error`/`bg-error`/`border-error` nem `<table>`/`<select>`/`<textarea>` escritos a mao.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Documentos e Certificacoes do colaborador com o design system"`

### Task 9: Verificacao no browser com dados falsos e revisao final

**Files:** nenhum no repositorio; estender **fora do repositorio** o `mock-api5b.js` da diretoria de scratch (porta 3001; o `frontend/.env` aponta para la). **Nao arrancar o backend real.**

- [ ] **Step 1: Dados.** Rotas para `/staff` (varios colaboradores, um vendedor de praia, um inactivo, um com email e conta), `/staff/:id`, `/staff/:id/leave`, saldo de ferias, documentos, certificacoes, `/assignments` (uma por estado e uma atrasada), `/reservations`, `/messages`, `/messages/groups`, `/messages/unread-count`, salario (ja existe). Sessao ficticia (`saldesk-auth`) com plano `business` e outra `starter` com 2 colaboradores para o limite.
- [ ] **Step 2: Ver** `/colaboradores` e `/colaboradores/:id` a 1280 px e 375 px: sem scroll horizontal; os quatro separadores de cada pagina; criar e editar colaborador (incluindo vendedor de praia e o interruptor da conta); eliminar com confirmacao; criar tarefa e mover; checklist (marcar, configurar); chat (escolher conversa, enviar, fixar; o socket falha no mock, e esperado); detalhe (novo pedido de ferias, aprovar, documento e certificacao); o selo "Vendedor" e o aviso de limite ja com cor. Consola sem erros alem do `socket.io` do mock. Medir por JavaScript quando as capturas falharem.
- [ ] **Step 3: Fora de ambito.** Portais (`/viajante/entrar`) e o portal da equipa (usa `ExpiryBadge`) sem mudanca.
- [ ] **Step 4: Limpar** a sessao ficticia, parar os servidores; `git status` limpo.
- [ ] **Step 5: Revisao final** da branch inteira (um revisor independente, modelo mais capaz) com o pacote `review-package`; corrigir Critical/Important num so passo com teste RED->GREEN; os Minor vao para o ledger. So com autorizacao explicita do utilizador, fundir em `main`, empurrar e implantar o frontend como nas fases anteriores.

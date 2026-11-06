# Redesenho da app do operador, Fase 4 (Clientes: Clientes, Mensagens, Avaliacoes, Ocorrencias, Feedback) - plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar as paginas do grupo "Clientes" para os componentes e o aspeto "azul da marca", **sem alterar nenhum comportamento**: os mesmos pedidos aos servicos com os mesmos dados, as mesmas acoes e os mesmos textos.

**Architecture:** O mesmo metodo das Fases 3 e 3b: cada pagina e primeiro protegida por testes de caracterizacao (nenhuma tem testes), que passam **antes** de qualquer migracao e **depois** dela; so depois se trocam filtros, separadores, tabelas, campos e estados vazios pelos componentes `ui` e as cores em hexadecimal por tokens. As paginas nao se partem em ficheiros (260 a 665 linhas). O aspeto novo entra pelos componentes partilhados (que ja o trazem so dentro da app do operador, via `app:`).

**Tech Stack:** React 18, Vite, Tailwind 3, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-02-redesign-app-operador-design.md` (seccoes 5.4 e 7, Fase 4). Planos anteriores, de que este herda metodo e restricoes: `docs/superpowers/plans/2026-11-04-redesign-fase3-operacao.md` e `docs/superpowers/plans/2026-11-06-redesign-fase3b-housekeeping-manutencao-menu-pedidos.md`. Caminhos relativos a `frontend/`; comandos dentro de `frontend/`.

**Estado atual medido (base deste plano):**
- `pages/Customers.jsx` (418 linhas): ja usa `Table`, `Card`, `Modal`, `Input`/`Textarea`; faltam os chips de segmento e de pais (a mao, com icones), a faixa de sucesso em hexadecimal e os cartoes de metricas locais. Dois modais (`NewCustomerModal`, `CsvImportModal`) e a gaveta `components/crm/CustomerDetail.jsx` (370 linhas: tres seccoes a mao, etiquetas, notas, email, WhatsApp; 2 hexadecimais).
- `pages/Reviews.jsx` (380 linhas): filtros a mao (pesquisa, estrelas, 3 `<select>`), cartoes de avaliacao, paginacao "Carregar mais", modal de resposta (ja `Modal`).
- `pages/Occurrences.jsx` (434 linhas): `<table>` a mao, filtros a mao (tipo, severidade), cores de tipo em hexadecimal inline e de severidade em classes soltas, aviso de criticas, relatorio mensal; o modal ja usa o design system.
- `pages/Feedback.jsx` (372 linhas): separadores a mao, `<table>` a mao, cores em hexadecimal, tres separadores (Por Tour, Pendentes, Template).
- `pages/FounderChat.jsx` (111 linhas, "Mensagens SalDesk"): `<textarea>` e botao a mao.
- `pages/Messages.jsx` (665 linhas): chat em tempo real (socket.io, som, notificacoes do sistema), barra de contactos, alternador de canal (chat, email, WhatsApp) para clientes, modal de grupo; cores `green-*`/`red-*` soltas e campos a mao.
- **Nenhuma tem testes.** Texto quase todo fixo em portugues (`Customers` usa `t()` em 7 sitios).

**Decisoes de desenho (para o utilizador rever):**
1. **Mudanca visual, nao funcional.** Nada e acrescentado ou removido.
2. **Textos nao se traduzem nesta fase.** Texto **novo** usa `t()` com chaves nas quatro linguas (previsto: nenhum).
3. **Cores em hexadecimal e `green-*`/`red-*`/`yellow-*`/`orange-*` passam a tokens** (`--success`, `--warning`, `--error`, `--info` e as suas `-light`). Severidades das Ocorrencias: baixa = success, media = info, alta = warning, critica = error. Tipos de ocorrencia: acidente = error, atraso = warning, reclamacao = info, incidente = ocean-700, mau tempo = ocean-500, outro = n-500 (classes, sem `style`).
4. **Os chips perdem os icones** (Clientes: segmentos; Feedback: separadores com icone passam ao `Tabs`, que tambem nao os leva) porque os componentes partilhados nao mudam.
5. **A severidade das Ocorrencias continua a desligar-se ao clicar outra vez** (o `FilterChips` recebe um `onChange` que alterna), sem acrescentar um chip "Todas".
6. **Fora de ambito, registado:** `Customers.carregar` e o `Promise.all` de `Reviews` nao tem `catch`, por isso uma falha de rede da uma rejeicao nao tratada (ja existente; fica); o tempo real das Mensagens nao muda.
7. **Verificacao visual com dados:** Tarefa 8, com o servidor de dados falsos descartavel (fora do repositorio).

## Global Constraints

- **Comportamento identico:** mesmos pedidos aos servicos com os mesmos argumentos e formas de dados (numeros continuam numeros; vazio continua a ser o que era), mesmas rotas e nomes de ficheiros.
- Sem emojis; icones so `lucide-react`; comentarios em portugues sem acentos; ficheiros mantem o fim de linha existente (confirmar com `file`; editar com `python` a partir de um ficheiro de script, nunca `sed -i` nos ficheiros CRLF).
- Componentes partilhados (`ui/*`) **nao mudam**; se uma pagina precisar de algo que lhes falta, para-se e regista-se.
- Usar: `Table`, `Tabs`, `FilterChips`, `Select`/`Input`/`Textarea` (de `ui/Input.jsx`), `Badge`, `EmptyState`, `Button`, `Modal`, `Card`, `PageHeader`.
- Visual alvo: o do Dashboard e das paginas das Fases 3/3b (cartoes brancos, borda `n-200`, cantos de 8 px, texto de tabela 13 px, estados com `Badge`, vazios com `EmptyState`).
- Os campos do design system nao ligam a etiqueta ao campo por `htmlFor`: nos testes, localizar o controlo pelo irmao seguinte da `<label>` com o texto da etiqueta. Botoes so com icone ganham `aria-label`.
- Testes: `fireEvent`/`findBy*`/`waitFor` (nao `user-event`); `MemoryRouter` com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; `vi.mock` estrito dos servicos; **datas em hora local, relativas a hoje, com margem de pelo menos 2 dias**; espiar `console.error`/`console.warn` e exigir zero **contando antes de restaurar os espioes** (restaurar limpa os registos); testes de "servico a falhar" so nas paginas que tratam a falha.
- Cada tarefa termina com `npx vitest run` e `npm run build` a passar, e um commit. Linha de base: 918/918.

## Review Focus

- Clientes: a segmentacao continua local (VIP = etiqueta `VIP` ou gasto > 500; turista, local, grupo e corporativo como hoje) e a pesquisa e o filtro de pais continuam a ir ao servidor; cliente com `tags`, `total_spent` ou `total_visits` em falta nao rebenta.
- Mensagens: o contador de nao lidas por contacto, o envio com o objeto certo para colaborador, grupo e cliente (e o canal), e os botoes de email/WhatsApp desactivados quando o cliente nao tem email/telefone.
- Ocorrencias: a severidade desliga-se ao clicar outra vez; apagar pede confirmacao e cancelar nao apaga; uma ocorrencia sem unidade ou colaborador mostra o travessao.
- Feedback: o limiar da taxa de resposta (50 e 25), a lista de pendentes limitada a 50 com "A mostrar 50 de N", e "Reenviar pedido" a enviar `reservation_id`.
- Avaliacoes: a paginacao de 10 com "Carregar mais (N restantes)", o botao Responder so em avaliacoes publicas sem resposta, e "Limpar filtros" quando nao ha resultados.

---

### Task 1: Clientes (a pagina)

**Files:** Modify `src/pages/Customers.jsx`; Test `src/__tests__/Customers.test.jsx`.

**Interfaces:** consome `FilterChips({ options: [{value,label}], value, onChange })`; mocks de `services/customersService` (`listCustomers`, `exportCustomersCsv`, `createCustomer`), `services/api` (`post`) e de `components/crm/CustomerDetail` (componente simples que mostra `customerId` e chama `onClose`). `SEGMENTS`, `COLUMNS`, `carregar`, `segmented` e os dois modais mantem a logica; so os chips e a faixa de sucesso mudam.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Fixtures com pais, etiquetas, visitas e gasto variados (um sem `tags`, um com `total_spent` em texto). Testes: `lista_os_clientes_com_colunas_e_subtitulo`; `metricas_total_receita_paises_e_top_cliente`; `segmentos_filtram_localmente` (VIP por etiqueta e por gasto > 500; turista; local por `CV`; grupo por etiqueta ou 5 visitas; corporativo) sem novos pedidos ao servidor; `pesquisa_envia_search` e `filtro_de_pais_envia_country_code` (`listCustomers({ search })`, `({ country_code })`); `exportar_chama_exportCustomersCsv`; `novo_cliente_valida_nome_e_email` (`Nome e email sao obrigatorios`) e `novo_cliente_chama_createUnit...` -> `createCustomer` com o objeto do formulario (`name`, `email`, `phone`, `country_code`, `notes`, `tags`, `custom_price`) e mostra `Cliente criado com sucesso.`; `categoria_do_novo_cliente_alterna_etiquetas`; `importar_csv_envia_o_ficheiro` (`api.post('/customers/import', FormData, ...)`, mensagem `N cliente(s) importado(s) com sucesso.`); `clicar_no_nome_abre_a_gaveta` (o mock de `CustomerDetail` recebe o id) e fecha; `cliente_com_campos_em_falta_nao_rebenta`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Customers.test.jsx`. Expected: PASS antes de qualquer alteracao.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: os segmentos e os paises sao grupos de botoes com `aria-pressed`; nenhuma classe em hexadecimal sobra (faixa de sucesso, modais). Migrar segmentos e paises para `FilterChips` (rotulos iguais; sem icones), a faixa de sucesso para tinta `--success-light` com texto `--success`; o botao de categoria do modal de novo cliente fica (e um alternador de varias escolhas, nao um filtro).
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Clientes com o design system"`

### Task 2: Clientes (gaveta do cliente)

**Files:** Modify `src/components/crm/CustomerDetail.jsx`; Test `src/__tests__/CustomerDetail.test.jsx`.

**Interfaces:** consome `Tabs({ tabs: [{id,label}], value, onChange })`, `Input`, `Button`. Props de `CustomerDetail` iguais: `{ customerId, onClose, onUpdate }`. As tres seccoes passam a `Tabs` (ids `perfil`, `tours`, `comms`; rotulos `Perfil`, `Historico`, `Comunicacao`); os botoes rapidos (Email, WhatsApp) a `Button variant="secondary" size="sm"`; o campo de nova etiqueta a `Input`; a faixa "Email enviado" e as hover verdes a tokens; o icone do WhatsApp a `--success`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Mocks de `customersService` (`getCustomer`, `updateCustomer`) e `services/api` (`post`); `window.open` espiado. Testes: `carrega_e_mostra_nome_metricas_e_vip` (coroa quando `VIP` ou gasto > 500); `tres_seccoes_alternam`; `perfil_mostra_contacto_com_travessao_nos_vazios`; `alternar_etiqueta_chama_updateCustomer_com_tags` (adicionar e remover); `nova_etiqueta_com_enter` (sem duplicar, vazio ignorado); `editar_notas_guarda_com_updateCustomer_notes` e cancelar restaura; `historico_lista_reservas_com_estado_e_total` e `sem_reservas`; `enviar_email_valida_e_chama_api_post` (`/customers/<id>/email` com `{ subject, body }`, mostra `Email enviado com sucesso`); `whatsapp_abre_wa_me_com_o_numero_sem_simbolos` (botao rapido e atalhos de modelo); `sem_whatsapp_mostra_o_aviso`; `fechar_chama_onClose` (X e fundo).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/CustomerDetail.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: as seccoes sao `role="tab"` com `aria-selected`; nenhuma classe hexadecimal ou `green-*` sobra; o X de fechar tem `aria-label` `Fechar`.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: gaveta do cliente com o design system"`

### Task 3: Avaliacoes

**Files:** Modify `src/pages/Reviews.jsx`; Test `src/__tests__/Reviews.test.jsx`.

**Interfaces:** consome `FilterChips`, `Input`, `Select`, `EmptyState`. O filtro de estrelas passa a `FilterChips` com valores numericos (`0` = Todas, `5` a `1`, rotulos `Todas` e `5★`...); pesquisa -> `Input`; os tres `<select>` -> `Select` (mesmas opcoes e rotulos); vazio -> `EmptyState` com a acao `Limpar filtros` quando ha filtros. `api` mockado: `get('/reviews')`, `get('/reviews/stats')`, `get('/units')`, `put('/reviews/<id>/reply', { reply_text })`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** 12 avaliacoes variadas (publicas e privadas, com e sem resposta e comentario). Testes: `subtitulo_conta_total_e_sem_resposta`; `estatisticas_media_distribuicao_respondidas_publicas`; `filtro_de_estrelas`, `filtro_de_servico`, `filtro_de_resposta` (`Sem resposta`, `Respondidas`), `pesquisa_por_comentario_e_cliente`, `ordenacao` (4 opcoes); `paginacao_de_10_e_carregar_mais` (rotulo `Carregar mais (2 restantes)`); `mudar_filtro_volta_a_pagina_1`; `ver_agora_filtra_as_sem_resposta`; `responder_so_em_publicas_sem_resposta`; `responder_envia_put_com_reply_text_e_actualiza_o_cartao`; `resposta_vazia_nao_envia`; `sem_resultados_mostra_o_vazio_e_limpar_filtros_repoe`; `avaliacao_sem_cliente_nem_comentario` (`Cliente anonimo`, `Sem comentario`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Reviews.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: o filtro de estrelas e um grupo com `aria-pressed`. Migrar como acima.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Avaliacoes com o design system"`

### Task 4: Ocorrencias

**Files:** Modify `src/pages/Occurrences.jsx`; Test `src/__tests__/Occurrences.test.jsx`.

**Interfaces:** consome `Table({ columns, rows })`, `FilterChips`, `Input`, `EmptyState`, `Badge`. `TYPES` perde o campo `color` (hexadecimal) e ganha `cls` (classe de token); `SEVERITIES[].cls` passa a tokens; `TypeBadge` e `SeverityBadge` usam essas classes. Colunas da tabela como hoje (Data, Tipo, Severidade, Tour, Colaborador, Descricao, Accoes tomadas, acoes com `aria-label` `Editar` e `Eliminar`). Filtro de tipo -> `FilterChips` (`''` = Todos); severidade -> `FilterChips` com os 4 valores e `onChange={v => setFilterSev(v === filterSev ? '' : v)}`. Servicos mockados: `listOccurrences`, `createOccurrence`, `updateOccurrence`, `deleteOccurrence`, `listUnits`, `listStaff`; `window.confirm` espiado.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `lista_ordenada_por_data_decrescente`; `colunas_e_travessao_sem_unidade_nem_colaborador` (`Nao registadas` sem accoes); `kpis_total_mes_alta_critica_e_criticas`; `aviso_de_criticas_so_recentes_e_nao_resolvidas` (7 dias; resolvida e antiga nao contam); `relatorio_mensal_por_tipo_e_severidade` e `sem_ocorrencias_este_mes`; `filtro_de_tipo`; `severidade_liga_e_desliga_ao_clicar_outra_vez`; `pesquisa_em_descricao_tour_e_colaborador`; `registar_chama_createOccurrence_com_unit_name_e_staff_name` (objeto completo do formulario, data por omissao = hoje); `editar_chama_updateOccurrence_com_o_id`; `erro_ao_guardar_mostra_Erro ao guardar ocorrencia.`; `eliminar_pede_confirmacao` (cancelar nao chama `deleteOccurrence`; confirmar chama e retira a linha); `sem_ocorrencias_mostra_o_vazio_com_acao_so_quando_nao_ha_nenhuma` e `vazio_com_filtros`; `servicos_a_falhar_nao_rebentam`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Occurrences.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: tipo e severidade sao grupos com `aria-pressed`; nenhuma classe hexadecimal nem `style` com cor sobra; os botoes de editar/eliminar tem nome acessivel; ocorrencia critica tem a linha realcada com token.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Ocorrencias com o design system"`

### Task 5: Feedback pos-tour

**Files:** Modify `src/pages/Feedback.jsx`; Test `src/__tests__/Feedback.test.jsx`.

**Interfaces:** consome `Tabs({ tabs: [{id,label}], value, onChange })` (ids `tours`, `pending`, `template`; rotulos `Por Tour`, `Pendentes (N)`, `Template`), `Table`, `EmptyState`, `Input`/`Textarea`. As cores da taxa de resposta (limiares 50 e 25) e a barra passam a tokens (`var(--success)`, `var(--warning)`, `var(--error)`; a barra mantem o `style` so da largura e usa classe de token para a cor). Servicos mockados: `api.get('/reviews')`, `api.get('/reviews/template')`, `api.post('/reviews/request')`, `api.put('/reviews/template')`, `listReservations`.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `kpis_tours_avaliacoes_taxa_e_media`; `por_tour_agrupa_por_unidade_com_taxa_e_media` e a cor por limiar (50 e 25); `pendentes_so_reservas_sem_avaliacao_ordenadas_por_checkout`; `pendentes_limita_a_50` (`A mostrar 50 de 60`); `reenviar_pedido_envia_reservation_id`; `template_carrega_do_servidor_com_omissao_se_falhar`; `inserir_variavel_acrescenta_ao_corpo_pt`; `guardar_template_envia_put_com_o_objeto_e_mostra_Guardado`; `preview_pt_en_substitui_as_variaveis`; `sem_tours_e_sem_pendentes_mostram_o_vazio`; `servicos_a_falhar_nao_rebentam` (as tres chamadas tem `catch`).
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Feedback.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: os separadores sao `role="tab"` com `aria-selected`; nenhuma classe hexadecimal nem `backgroundColor` em hexadecimal sobra; o botao `Guardado` usa token.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Feedback com o design system"`

### Task 6: Mensagens SalDesk

**Files:** Modify `src/pages/FounderChat.jsx`; Test `src/__tests__/FounderChat.test.jsx`.

**Interfaces:** consome `Textarea`, `Button`, `EmptyState`. O compositor passa a `Textarea` + `Button` (icone `Send`, `aria-label` `Enviar`, desactivado sem texto ou a enviar); `Enter` envia e `Shift+Enter` nao; a recarga de 20 s e o envio (`sendFounderMessage(text.trim())`) nao mudam. Servicos mockados: `getFounderConversation`, `sendFounderMessage`; `scrollIntoView` simulado.

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `mostra_as_mensagens_alinhadas_por_remetente`; `sem_mensagens_mostra_o_vazio`; `enviar_chama_sendFounderMessage_com_o_texto_aparado_e_limpa`; `enter_envia_e_shift_enter_nao`; `botao_desactivado_sem_texto_e_enquanto_envia`; `recarrega_a_cada_20s` (`vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })`); `falha_ao_enviar_mantem_o_texto`; `falha_ao_carregar_nao_rebenta`.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/FounderChat.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Teste: o botao de enviar tem o nome `Enviar`.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: Mensagens SalDesk com o design system"`

### Task 7: Mensagens

**Files:** Modify `src/pages/Messages.jsx`; Test `src/__tests__/Messages.test.jsx`.

**Interfaces:** consome `Input`, `EmptyState`. Mocks: `socket.io-client` (`io` devolve um emissor com `on`, `emit`, `disconnect` e um ajudante de teste para disparar eventos), `services/messageService` (`listMessages`, `sendMessage`, `markRead`, `listGroups`, `createGroup`, `getLastActivity`), `staffService.listStaff`, `customersService.listCustomers`, `services/api`, `authStore` (token e operador); `Notification` e `AudioContext` simulados. A pesquisa da barra e o campo da mensagem passam a `Input`; o painel sem conversa a `EmptyState`; `text-green-*`/`text-red-300` a tokens; o alternador de canal mantem a estrutura (so cores).

- [ ] **Step 1: Testes de caracterizacao (verdes ANTES de migrar).** Testes: `lista_colaboradores_e_conversas_ordenadas_por_actividade`; `pesquisa_filtra_contactos`; `abrir_conversa_carrega_mensagens_com_o_destinatario_certo` (colaborador/cliente `recipient_id`, grupo `group_id`) e marca as nao lidas; `mensagem_nova_por_socket_incrementa_o_contador_do_outro_contacto` e acrescenta na conversa aberta sem duplicar; `colaborador_online_mostra_Online`; `a_escrever...` por `typing:start`; `enviar_para_colaborador_grupo_e_cliente` (objetos exactos, incluindo `channel` para cliente); `canal_email_e_whatsapp_desactivados_sem_email_ou_telefone`; `anexo_acrescenta_o_nome_ao_conteudo`; `enviar_desactivado_sem_texto`; `novo_grupo_cria_com_nome_e_membros`; `sem_conversa_seleccionada_mostra_o_convite`; `servicos_a_falhar_nao_rebentam`; o titulo mostra `(N)` com nao lidas.
- [ ] **Step 2: Correr.** Run: `npx vitest run src/__tests__/Messages.test.jsx`. Expected: PASS.
- [ ] **Step 3: Testes novos (RED) e migrar.** Testes: o alternador de canal tem `aria-pressed`; nenhuma classe `green-*`, `red-*` ou hexadecimal sobra.
- [ ] **Step 4: Correr.** Expected: PASS; suite e build limpos.
- [ ] **Step 5: Commit.** `git add -A src && git commit -m "feat: pagina de Mensagens com o design system"`

### Task 8: Verificacao no browser com dados falsos

**Files:** nenhum no repositorio; estender **fora do repositorio** o `mock-api.js` da diretoria de scratch (porta 3001; o `frontend/.env` aponta para la). **Nao arrancar o backend real.**

- [ ] **Step 1: Dados.** Acrescentar rotas: `GET /customers` e `GET /customers/:id` (reservas incluidas), `PUT /customers/:id`, `GET /reviews`, `GET /reviews/stats`, `GET /reviews/template`, `GET /occurrences`, `GET /messages` e `GET /messages/groups` e `GET /messages/last-activity`, `GET /founder-chat` (ler os servicos para os caminhos exactos). Sessao ficticia no `localStorage` (`saldesk-auth`) com token `fake-activity`.
- [ ] **Step 2: Ver** `/clientes`, `/mensagens`, `/mensagens-saldesk`, `/avaliacoes`, `/ocorrencias` e `/feedback` a 1280 px e 375 px: tabelas sem overflow a 1280 px; sem scroll horizontal da pagina a 375 px; abrir a gaveta do cliente, o modal de ocorrencia e o de resposta; consola sem erros alem do `socket.io` do mock. Medir por JavaScript quando as capturas falharem.
- [ ] **Step 3: Fora de ambito.** `/viajante/entrar` sem `data-ui` e sem mudanca.
- [ ] **Step 4: Limpar** a sessao ficticia, parar os servidores; `git status` limpo.
- [ ] **Step 5: Revisao final** da branch inteira (um revisor independente) e, so com autorizacao explicita do utilizador, fundir em `main`, empurrar e implantar o frontend como nas fases anteriores.

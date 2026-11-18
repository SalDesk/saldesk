# Pedido automatico de avaliacao: desenho

Data: 2026-11-18. Toca: backend (cron, controlador de avaliacoes, viajante), frontend (pagina publica nova, ecra Feedback), base de dados (1 coluna nova).

## Porque

O Discover e as paginas dos operadores mostram estrelas so quando ha avaliacoes, e hoje os operadores reais tem zero (as 4 avaliacoes existentes sao do operador de demonstracao). O dono quer que o turista receba sozinho um pedido de avaliacao depois da actividade ou estadia, para as avaliacoes comecarem a chegar sem depender de cada operador se lembrar.

O que se encontrou ao ver o codigo:
- O link dos pedidos (e-mail manual e botao "Pedir avaliacao" do WhatsApp) e `https://app.saldesk.cv/review/<token>`, mas essa pagina nao existe: a app redirecciona para `/` (entrada dos operadores). O endpoint `POST /api/v1/reviews/submit` existe e nunca e chamado.
- Os pedidos so existem para reservas `checked_out`, e os operadores de actividades quase nunca marcam check-out (5 de 13 reservas passadas).
- A automacao modelo "D+1 — Pedido de avaliacao" (Automations.jsx) nao leva link e o cron nunca preenche `review_link`.
- So o e-mail pode ser enviado sem intervencao (o WhatsApp pela app precisa de um clique do operador; o WhatsApp oficial ainda esta desligado).

Sucesso: dias depois de implantar, turistas de reservas directas recebem um e-mail no dia seguinte a actividade/estadia, abrem o link, dao estrelas e comentario numa pagina simples, e a avaliacao aparece no Discover, na pagina do operador e no ecra Avaliacoes do operador.

## Decisoes do dono

- **Ligado para todos a partida**, com opcao de cada operador desligar (opcao A).
- **Envio por uma tarefa diaria propria no servidor** (1a), nao pelas Automacoes.
- **Pagina publica na app, no endereco que os links ja usam** (`app.saldesk.cv/review/<token>`) (2a), para os links ja enviados tambem passarem a funcionar.

## Objectivos

1. Tarefa diaria que envia o pedido por e-mail as reservas elegiveis que terminaram na vespera.
2. Pagina publica `/review/:token` sem conta: ver o que se avalia, dar 1-5 estrelas e comentario, enviar, agradecimento.
3. Interruptor por operador "Pedir avaliacao automaticamente", ligado por omissao, no ecra Feedback.
4. Viajantes com conta podem avaliar reservas passadas mesmo sem check-out.
5. Corrigir o pedido manual para nunca apagar uma avaliacao ja dada.

## Nao objectivos

- Estrelas por actividade (hoje sao por operador; fica igual).
- WhatsApp automatico (fica para quando a Cloud API estiver ligada).
- Lembrete a quem nao respondeu, moderacao/esconder avaliacoes, respostas por IA.
- Mudar as Automacoes (a automacao modelo "D+1" fica como esta).

## Anti-objectivos

- Pedir avaliacao a reservas de OTAs (GetYourGuide, Viator, Booking...): os e-mails sao do intermediario e as regras deles proibem contactar o cliente fora da plataforma. Hoje ha 83 reservas `getyourguide` em producao.
- Mandar mais do que um pedido por reserva, ou apagar/substituir uma avaliacao ja dada.
- Mandar pedidos em massa a clientes antigos no primeiro dia (nada de "recuperar" todo o historico).
- Uma pagina que mostre dados do cliente ou da reserva a quem nao tem o link.

## Regras

### Reserva elegivel para o pedido automatico
Todas estas, avaliadas em hora de Cabo Verde (`Atlantic/Cape_Verde`):
- `check_out` entre hoje-3 e hoje-1 (inclusive). A janela de 3 dias deixa recuperar um dia em que a tarefa ou o e-mail falharam, sem ir ao historico.
- `status` em `confirmed`, `checked_in`, `checked_out` (nao `pending`, `cancelled`, `no_show`).
- `source` em `public`, `manual`, `admin` ou vazio. Qualquer outro valor (OTA) fica de fora.
- `customer_email` preenchido.
- Ainda nao existe linha em `reviews` para essa reserva (ha UNIQUE em `reviews.reservation_id`).
- O operador nao desligou o pedido automatico (`operators.review_auto_request` nao e `false`).
- O operador tem o plano activo, pela mesma regra da app (`isPlanActive` de `backend/src/middleware/requirePlanActive.js`: nao `suspended`/`cancelled`; em `trial`, so dentro do periodo ou com pagamento em dia), nao e de demonstracao (`operators.is_demo` falso) e nao e o operador interno (`WANDR_INTERNAL_OPERATOR_ID`). *Decisao do construtor do desenho: nao mandar e-mails em nome de contas paradas ou ficticias.*

### Envio
- A tarefa corre todos os dias as 10:00 de Cabo Verde (`node-cron`, como as outras em `backend/src/services/cronService.js`; o processo `saldesk-api` tem 1 instancia).
- Para cada reserva elegivel: cria a linha em `reviews` (`rating` null, `is_public` false, token novo, validade 30 dias), envia o e-mail com o modelo do operador (`review_request_templates`) ou o modelo por omissao, na lingua do cliente (mesma regra de hoje: `detectarIdioma(customer_country)`).
- Se o envio falhar, a linha fica: o `enviarEmail` ja guarda a falha em `email_failures` e o `emailRetryService` volta a tentar com o mesmo link. Assim cada reserva recebe no maximo um pedido. *Decisao do construtor do desenho (a fila de reenvio que ja existe ganha a uma segunda tentativa no dia seguinte).*
- A logica de criar token + preencher modelo + enviar passa para um servico partilhado (ex.: `backend/src/services/pedidoAvaliacaoService.js`) usado pela tarefa e pelo pedido manual (`POST /reviews/request`), para nao haver duas versoes.
- Regista no log do servidor quantos pedidos enviou e quantos falharam (sem dados pessoais).

### Pedido manual (corrigir)
- Se a reserva ja tem avaliacao dada (`rating` nao null), responde 409 `ALREADY_REVIEWED` e nao toca na linha (hoje o upsert apagaria a avaliacao).
- Se ja ha um pedido por responder, gera token novo e reenvia (comportamento de reenviar de hoje).
- Validade do token passa de 7 para 30 dias, igual ao automatico.

### Modelo de e-mail por omissao
O texto actual fala sempre em "tour", o que fica errado para hoteis, rent-a-car e restaurantes. O modelo por omissao (backend `DEFAULT_TEMPLATE` e frontend `Feedback.jsx`) passa a neutro, com os mesmos marcadores (`{nome_cliente}`, `{nome_tour}`, `{link_avaliacao}`):
- PT, assunto: "Como correu? Deixe a sua avaliacao"; corpo: "Ola {nome_cliente},\n\nObrigado por ter escolhido {nome_tour}. Esperamos que tenha corrido bem!\n\nA sua opiniao ajuda-nos e ajuda outros viajantes a escolher. Demora menos de um minuto:\n\n{link_avaliacao}\n\nObrigado!"
- EN, assunto: "How was it? Leave your review"; corpo equivalente.
Modelos ja guardados pelos operadores nao mudam.

### Pagina publica `/review/:token`
- Rota publica na app React (fora do `Layout` e da autenticacao), como `/book/:slug`.
- Endpoint novo sem autenticacao `GET /api/v1/reviews/token/:token` que devolve so o necessario: nome do operador, logotipo/cor (se existir, `brand_color`), nome da unidade/actividade, data (`check_in`), primeiro nome do cliente, e o estado: `ok`, `expirado` ou `invalido`. Um link ja usado (o `submit` apaga o token) ou substituido por um reenvio aparece como `invalido`; a pagina mostra para esse caso uma mensagem amavel ("Este link ja nao esta activo. Se ja deixou a sua avaliacao, obrigado!"). *Decisao do construtor do desenho: nao mexer no `submit` nem no filtro das avaliacoes publicas so para distinguir "ja avaliado".* Nunca devolve e-mail, telefone, precos ou ids internos.
- Estados da pagina: a carregar; formulario (5 estrelas obrigatorias, comentario opcional ate 1000 caracteres, botao "Enviar avaliacao"); obrigado (com link para a pagina do operador `/book/<slug>`); link expirado; link ja nao activo; erro de ligacao com "Tentar de novo".
- Envia para o `POST /api/v1/reviews/submit` existente (que ja valida token e validade, publica, notifica o operador).
- `submit` e o `GET` por token ficam sob limite de pedidos por IP (mesma protecao que os outros endpoints publicos, se existir; senao um limite simples).
- Lingua: a da reserva (`detectarIdioma(customer_country)` devolvida pelo `GET`), com troca PT/EN na pagina. Textos novos em pt/en/de/nl no i18n da app.
- Aspeto: o das paginas publicas da app (`/book/:slug`), simples, telemovel primeiro.

### Interruptor do operador
- Coluna nova `operators.review_auto_request boolean not null default true` (migracao numerada a seguir a ultima em `database/`; aplicar em producao so com autorizacao do dono, antes do backend).
- No ecra Feedback (`frontend/src/pages/Feedback.jsx`), no separador do modelo: interruptor "Pedir avaliacao automaticamente no dia a seguir" com texto curto a explicar (e-mail, so reservas directas, uma vez por reserva). Le e grava por um endpoint autenticado (ex.: incluir no `GET/PUT /reviews/template` ou um `GET/PUT /reviews/settings`).

### Viajantes com conta
- `can_review` e `POST /traveler/bookings/:id/review` passam a aceitar reservas com `check_out` ja passado e `status` em `confirmed`, `checked_in`, `checked_out` (hoje so `checked_out`).
- Se ja existir um pedido por responder (linha com `rating` null), a avaliacao do viajante preenche essa linha em vez de falhar no UNIQUE.

## Restricoes

- Commit e implantacao so com ordem do dono; migracao de producao so com autorizacao, aplicada antes do backend.
- Backend no VPS: copiar so os ficheiros precisos, nunca `git pull` (ver memoria do projecto).
- O envio real depende do SendGrid estar a enviar: antes de implantar, o dono corre o script de verificacao.
- Sem emojis; textos em PT/EN (e de/nl no i18n da app, como o resto).

## Abordagens consideradas

- **Envio:** (a, escolhida) tarefa diaria propria; (b) usar o motor de Automacoes criando a regra para cada operador: obrigaria a criar e manter regras para todos e os gatilhos so aceitam `checked_out`.
- **Pagina:** (a, escolhida) rota publica na app no endereco que os links ja usam; (b) pagina no saldesk.cv/discover: obrigaria a mudar o endereco dos links e os ja enviados ficavam partidos.

## Ao criterio de quem constroi

- Nome e localizacao exactos do servico, do endpoint de definicoes e dos componentes React.
- Aspeto exacto da pagina dentro do estilo das paginas publicas da app.
- Como testar a tarefa diaria sem enviar e-mails reais (funcao pura de elegibilidade testada a parte; envio simulado).

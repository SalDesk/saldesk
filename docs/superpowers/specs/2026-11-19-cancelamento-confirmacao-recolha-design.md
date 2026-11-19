# Cancelamento gratis, confirmacao imediata e recolha no hotel: desenho

Data: 2026-11-19. Toca: base de dados (2 colunas em `operators`), backend (catalogo publico, criacao de reservas publicas, perfil publico), frontend da app (Definicoes > Perfil Publico, formulario de actividade, pagina de reserva/servico) e site estatico (cartoes do Discover e da pagina do ponto turistico).

## Porque

Os cartoes do Discover devem dizer ao turista o que mais pesa na decisao de reservar: se pode cancelar sem custo, se a reserva fica logo confirmada e se o vao buscar ao hotel. Hoje nada disto existe de forma estruturada:
- **Cancelamento:** existe so um texto livre por operador (Definicoes > Perfil Publico > "Politica de cancelamento", colunas `cancellation_policy_pt/en`), exigido pela SISP e mostrado antes de pagar. Nenhum dos 24 operadores o preencheu, por isso todas as paginas de reserva dizem "Este operador ainda nao definiu uma politica de cancelamento".
- **Confirmacao:** as reservas da pagina publica entram `pending` e so passam a `confirmed` quando o turista paga online ou o operador confirma a mao. A pagina de reserva oferece sempre as tres formas de pagar (PayPal, Vinti4, pagar presencialmente), por isso nao da para deduzir com verdade se a reserva fica confirmada.
- **Recolha no hotel:** so aparece se o operador a escrever na lista "O que inclui".

Sucesso: um operador escolhe o prazo de cancelamento e liga a confirmacao automatica em dois cliques; os cartoes do Discover e da pagina do ponto turistico mostram "Cancelamento gratis ate 24 h antes", "Confirmacao imediata" e "Recolha no hotel" quando verdade; e a pagina de reserva deixa de dizer que nao ha politica quando o operador escolheu um prazo.

## Decisoes do dono

- Cancelamento gratis **por operador** (um prazo para todas as actividades), nao por actividade.
- Avancar com as tres coisas.

## Objectivos

1. **Prazo de cancelamento gratis por operador**, em Definicoes > Perfil Publico, no cartao "Politica de cancelamento": escolha "Sem prazo definido" (por omissao), "Cancelamento gratis ate 24 h antes", "48 h", "72 h", "7 dias", "Sem cancelamento gratis".
2. **Texto da politica gerado** quando o operador escolheu um prazo mas nao escreveu texto: a pagina de reserva e o rodape de conformidade mostram esse texto (PT/EN) em vez do aviso "ainda nao definiu". Se o operador escreveu texto, vale o texto dele.
3. **Interruptor "Confirmar reservas automaticamente"** por operador, desligado por omissao, no mesmo separador. Ligado: as reservas criadas pela pagina publica (`POST` de reserva publica em `publicController.js`, hoje `status: 'pending'`) entram `confirmed`. O pagamento online continua a confirmar como hoje.
4. **Caixa "Inclui recolha no hotel"** no formulario de actividade (`TourForm.jsx`), guardada na descricao JSON da unidade (`pickup_included: true`).
5. **Cartoes do Discover e da pagina do ponto** mostram estes beneficios, so quando verdade:
   - "Cancelamento gratis ate 24 h antes" / "48 h" / "72 h" / "7 dias" (EN: "Free cancellation up to 24 h before" ...); nada para "sem prazo" ou "sem cancelamento gratis".
   - "Confirmacao imediata" (EN "Instant confirmation") quando o interruptor esta ligado.
   - "Recolha no hotel" (EN "Hotel pickup") quando `pickup_included`.

## Nao objectivos

- Prazo por actividade (pode vir depois como excepcao).
- Aplicar o prazo automaticamente a reembolsos ou bloquear cancelamentos: o prazo e informacao para o turista; reembolsos continuam manuais.
- Mudar as formas de pagamento oferecidas na pagina de reserva.
- Estes campos para hoteis, rent-a-car e restaurantes alem do que ja se ve no cartao (o prazo e a confirmacao sao do operador e aparecem em qualquer tipo; a recolha so existe no formulario de actividade).

## Anti-objectivos

- Prometer o que nao e verdade: sem prazo escolhido nao aparece nada; com confirmacao automatica desligada nao aparece "Confirmacao imediata".
- Mudar o comportamento de operadores que nao mexem nas definicoes: confirmacao automatica desligada por omissao, prazo vazio por omissao.
- Sobrepor o texto escrito por um operador com o texto gerado.

## Restricoes

- Migracao de producao so com autorizacao, antes do backend: `operators.free_cancellation_hours integer null` (null = sem prazo definido; 0 = sem cancelamento gratis; 24, 48, 72, 168) com `check (free_cancellation_hours is null or free_cancellation_hours in (0, 24, 48, 72, 168))`, e `operators.auto_confirm_bookings boolean not null default false`.
- O catalogo publico (`/public/discover-units`) passa a devolver por unidade `free_cancellation_hours` e `auto_confirm_bookings` do operador; `pickup_included` ja vem dentro de `description`.
- A pagina publica do operador (`GET /public/:slug`) passa a devolver as duas colunas, para a pagina de reserva gerar o texto.
- O site estatico usa `website/discover/_cartao.js` para as regras do cartao (funcoes puras com testes em `tests/website/`); o texto gerado da politica na app fica num helper puro com testes (vitest).
- Implantacao: migracao, backend, app e site estatico, por esta ordem e so com ordem do dono.

## Abordagens consideradas

- **Guardar o prazo e a confirmacao em colunas proprias de `operators`** (escolhida): validacao na base de dados, faceis de devolver no catalogo e de filtrar no futuro.
- **Guardar dentro de `page_config` (JSON)**: sem migracao, mas sem validacao e mais facil de se perder; descartada.
- **Confirmacao deduzida das formas de pagamento**: descartada, porque a pagina oferece sempre "pagar presencialmente" e a reserva fica pendente nesse caso.

## O desenho

### Definicoes > Perfil Publico
No cartao "Politica de cancelamento", antes dos textos:
- Lista "Cancelamento gratis" com as 6 opcoes do objectivo 1, guardada com o resto do perfil (mesmo botao Guardar, mesmo `PUT` do onboarding/perfil, que passa a aceitar `free_cancellation_hours` validado contra os valores permitidos; 400 se invalido).
- Texto de ajuda: "Aparece nos cartoes do catalogo. Se nao escrever uma politica abaixo, usamos um texto simples com este prazo."
- Pre-visualizacao do texto gerado por baixo da lista quando os campos de texto estao vazios.
- Quando ha prazo escolhido e texto escrito, nota curta: "Confirme que o texto abaixo diz o mesmo prazo." O cartao do catalogo mostra sempre o prazo escolhido. *Decisao do construtor do desenho.*
Num cartao novo "Confirmacao das reservas": interruptor "Confirmar reservas automaticamente" com ajuda "As reservas feitas na sua pagina publica ficam logo confirmadas, sem precisar de as aceitar. Os cartoes do catalogo mostram \"Confirmacao imediata\"." Guardado no mesmo `PUT` (`auto_confirm_bookings`, booleano; 400 se nao for).

### Texto gerado da politica
- 24/48/72 h: PT "Cancelamento gratuito ate {N} horas antes do inicio. Depois desse prazo, o valor pago nao e reembolsado." EN "Free cancellation up to {N} hours before the start. After that, the amount paid is not refunded."
- 168: igual com "7 dias" / "7 days".
- 0: PT "Esta reserva nao tem cancelamento gratuito: o valor pago nao e reembolsado em caso de cancelamento." EN equivalente.
- null: nada (fica o aviso actual).
Ordem de escolha, por lingua pedida: (1) texto escrito pelo operador nessa lingua; (2) texto escrito pelo operador na outra lingua; (3) texto gerado pelo prazo; (4) aviso actual. O texto gerado so entra quando o operador nao escreveu texto em nenhuma lingua, para nunca haver duas politicas diferentes. *Decisao do construtor do desenho.*
Usado na pagina de servico/reserva (`ServiceDetail.jsx`, incluindo a caixa de aceitacao antes de pagar) e no `SiteComplianceFooter.jsx`.
O `GET /public/:slug/units/:id` (`getUnit`, que alimenta o `ServiceDetail.jsx`) hoje nao devolve `cancellation_policy_pt/en`, por isso a pagina de servico diz sempre "ainda nao definiu" mesmo a quem a escreveu: passa a devolver essas duas colunas e as duas novas. *Erro ja existente, corrigido aqui.*

### Reservas publicas
A reserva publica e criada antes do pagamento online. Por isso:
- Com `auto_confirm_bookings` ligado e o turista a escolher **pagar presencialmente**, a reserva entra `confirmed`.
- Com pagamento online (PayPal, Vinti4), a reserva entra `pending` como hoje e passa a `confirmed` quando o pagamento e capturado (comportamento actual). Assim um pagamento abandonado nunca deixa uma reserva confirmada e por pagar.
O pedido de criacao tem de indicar a forma de pagamento escolhida (o construtor verifica como o `ServiceDetail.jsx` a envia hoje e, se nao enviar, acrescenta-a; sem forma indicada, trata-se como pagamento online, ou seja `pending`). "Confirmacao imediata" no cartao continua verdade nos dois casos. Nenhum outro caminho de criacao muda (manual, OTA, admin). *Decisao do construtor do desenho.*

### Formulario de actividade
`TourForm.jsx`: caixa "Inclui recolha no hotel" junto do ponto de encontro; guarda `pickup_included: true|false` na descricao JSON.

### Cartoes (Discover e pagina do ponto)
Regra pura nova em `_cartao.js`: `beneficiosCartao(item, meta, lang) -> string[]` com, por esta ordem e so quando verdade: prazo de cancelamento, confirmacao imediata, recolha no hotel. O cartao mostra-os numa linha verde propria (icone de visto), acima da linha "o que inclui", separados por " · ", com reticencias se nao couberem. Quando nao ha nenhum, a linha nao ocupa espaco.
Com `pickup_included`, a linha "o que inclui" deixa de mostrar itens que falem de recolha (texto com "recolha" ou "pick-up"/"pickup", sem distinguir maiusculas), para nao repetir. *Decisao do construtor do desenho.*

## Ao criterio de quem constroi

- Nomes exactos das funcoes, rotulos de testes e a pre-visualizacao do texto gerado.
- Se a regra do texto gerado vive num helper partilhado da app (ex.: `frontend/src/utils/politicaCancelamento.js`).
- Como a linha de beneficios se arruma com as etiquetas no telemovel.

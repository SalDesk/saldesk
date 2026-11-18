# Redesenho do Discover (SalDesk Conect): desenho

Data: 2026-11-18. Pagina: `website/discover/index.html` (servida em https://saldesk.cv/discover/).
Maqueta aprovada pelo dono: `website/discover/_proposta-redesign.html` (versao dos cartoes v3, 3 colunas).

## Porque

O dono acha que o Discover "nao parece profissional". O que se viu na pagina actual:

- Identidade propria (Fraunces + Inter + IBM Plex Mono, teal e ocre), diferente do saldesk.cv e da app do operador.
- Cabecalho escuro e centrado, com um unico cartao "3 reservas / 30 dias" que fragiliza mais do que convence.
- Seccoes escondidas por uma animacao de entrada: ao descer depressa a pagina fica em branco.
- Cartoes grandes de 2 colunas com "Sem avaliacoes", "Consultar" em letra de maquina, e o catalogo so aparece depois de pontos turisticos, destaques e vantagens.

Sucesso: um turista abre a pagina e ve logo, com aspecto de plataforma seria (GetYourGuide, Viator), o que pode reservar, onde, quanto custa e com quem.

## Objectivos

1. Mesma identidade visual do resto do SalDesk: Sora (titulos) + DM Sans (texto), cores ocean e sand, os tokens de `website/CLAUDE.md`.
2. Nova ordem: navegacao, cabecalho com pesquisa, linha de confianca, experiencias, operadores verificados, pontos turisticos, porque reservar directo, rodape.
3. Cartao de experiencia novo (o v3 da maqueta), com mais informacao real e ordem fixa.
4. As ideias 1, 3, 4 e 10 da conversa, que so usam dados que ja existem:
   - 1: procura real no cartao ("Reservado 2 vezes no ultimo mes");
   - 3: proxima data livre quando nao e hoje;
   - 4: titulo na lingua do visitante quando existe;
   - 10: pagina mais leve (fotos dos pontos turisticos em miniatura).
5. Sem animacao que esconda conteudo.

## Nao objectivos (ficam para depois)

- Campos novos no formulario do operador: cancelamento gratis, confirmacao imediata, "inclui recolha no hotel" (ideias 5 a 7).
- Pedido automatico de avaliacao depois da actividade (ideia 12) e revisao dos titulos dos operadores (ideia 13).
- Ordenar e filtrar por preco, duracao, privado/grupo, linguas; vista de mapa; dados estruturados para o Google (ideias 8, 9, 11).
- Campo "Data" na pesquisa da maqueta: sai. Nao ha filtro por data hoje e seria trabalho novo.
- Filtros por tipo (Tours, Mar e barco...): a maioria das experiencias nao tem categoria; os chips actuais por categoria ficam como estao (so mudam de estilo) e o filtro por ilha e novo.
- `ponto.html`, `lugares/*.html` e a ficha de reserva (app.saldesk.cv/book/...): nao mudam nesta etapa.
- Miniaturas das fotos dos operadores: o servidor so gera `_thumb.webp` (400 px) num dos caminhos de upload, e as fotos actuais do catalogo nao a tem. Gerar miniaturas para todas exige trabalho no servidor; fica para depois.

## Anti-objectivos

- Inventar informacao: o cartao so mostra o que o operador preencheu. Nada de "Recolha no hotel" deduzido do texto, nada de estrelas sem avaliacoes, nada de "Disponivel hoje" em todos os cartoes so porque e verdade para todos.
- Partir o que ja funciona: favoritos (anonimos e com sessao), sessao do viajante, painel de perfil (reservas, faturas, avaliacoes, favoritos, editar perfil, palavra-passe), recomendados, moeda EUR/CVE, PT/EN, Google Analytics e a etiqueta Google Ads.

## Restricoes

- HTML, CSS e JavaScript simples, sem frameworks nem bibliotecas; Google Fonts so por `<link>`; icones SVG em linha, estilo Lucide; sem emojis (`website/CLAUDE.md`).
- Bilingue com `data-lang` e as classes `.pt` / `.en`; a lingua guarda-se em `localStorage('sd-lang')` como hoje.
- Responsivo a 375, 768 e 1280 px, sem deslocamento horizontal.
- O ficheiro `_proposta-redesign.html` nao vai para producao; apaga-se no fim.

## Abordagens consideradas

- **A. Reescrever a pagina do zero a partir da maqueta.** Codigo mais limpo, mas obriga a reescrever ~1400 linhas de JavaScript (sessao, perfil, favoritos, avaliacoes) e o risco de partir algo e alto.
- **B. Mudar no proprio ficheiro (escolhida).** Trocar os tokens e as fontes, reescrever o HTML e o CSS das seccoes publicas e as funcoes que desenham cartoes, mantendo a logica JavaScript (carregamento, filtros, favoritos, sessao, perfil). Os nomes antigos das variaveis CSS (`--teal7`, `--ink`, `--fd`...) passam a apontar para os valores novos, para que o modal de favoritos e o painel de perfil herdem a nova identidade sem serem reescritos.
- **C. Passar o Discover para a app React.** Fora de questao: o Discover e site estatico servido pelo nginx de saldesk.cv e tem paginas SEO irmas.

Escolha de B: e a que da o aspecto da maqueta com menos risco. Custo: ficam no CSS algumas regras antigas de componentes que nao mudam (modal, painel).

## O desenho

### Navegacao
Fixa, fundo branco, borda inferior. Logo `/logo.png` a esquerda; links Experiencias, Pontos turisticos, Operadores (ancoras na pagina) e Para operadores (`/operadores.html`). A direita: interruptor PT/EN, moeda EUR/CVE, favoritos (com contador), perfil (o menu e o comportamento actuais com sessao). Telemovel: links escondidos; ficam os botoes.

### Cabecalho
Foto `/images/hero-buracona.jpg` com escurecimento so a esquerda e em baixo. Etiqueta "Ilha do Sal · Santo Antao · e a crescer" (as ilhas saem dos dados carregados; enquanto carregam, "Cabo Verde"). Titulo "Reserve directamente com quem vive Cabo Verde" (EN: "Book directly with the people who live Cape Verde"), subtitulo. Pesquisa num cartao branco a cavalo do fundo da foto, com dois campos: "O que procura" (o campo de texto actual, mesma logica `handleSearch`) e "Ilha" (seleccao, as ilhas presentes nos dados + "Todas as ilhas"), e o botao sand "Pesquisar". No telemovel o cartao fica dentro do cabecalho, campos empilhados.

### Linha de confianca
Tres itens com icone: operadores verificados pela equipa SalDesk; reserva confirmada directamente pelo operador (escolhida por ser sempre verdade: o pagamento por cartao SISP ainda nao foi testado com credenciais reais; quando o pagamento online estiver confirmado, passa a "Pagamento seguro online"); fale directamente com o operador. Substitui os cartoes de estatisticas do cabecalho (`renderHeroStats` sai).

### Experiencias
Titulo "Experiencias em Cabo Verde" e "N experiencias de M operadores" (contados dos dados). Filtros: segmentado por ilha (Todas / cada ilha com contagem) + os chips de categoria actuais. Grelha de 3 colunas (2 em tablet, 1 no telemovel), 9 por pagina, botao "Ver mais". Estado vazio e erro como hoje, no estilo novo.

### Cartao de experiencia (ordem fixa)
1. Foto 3:2 (16:10 no telemovel); coracao de favorito no canto; numero de fotos em baixo a direita so se houver mais de uma.
2. Ilha em letras pequenas maiusculas (`island_name`).
3. Titulo, 2 linhas no maximo, espaco de 2 linhas reservado. Na versao EN usa `name_en` da descricao se existir; em PT usa `unit_name`.
4. Operador: quadrado com iniciais + nome + selo de verificado (todos os operadores no catalogo sao revistos). Quando o operador tem avaliacoes (`review_count > 0`), a seguir ao nome: estrela + media + "(N)". A media e do operador, nao da experiencia (o servidor calcula-a por operador), por isso fica na linha do operador. Sem avaliacoes nao aparece nada (sai o "Sem avaliacoes"). Os cartoes de operador mostram o mesmo. *Decisao do construtor do desenho.*
5. Caracteristicas em etiquetas, nesta ordem, cada uma so se existir: duracao (`duration` em horas da descricao, senao `duration_minutes`; formato "2 h", "3 h 30"), formato ("Privado", "Em grupo", "Privado ou grupo" a partir de `tour_type`), linguas (`languages`, "PT, EN, ES").
6. Linha verde com visto: os primeiros itens incluidos (`included_items` com `included: true`, aceita tambem itens em texto), separados por " · ", numa linha com reticencias. Sem itens, a linha fica vazia mas ocupa o mesmo espaco.
7. Sinal de procura e de data, uma linha pequena, so quando aplicavel: "Reservado N vezes no ultimo mes" quando `recent_bookings >= 1`; "Proxima data: 22 nov" quando `next_available` existe e nao e hoje. Se ambos, os dois separados por " · ".
8. Rodape: "A partir de" + preco grande + "/ pessoa" ou "/ grupo"; por baixo, "Crianca €X" quando ha `price_child`. Seta a direita.
   - Preco: mesma prioridade do servidor (`displayPrice` em `catalogImageController.js`): `base_price` > escalao mais barato de `price_tiers` > `price_private`. Com `base_price` a unidade e "/ pessoa"; com escaloes ou preco privado e "/ grupo" (os escaloes sao o total do grupo, como em `calcPrivatePrice` do ServiceDetail). Sem nenhum: "Preco sob consulta".
   - Moeda: a conversao EUR/CVE actual (`fmtPrice`).
9. O cartao inteiro e um link para `https://app.saldesk.cv/book/<slug>/servico/<unit_id>` (o mesmo destino do botao "Reservar" actual); o coracao nao abre o link.

Rent-a-car e restaurante: hoje o catalogo so tem actividades, mas o codigo trata viaturas (`vehicleSpecsRow`) e pratos. Nestes tipos as etiquetas do ponto 5 passam a ser as especificacoes da viatura (transmissao, combustivel, lugares) ou nenhuma; o resto do cartao e igual.

### Recomendados (so com sessao de viajante)
Mantem-se a seccao e a logica; usa o cartao novo. Fica entre a linha de confianca e as Experiencias, como hoje fica antes do catalogo.

### Operadores locais verificados
Substitui "Em destaque". Os operadores de `/discover?featured=true&limit=3`: capa (`cover_images[0]`, senao a primeira foto de uma experiencia do operador, senao gradiente ocean), iniciais (ou `logo_url` se existir), nome com selo, descricao em 2 linhas, ilha (da primeira experiencia do operador) e "N experiencias" (contadas nos dados). Link para a pagina publica do operador (o destino actual de `renderOperatorCard`).

### Pontos turisticos
Titulo "Lugares a nao perder" e "N pontos turisticos em todas as ilhas". Faixa horizontal de cartoes de foto ao alto (3:4) com ilha e nome, link para a pagina do ponto (destino actual). As fotos da Wikimedia passam a usar a miniatura oficial de 640 px (`/wikipedia/commons/thumb/<a>/<ab>/<ficheiro>/640px-<ficheiro>`); outras fotos ficam como estao; sem foto, gradiente.

### Porque reservar directo
Bloco ocean-900 com cantos arredondados: titulo + tres itens (0% comissao, operadores revistos, contacto directo).

### Rodape
Fundo n900, logo em branco, colunas: descricao e redes; Explorar (ancoras da pagina); Empresa (Listar negocio, Entrar, hello@saldesk.cv, Termos `/termos.html`). A faixa "Pagamentos aceites" com os logos actuais de `/payment-logos/` (Vinti4, Mastercard ID Check, Visa, American Express) fica obrigatoriamente, com o mesmo tamanho e legibilidade: e exigida pela SISP. Linha final com direitos e o credito "Sistema desenvolvido por WANDR" como hoje.

### Comportamento geral
- O campo "Ilha" da pesquisa e o filtro por ilha das Experiencias sao o mesmo estado: mudar um muda o outro.
- "Hoje" (para a proxima data livre) e o dia em Cabo Verde (Atlantic/Cape_Verde), como o servidor.
- Miniatura Wikimedia: se a foto falhar a carregar, usa o URL original.
- Sem `fade-up` a esconder conteudo: as seccoes aparecem logo.
- Imagens com `loading="lazy"` e `decoding="async"`, proporcao fixa para nao saltarem.
- Foco visivel em tudo o que e clicavel; `prefers-reduced-motion` desliga as transicoes.

## Fim do trabalho

Termina com verificacao local no browser (375, 768 e 1280 px; favoritos, sessao, painel de perfil, PT/EN, EUR/CVE) e commit. Implantar em saldesk.cv so com autorizacao explicita do dono; ao implantar, apagar a maqueta tambem do servidor se la estiver, e voltar a verificar a sessao do viajante e os favoritos no dominio real.

## O que fica ao criterio de quem constroi

- Organizacao interna do CSS (blocos comentados por seccao), nomes de classes novas.
- Se as funcoes puras do cartao (duracao, formato, linguas, incluidos, preco, titulo por lingua, sinal de procura e data, miniatura Wikimedia) vao para um ficheiro proprio partilhavel e testavel, como ja acontece com `_lugares.js` e `_booking-widget.js`.
- Textos EN equivalentes aos PT.

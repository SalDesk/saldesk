# Cor da pagina publica e do widget (desenho curto)

Data: 2026-11-15. O utilizador escolheu "Cor do widget" entre os itens em aberto. Tudo o que abaixo diz "minha escolha"
e uma proposta minha, nao uma decisao dele.

## Intencao

O operador escolhe a cor principal da sua pagina de reservas (`app.saldesk.cv/book/<slug>`), que e tambem o que o
widget embebido nos sites dos operadores mostra (o widget e um iframe dessa pagina). Hoje as cores sao fixas (azul
oceano) e o seletor de cor do separador Widget foi retirado por nao fazer nada.

## Objectivos

- Uma cor por operador (`#rrggbb`), guardada no perfil publico, aplicada a botoes, destaques e cabecalhos da pagina publica.
- Quem nao escolhe nada fica exactamente como esta hoje (mesmos valores, sem alteracao visual).
- A cor escolhida tem de dar texto branco legivel (contraste minimo 4.5:1, WCAG AA); cores demasiado claras sao recusadas
  com uma mensagem clara, no ecra e no servidor.
- O preview do separador Widget mostra a cor guardada (ja e um iframe da pagina real).

## Fora do ambito

- Temas completos (fundo escuro, tipo de letra, cantos), varias cores, cor secundaria. A cor "sand" (botoes de destaque, dourado) fica fixa.
- A app do operador (so a pagina publica `/book/*` muda), portais de viajante/equipa/admin.
- Cor do botao verde do WhatsApp (marca do WhatsApp).

## Anti-objectivos

- Mudar a paleta `ocean` do Tailwind (usada em toda a app do operador): risco de regressao sem beneficio.
- Aceitar qualquer string como cor (so `#rrggbb` validado; nada de CSS livre).

## Abordagens consideradas

1. **Familia nova `brand-*` no Tailwind assente em variaveis CSS com valores por omissao iguais a `ocean-*` (escolhida).**
   Troca-se `ocean-` por `brand-` so em `PublicBooking.jsx`; a pagina publica define as variaveis a partir da cor do operador.
   Sem cor definida, os valores por omissao sao os do `ocean` actual: zero diferenca visual. A app do operador nao e tocada.
2. Alterar a paleta `ocean` para variaveis. Rejeitada: afecta a app inteira.
3. CSS injectado a sobrepor classes `.bg-ocean-700` etc. Rejeitada: frágil (128 usos, muitas variantes).

## Desenho

- **Dados:** coluna `operators.brand_color text` (nula = cor por omissao). Valor guardado em minusculas `#rrggbb`.
- **Validacao (backend, `helpers/brandColor.js`):** `validarCor(valor)` devolve `{ok, cor}`; `null`/string vazia = limpar;
  formato `^#[0-9a-fA-F]{6}$`; contraste do branco sobre a cor >= 4.5 (calculo de luminancia relativa WCAG).
  `PUT /onboarding/operator` devolve 400 `INVALID_BRAND_COLOR` se invalida.
- **Leitura publica:** `GET /public/:slug` passa a devolver `brand_color` no operador.
- **Paleta (frontend, `utils/brandPalette.js`):** a partir da cor base (=tom 700, o dos botoes) derivam-se os tons
  900/800/600/500/400/300/200/100/50 misturando com preto ou branco (minha escolha dos pesos). `aplicarCorDaMarca(hex)`
  define `--brand-<tom>-rgb` em `document.documentElement` e devolve uma funcao que as remove (hook `useBrandColor`).
- **Tailwind:** `brand: { 900: 'rgb(var(--brand-900-rgb, 6 42 56) / <alpha-value>)', ... }` com os valores por omissao do `ocean`.
- **Definicoes:** novo cartao "Cor da pagina publica" em Definicoes > Perfil Publico: seletor de cor nativo, campo hex,
  cores sugeridas, pre-visualizacao de um botao, aviso de contraste (impede guardar), botao "Repor cor original".
- **Widget (separador Marketing):** nota a dizer que a cor se define no Perfil Publico e se aplica ao widget.

## Deixado ao construtor

Cores sugeridas exactas, pesos da mistura de tons, texto das mensagens.

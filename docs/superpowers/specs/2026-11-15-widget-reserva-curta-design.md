# Widget embebido: versao curta (desenho curto)

Data: 2026-11-15. O utilizador escolheu a opcao "Lista de servicos + reservar" entre tres propostas minhas
(formulario unico de pesquisa; pagina inteira com seccoes a escolha). O resto e proposta minha, marcada "minha escolha".

## Intencao

O widget (iframe de `app.saldesk.cv/book/<slug>?widget=1` no site do operador) mostrava a pagina publica inteira,
so sem menu e rodape: hero, galeria, avaliacoes, FAQ, mapa... num iframe isso e longo e desfocado. Passa a mostrar so
o que serve para reservar.

## Objectivos

- Em modo widget, `/book/:slug` mostra: nome (e frase) do operador, seletores EUR/CVE e PT/EN, a lista de servicos com
  os botoes "Ver detalhes" e "Reservar" (os cartoes ja existentes) e o rodape "Tecnologia SalDesk".
- "Reservar" abre a pagina do servico, que ja e widget-aware (continua sem menu/rodape, pagamento SISP em `_top`).
- Restaurante: em vez dos servicos mostra so o formulario de reserva de mesa (o que ja existia na pagina completa).
- Sem servicos: mensagem "De momento nao ha servicos disponiveis." em vez de uma pagina vazia.

## Fora do ambito

- Filtros por categoria/preco/duracao e a seccao "Mais popular" (minha escolha: o iframe e pequeno).
- Escolher que seccoes aparecem; formulario unico de pesquisa; mudar a pagina do servico.
- QR de mesa de restaurante (`/book/:slug/mesa/:id`): mantem o fluxo completo.

## Anti-objectivos

- Alterar a pagina normal (sem `?widget=1`): fica igual (teste proprio).
- Chat, botao do WhatsApp e barra de reserva no telemovel dentro do widget (o site do operador ja tem os seus).

## Desenho

- Componente `WidgetCompacto` em `PublicBooking.jsx`, reutilizando `ServiceCard` e `RestaurantReservationSection`.
- Retorno antecipado em `PublicBooking` quando `isWidget && !tableMode`, depois de carregar os dados (sem hooks depois desse ponto).
- Cor da marca (`brand-*`), `useWidgetResize` e telemetria continuam iguais.
- Operadores que ja embebem o widget passam a ver a versao curta (mudanca pretendida).

## Deixado ao construtor

Espacamentos, grelha (1 coluna no movel, 2 a partir de `sm`), texto da mensagem sem servicos.

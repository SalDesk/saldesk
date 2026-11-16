# Dashboard do operador: cartao de destaque + agenda do dia - desenho

Data: 2026-11-16. Estado: para aprovacao do dono.
Maqueta aprovada: `.superpowers/brainstorm/6621-1794869755/content/dashboard-c-com-agenda.html` (direcao "C com a agenda da B").

## 1. Intencao

O dono quer um dashboard com mais impacto visual (estilo "produto SaaS", como o site saldesk.cv inspirado no GoSaaS) sem perder a utilidade de balcao. Das tres direcoes mostradas escolheu a C (cartao de destaque em gradiente, numeros com icone) mas com a **agenda do dia** da B no centro do ecra, no lugar dos cartoes de tours: o operador ve de relance o que ja aconteceu, o que esta a decorrer agora e o que vem a seguir.

O dashboard atual (Fase 2 do redesenho, 2026-11-03) mantem-se como base de dados e logica; o que muda e a vista "Hoje" e a sua hierarquia.

## 2. Objetivos, nao-objetivos, anti-objetivos

Objetivos:
- Vista "Hoje" com: cabecalho, cartao de destaque, 4 numeros com icone, agenda do dia (esquerda, ~63%), coluna da direita com "Requer atencao", atalhos e proximos 7 dias.
- A agenda existe para os 4 tipos de operador, cada um com o seu conteudo (secao 5).
- Entrega em duas etapas: **Etapa 1** = moldura comum + agenda de atividades, implantada sozinha; **Etapa 2** = agendas de hotel, rent-a-car e restaurante na mesma moldura.

Nao-objetivos:
- A vista "Resumo" (`ResumoView.jsx`) nao muda. O interruptor "Hoje / Resumo" mantem-se.
- Nao muda a barra lateral, a barra superior, nem outras paginas.
- Sem alteracoes a base de dados. Backend so se for estritamente necessario (secao 7).
- Sem novas funcionalidades de negocio (os atalhos levam a ecras que ja existem).

Anti-objetivos (falha mesmo que funcione):
- Uma agenda vazia ou errada num dia com reservas (ex.: tours sem hora a desaparecer).
- Perder informacao que o "Hoje" atual ja mostra: "Requer atencao" com os mesmos itens, aviso de periodo de avaliacao (`TrialStrip`), pedidos de WhatsApp por enviar (`WhatsAppPendentes`), proximos 7 dias.
- Um ecra lento: o dashboard nao pode fazer mais pedidos em serie do que hoje (os pedidos novos correm em paralelo com os atuais, e cada falha cai para vazio sem apagar o resto, como ja acontece).
- Quebrar no telemovel.

## 3. Estrutura da vista "Hoje" (todos os tipos)

De cima para baixo (ver maqueta):

1. **Cabecalho** (`DashboardHeader`, ja existe): "Bom dia, <nome>", subtitulo com a data por extenso e a hora atual; interruptor Hoje/Resumo; botoes "Ver calendario" e "+ Nova reserva". Saudacao conforme a hora local (Bom dia / Boa tarde / Boa noite) - decisao minha, facil de reverter. O cabecalho e partilhado: muda logo na Etapa 1 para **todos os tipos e para as duas vistas** (o subtitulo atual "tipo · mes" desaparece). E so texto; decisao minha.
2. `TrialStrip` e `WhatsAppPendentes` mantem-se logo abaixo do cabecalho, como hoje.
3. **Cartao de destaque** em gradiente ocean-800 -> ocean-600, texto branco, tres zonas:
   - Receita do mes (numero grande), variacao face ao mes anterior (pilula), e um grafico de area pequeno da receita por dia do mes ate hoje (linha sand).
   - Anel de ocupacao do mes (percentagem) com a metrica de volume do tipo (ver secao 5).
   - "Hoje": o numero principal do dia do tipo (ver secao 5) e uma linha curta ("em 4 tours · 2 por confirmar").
4. **Quatro numeros com icone**: quadrado de icone colorido + valor + etiqueta. Comuns: Reservas no mes, Avaliacao media, Valor medio por reserva, Por receber. (Hotel/rent-a-car/restaurante podem trocar um deles na Etapa 2, ver secao 5.)
5. **Grelha de duas colunas** (`minmax(0,1.7fr) minmax(0,1fr)`):
   - Esquerda: **Agenda de hoje** (secao 4).
   - Direita, empilhados: **Requer atencao** (`AttentionPanel` com `buildAttentionItems`, sem mudar a logica), **Atalhos** (secao 6), **Proximos 7 dias** (a faixa atual, compacta).

Telemovel (< 768 px): tudo numa coluna, nesta ordem: cabecalho, cartao de destaque (as tres zonas empilhadas), numeros em grelha 2x2, agenda, requer atencao, atalhos, 7 dias. Decisao minha.

Estilo: tokens existentes (ocean/sand/neutros, Sora para titulos e numeros, DM Sans no resto, `tabular-nums` nos numeros, estados com os tokens de sucesso/aviso/erro/info). Sem cores hexadecimais nem cores nomeadas do Tailwind nos componentes (os testes atuais ja verificam isto noutras paginas).

## 4. A agenda (componente comum)

Linha do tempo vertical: hora a esquerda, ponto na linha, cartao do evento a direita. Cada evento tem: titulo, linha secundaria, barra de lotacao opcional, pilula de estado opcional, e opcionalmente iniciais de clientes.

Estados visuais por hora local do dispositivo:
- **Concluido**: hora de fim ja passou -> cartao esbatido, pilula "Concluido".
- **A decorrer**: agora entre inicio e fim -> cartao com contorno ocean e anel suave, ponto cheio, linha "A decorrer, termina as HH:MM", iniciais dos clientes (ate 3 + "+N").
- **A seguir**: o resto.
- Eventos **sem hora** aparecem num grupo "Sem hora marcada" no topo da agenda (nunca desaparecem).
- Eventos **sem duracao** contam como 60 minutos para decidir "a decorrer"/"concluido" (decisao minha).

Ordenacao por hora de inicio; empates pela ordem alfabetica do titulo.
Agenda vazia: estado vazio curto com "+ Nova reserva" (o `EmptyState` atual).
Clicar num evento abre a lista de reservas filtrada por esse dia (rota existente `/reservas`; o filtro exato fica ao construtor, desde que leve as reservas desse evento).

O componente recebe uma lista de eventos ja normalizada (`{ id, inicio, fim, titulo, detalhe, lotacao?, estado?, clientes? }`) e a hora atual; nao conhece tipos de operador. Cada tipo tem uma funcao pura que transforma os seus dados em eventos (testavel sem React, como `dashboardLogic.js`).

## 5. Conteudo por tipo

| Tipo | Etapa | Eventos da agenda | Cartao de destaque: anel | Cartao: "Hoje" |
|---|---|---|---|---|
| Atividades | 1 | Um evento por **(tour, horario)** com reservas hoje: tours com varios horarios (`time_slots` da ficha) dao um evento por horario, porque a reserva guarda o horario escolhido em `start_time`. Hora: `start_time` da reserva se existir, senao `start_time` da ficha do tour (meta JSON da descricao). Lotacao: capacidade do horario se a ficha a tiver, senao a do tour. Fim: inicio + duracao da ficha (`meta.duration`, em **horas**, x 60); sem duracao, 60 min. (As reservas de atividades nao guardam `duration_minutes`.) Detalhe: "pessoas/capacidade · guia <nome> · <ponto de encontro>". Pilula: "N por confirmar" se houver pendentes; "Quase cheio" se >= 80%. Iniciais dos clientes no evento a decorrer. | Ocupacao do mes (calculo atual) + "N participantes" | Pessoas hoje + "em N tours · N por confirmar" |
| Hotel | 2 | Chegadas (check_in = hoje) e partidas (check_out = hoje), uma por reserva. Sem hora prevista na base de dados nem definicao de horas da propriedade: chegadas aparecem as **14:00** e partidas as **11:00**, horas fixas (decisao do dono, 2026-11-16; sem alteracao de base de dados). Duracao para o estado visual: 60 min. Detalhe: quarto, hospedes, noites. | Ocupacao dos quartos no mes | Chegadas e partidas hoje |
| Rent-a-car | 2 | Levantamentos (check_in = hoje) e devolucoes (check_out = hoje). Hora: `start_time` da reserva se existir; senao "Sem hora marcada". Detalhe: viatura (frota/matricula), cliente. | Ocupacao da frota no mes | Levantamentos e devolucoes hoje |
| Restaurante | 2 | Uma por reserva de mesa hoje. Hora: `start_time`. Fim: + `duration_minutes` (senao 90 min). Detalhe: mesa, pessoas, pre-pedido se houver. | Ocupacao das mesas | Pessoas hoje + reservas |

Os numeros de "ocupacao" de hotel/rent-a-car/restaurante reaproveitam os calculos que os dashboards atuais desses tipos ja fazem. Enquanto a Etapa 2 nao estiver feita, esses tipos continuam com a vista "Hoje" atual.

Guias (atividades): vem de `job_assignments` (servico `listAssignments`), ligados a reserva por `reservation_id`; se o tour tiver reservas com guias diferentes, mostra o primeiro e "+N". Sem guia atribuido, a parte "guia ..." nao aparece.

## 6. Atalhos

Quatro botoes, todos para ecras que ja existem (decisao minha, o dono pode trocar):
- **Check-in**: reservas de hoje (`/reservas`, vista do dia).
- **Bloquear dia**: calendario (`/calendario`), onde ja existe o bloqueio.
- **Enviar mensagem**: `/mensagens`.
- **Registar pagamento**: reservas por pagar (`/reservas` com filtro de pagamento pendente, se o filtro existir; senao `/financeiro`).

## 7. Dados e restricoes

- Etapa 1 sem alteracoes de backend nem de base de dados. Dados ja disponiveis: reservas de hoje, do mes, dos 7 dias e por pagar (pedidos atuais); `getResumo` (receita e variacao); `getReceita(inicio, fim, 'day')` para o grafico (confirmado: `bucketKey` devolve a data tal como esta, a granularidade diaria ja funciona); `/reviews/stats`; `listAssignments` para os guias.
- `listAssignments` so filtra por data de criacao: na Etapa 1 pede-se a lista e cruza-se no browser por `reservation_id`. Se ficar pesado, acrescentar um filtro por reservas no backend.
- "Valor medio por reserva" = receita do mes / reservas confirmadas do mes (0 reservas -> "—").
- "Por receber" = soma de (`total_price` - `amount_paid`) das reservas por pagar ja iniciadas (a mesma lista que alimenta "Requer atencao").
- Hora: hora local do dispositivo (como o `TODAY` atual); o operador esta em Cabo Verde.
- Idiomas: todos os textos novos com i18n nos 4 idiomas (pt, en, de, nl), como o resto do dashboard.
- Testes: cada funcao pura com testes (eventos por tipo, estados a decorrer/concluido, sem hora, sem duracao); componentes com testes de comportamento; regra do repositorio de TDD.
- Implantacao: a Etapa 1 implanta-se sozinha (so frontend), com a vista "Hoje" de hotel/rent-a-car/restaurante intacta.
- `components/ui/*` nao muda (regra do projeto).

## 8. Abordagens consideradas

1. **Tudo de uma vez** (moldura + 4 agendas numa implantacao): resultado uniforme, mas implantacao maior e 3 tipos sem dados reais (3 hoteis, 1 rent-a-car, 1 restaurante, 0 reservas em producao).
2. **Moldura comum por etapas** (escolhida): atividades primeiro (18 operadores, 96 reservas), validado com dados reais, depois os outros tipos sobre a mesma moldura.
3. **So o aspeto**: pintar o dashboard atual no estilo C, agenda so em atividades. Mais barato, mas nao entrega a agenda dos outros tipos e mantem 4 dashboards separados.

Escolhida a 2 pelo dono.

Nota sobre a maqueta: as linhas de detalhe de "Requer atencao" na maqueta ("Kitesurf 14:00", "3 dias de atraso") sao ilustrativas; o painel usa os itens que `buildAttentionItems` ja produz, sem mudar a logica.

## 9. Deixado ao construtor

- Nomes de ficheiros e divisao em componentes (seguir `pages/dashboard/*` e `components/dashboard/*`).
- Como desenhar o grafico de area (SVG simples, sem biblioteca nova) e o anel.
- O filtro exato de `/reservas` usado ao clicar num evento e nos atalhos.
- Pequenos ajustes de espacamento face a maqueta.

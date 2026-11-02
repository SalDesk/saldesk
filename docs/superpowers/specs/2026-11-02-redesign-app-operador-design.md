# Redesenho da app do operador (app.saldesk.cv) - desenho

Data: 2026-11-02. Estado: para revisao.

## 1. Objetivo

Transformar a app do operador numa ferramenta **utilitaria, densa e profissional**, mais atraente do que a atual, sem perder a identidade da marca (ocean + sand). Reorganizar a interface (navegacao, layout, hierarquia), nao so mudar cores.

Utilizadores: o dono/operador, que usa a app de duas formas: **ao balcao** (ver o dia, criar e alterar reservas, responder a clientes) e **como gestor** (numeros, receita, ocupacao). Nao ha perfis separados na conta: a equipa usa um portal a parte (`/staff`). A distincao e feita por duas **vistas** do mesmo ecra, escolhidas pelo utilizador.

Sucesso:
- O operador chega a qualquer ecra em 1 a 2 cliques ou por pesquisa (Ctrl K), sem percorrer uma lista de 28 itens.
- O Dashboard mostra o que precisa de acao no dia, e nao cartoes a zeros e blocos vazios.
- Tabelas densas e legiveis (mais linhas por ecra, numeros alinhados).
- Cada fase entra em producao sozinha, sem partir paginas ainda nao migradas.

## 2. Ambito

**Dentro:** a app do operador (`/`, layout `Layout`, 4 tipos de operador: atividades, hotel, rent-a-car, restaurante) e as paginas de entrada (`/login`, `/register`, `/reset-password`).

**Fora (nao mexer):** portal da equipa (`/staff`), portal do viajante (`/viajante`), vendedor de praia (`/vendedor`), painel do fundador (`/admin`), paginas publicas de reserva (`/book/*`), site de marketing.

## 3. Estado atual (resumo)

- Frontend React + Vite + Tailwind, ~45 mil linhas, 50 paginas. Tokens ocean/sand/neutros em `tailwind.config.js` e `styles/tokens.css`.
- `components/layout/Sidebar.jsx`: **4 listas de navegacao duplicadas** (`TYPE_NAV`), ate 28 itens planos por tipo, sem agrupamento.
- `pages/Dashboard.jsx` (1769 linhas): quatro dashboards (hotel, rent-a-car, restaurante, atividades) mais um generico, cada um com o seu mapa.
- Componentes partilhados: Button (59 ficheiros), Input (40), Modal (32), Card (30), Badge (23), Table (5). Escritos a mao: ~35 tabelas, ~550 botoes, ~170 inputs, 41 selects.
- `Login.jsx` tem desenho proprio (cartao de vidro sobre foto), diferente do `AuthLayout` usado por Registo e recuperacao de password.
- Apenas 2 testes de componentes.

## 4. Decisoes tomadas

| Tema | Decisao |
|---|---|
| Navegacao | Barra lateral agrupada em 5 seccoes, com pesquisa Ctrl K |
| Estilo | Azul da marca, mais expressivo (barra ocean, botao principal sand, cartao de destaque com gradiente) |
| Login | Dividido: foto de Cabo Verde + proposta de valor a esquerda, formulario branco a direita |
| Implementacao | Base primeiro, depois pagina a pagina (abordagem 1) |
| Vistas do Dashboard | Interruptor "Hoje / Resumo", guardado no browser |

## 5. Fase 1 - base visual e estrutura

### 5.1 Tokens
- Mantem-se a paleta ocean/sand/neutros e as fontes Sora (titulos e numeros grandes) e DM Sans (resto).
- Novos tokens de estado, versao suave e forte: sucesso, aviso, erro, info. Passam a ser a unica fonte das cores de estado.
- Tabelas e formularios com texto de 12 a 13 px; etiquetas em minusculas normais (sem micro-texto em maiusculas); numeros com `tabular-nums`, alinhados a direita.
- Cantos 8 px (cartoes, campos) e 6 px (botoes); sombras mais leves; botao principal sand, secundario com contorno.

### 5.2 Ambito do tema
Os componentes partilhados sao tambem usados pelo portal do viajante, da equipa e pelo painel do fundador. O tema novo e controlado por variaveis CSS definidas no contentor da app do operador (por exemplo `data-ui="app"` no `Layout`); fora dele mantem-se o aspeto atual. Assim o ambito fica garantido e os outros portais podem migrar mais tarde.

### 5.3 Estrutura
- **Barra lateral** de 240 px, 5 seccoes: Operacao, Clientes, Gestao, Crescimento, Configuracao. Crescimento e Configuracao comecam recolhidas; o estado fica guardado no browser.
- **Lista de navegacao unica**, substituindo as 4 duplicadas. Cada item declara: rota, icone, rotulo, seccao, tipos de operador em que existe, plano necessario e feature. Itens bloqueados continuam visiveis com selo Pro/Business e abrem o `UpgradeModal`, como hoje.
- Agrupamento (atividades; os outros tipos usam os seus itens equivalentes):
  - **Operacao:** Hoje (Dashboard), Reservas, Calendario, Tours e Atividades / Quartos / Frota / Mesas (conforme o tipo), Guias, Frota, Housekeeping, Manutencao, Menu, Pedidos.
  - **Clientes:** Clientes, Mensagens, Mensagens SalDesk, Avaliacoes, Ocorrencias, Feedback.
  - **Gestao:** Financeiro, Analytics, Previsao, Meteorologia, Colaboradores, RH.
  - **Crescimento:** Marketing, Channel Manager, Automacoes, Fidelidade, Vouchers, Afiliados, Grupos, Pacotes, Parcerias.
  - **Configuracao:** Editor da Pagina, Definicoes.
  - Rodape da barra lateral: "Ver o meu site". Perfil e Sair passam para o menu do utilizador, na barra superior.
- **Contadores** nos itens (reservas por confirmar, mensagens por ler) com dados que a app ja tem.
- **Barra superior:** pesquisa Ctrl K, idioma PT/EN, notificacoes, menu do utilizador. Na primeira versao a pesquisa salta apenas entre **ecras**; pesquisar clientes e reservas fica para depois.
- **Mobile:** mantem-se a barra inferior e o menu "Mais", organizados pelas mesmas seccoes e pela mesma lista de navegacao.
- A ancora do `WelcomeTour` (`data-tour`) e os itens do tour mantem-se.

### 5.4 Componentes
Renovar: Card, Button, Badge de estado, Input, Modal, Table. Criar: `Select`, tabela de dados densa (cabecalho fixo, ordenacao, numeros alinhados), separadores, filtros em chips, estado vazio compacto, cabecalho de pagina padrao (titulo, subtitulo, acoes).

### 5.5 Paginas de entrada
Redesenhar `AuthLayout` (painel esquerdo com foto + proposta de valor, formulario a direita; campos retos com borda clara, "Esqueci a password" a direita na linha de "Lembrar", botao sand). Passar o `Login.jsx` a usar este layout, tal como Registo e recuperacao de password. Manter intacta toda a logica de autenticacao existente de `Login.jsx` (login, lembrar dispositivo por 30 dias, recuperacao de password, redirecionamento conforme o tipo de utilizador) e de `ImpersonateCallback`; so muda a apresentacao.

## 6. Fase 2 - Dashboard

### 6.1 Estrutura comum
Cabecalho com saudacao e linha-resumo ("4 tours hoje, 3 reservas por confirmar") e acoes ("Ver calendario", "Nova reserva"). Aviso do periodo de avaliacao numa faixa fina. Cartoes de numeros com variacao face ao mes anterior; estados vazios em linha curta. O modulo principal depende do tipo e mantem a logica atual, so com o novo aspeto: mapa de quartos (hotel), grelha da frota (rent-a-car), mapa de mesas e turnos (restaurante), tabela "Tours de hoje" (atividades).

### 6.2 Duas vistas
- **Hoje** (por omissao): numeros do dia, modulo principal, painel "Requer atencao", pedidos de WhatsApp por enviar (`WhatsAppPendentes`, ja existente), faixa dos proximos 7 dias com contagens.
- **Resumo:** receita do mes contra o anterior, ocupacao, grafico dos ultimos 30 dias (`recharts`, ja instalado), servicos mais vendidos, reservas recentes.
- Interruptor "Hoje / Resumo" no cabecalho, guardado no browser. So dados que a app ja tem (financas, reservas, unidades, meteorologia): **sem alteracoes no backend**. A variacao face ao mes anterior pede uma segunda chamada a `getResumo` para o periodo anterior.

### 6.3 "Requer atencao"
Junta o que ja se calcula: reservas por confirmar, pagamentos pendentes, tours sem guia, documentos da frota a expirar (`computeDocAlerts`), mau tempo previsto (`isBadWeather`), mensagens por enviar. Cada linha tem a acao ("Atribuir", "Abrir").

### 6.4 Organizacao do codigo
Dividir `Dashboard.jsx` em `pages/dashboard/` (um ficheiro por tipo e blocos partilhados). So o necessario para esta mudanca.

## 7. Fases 3 a 6 - migracao por modulo

O que os componentes renovados apanham sozinho: Button, Input, Modal, Card, Badge. O que nao: tabelas, botoes, inputs e selects escritos a mao; esses migram pagina a pagina para os componentes novos.

Ordem (do mais usado para o menos):
- **Fase 3, Operacao:** Reservas, Calendario, Unidades (`UnitForm`, 1452 linhas), Guias, Frota.
- **Fase 4, Clientes:** Clientes, Mensagens, Avaliacoes, Ocorrencias, Feedback.
- **Fase 5, Gestao:** Financeiro, Analytics, Previsao, Meteorologia, Colaboradores, RH.
- **Fase 6, Crescimento e Configuracao:** Definicoes, Marketing, Channel Manager, Automacoes, Fidelidade, Vouchers, Afiliados, Grupos, Pacotes, Parcerias, Editor da Pagina.

Cada fase tem o seu plano e o seu commit, e e publicada de forma independente.

## 8. Validacao

Com apenas 2 testes de componentes, a validacao e sobretudo visual e de build:
- Por fase: `vite build`, os testes existentes e abrir as paginas no browser com a conta de demonstracao (`/demo`), em computador (1280 px) e telemovel (375 px), com a consola sem erros.
- Testes unitarios novos para a logica nova: lista de navegacao (filtragem por tipo e plano, agrupamento) e calculo de "Requer atencao".
- Cada fase e reversivel por si so.

## 9. Riscos

| Risco | Mitigacao |
|---|---|
| Os componentes partilhados mudam portais fora de ambito | Tema novo controlado no contentor da app (5.2) |
| Paginas muito grandes (`PublicBooking` fica fora; `UnitForm`, `Financial`, `Reservations`, `Staff` entram) | Migrar por blocos, uma pagina por commit |
| Pouca rede de seguranca em testes | Validacao visual por fase e testes para a logica nova |
| Mudar habitos de quem ja usa a app | Mesmos nomes e rotas; so a organizacao e o aspeto mudam |
| Perda de funcionalidades escondidas (seccoes recolhidas, bloqueios por plano) | Pesquisa Ctrl K cobre todos os ecras; itens bloqueados continuam visiveis |

## 10. Questoes em aberto

- A pesquisa Ctrl K pesquisa clientes e reservas, alem dos ecras? (Decisao atual: so ecras na primeira versao.)
- "Mensagens SalDesk" mantem-se como item proprio ou passa a separador dentro de Mensagens?
- Modo escuro: fora do ambito, mas os tokens ficam preparados para o permitir mais tarde.
- Quando migrar os portais da equipa e do viajante para o mesmo estilo.

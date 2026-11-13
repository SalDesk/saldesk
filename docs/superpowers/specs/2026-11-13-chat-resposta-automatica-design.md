# Chat do site: resposta automatica fora de horas (desenho curto)

Data: 2026-11-13. Versao simples escolhida pelo utilizador ("escolhe a versao simples e avanca").
O utilizador nao disse o porque; o desenho abaixo e uma proposta minha (marcada como "minha escolha").

## Intencao

Quando um hospede escreve no chat da pagina publica do operador e o operador nao esta disponivel,
o hospede recebe logo uma mensagem a dizer que a resposta vem mais tarde, em vez de ficar sem sinal nenhum.

## Objectivos

- Uma resposta automatica por conversa, fora do horario de atendimento do operador.
- O operador liga/desliga, define dias e horas de atendimento e pode editar o texto (PT e EN).
- Nunca bloquear nem atrasar o chat: se a resposta automatica falhar, a mensagem do hospede segue na mesma.

## Fora do ambito (nao objectivos)

- Respostas por palavras-chave / FAQ, respostas escritas por IA, respostas sobre precos ou disponibilidade.
- Horarios que atravessam a meia-noite (de 22:00 a 06:00), feriados, varios intervalos por dia.
- Enviar a resposta automatica por e-mail (o hospede ve-a no proprio chat, que ja faz polling).

## Anti-objectivos

- Responder a cada mensagem (spam): uma so resposta por conversa enquanto durar o silencio do operador.
- Responder quando o operador (ou o sistema) ja falou com o hospede recentemente.

## Abordagens consideradas

1. **Resposta no envio da mensagem do hospede (escolhida).** `sendGuestChatMessage` decide e insere a mensagem
   automatica. Simples, imediata, sem agendador novo.
2. Estender o motor de Automacoes (cron de hora a hora). Rejeitada: so tem gatilhos por data e corre de hora a hora,
   a resposta chegaria ate uma hora tarde.
3. Resposta escrita por IA. Rejeitada para esta versao: risco de dizer coisas erradas sobre preços e disponibilidade.

## Desenho

- **Dados:** coluna `operators.chat_auto_reply jsonb` (nula = desligado). Forma:
  `{ enabled: boolean, days: number[0-6], from: 'HH:MM', to: 'HH:MM', message_pt: string, message_en: string }`.
  `days` usa 0 = domingo. Intervalo `[from, to)` no mesmo dia, hora de Cabo Verde (`Atlantic/Cape_Verde`, UTC-1, sem horario de verao) (minha escolha).
- **Quando responde:** `enabled` e agora fora do horario (dia nao incluido, ou hora fora de `[from, to)`) e
  nao ha nenhuma mensagem do operador/sistema para este hospede nas ultimas 12 horas (minha escolha) .
- **Mensagem:** `message_pt`/`message_en` conforme o idioma enviado pelo widget (`lang`, por omissao PT); se vazia usa um texto
  por omissao.
- **Como se guarda:** linha em `messages` com `sender_type='system'`, `recipient_type='guest'`, `message_type='direct'`,
  `channel='internal'` (sem alterar constraints). O widget mostra-a pelo polling que ja existe; o operador ve-a no painel (evento `message:new`).
- **Definicoes:** cartao "Chat do site: resposta automatica" em Definicoes > Perfil Publico (a pagina onde o chat vive);
  guardado por `PUT /onboarding/operator` com validacao no backend (400 `INVALID_CHAT_AUTO_REPLY`).

## Deixado ao construtor

Textos por omissao exactos, aspecto do cartao, mensagens de erro de validacao.

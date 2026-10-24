# WhatsApp Cloud API (camada de mensagens, fase 3)

Canal oficial da Meta, chamado directamente (sem intermediário). Fica **desligado** até haver configuração:
sem `CLOUD_API_ENABLED=true` o webhook responde 404 e nenhum operador usa este canal.

## Como funciona

- **Canal por operador:** `messaging_config` (`provider=cloud_api`, `cloud_status=active`). Qualquer outra situação
  (pendente, suspenso, sem configuração) usa o `wa.me`, em que é uma pessoa que envia.
- **Só com consentimento:** a reserva tem de ter `whatsapp_opt_in=true` (caixa por marcar no formulário público; ou o
  operador a marcar na reserva manual). Sem opt-in vai pelo `wa.me`, mesmo com a Cloud API activa.
- **Dentro das 24 h seguintes à última mensagem do cliente:** texto livre (os textos editáveis em Definições > Mensagens).
  **Fora:** só templates aprovados (biblioteca fixa em `backend/src/messaging/metaTemplates.js`, submetida na WABA de
  cada operador). Sem template aprovado a mensagem falha com motivo explícito (`fora_da_janela_sem_template_aprovado`).
- **Automações** (texto livre do operador) não têm template: continuam pelo `wa.me`.
- **Envio assíncrono:** o botão do painel deixa a mensagem na outbox e o worker envia; nenhuma chamada à Meta dentro de
  um pedido do utilizador. Limite por operador (≈20/min) para não degradar a qualidade do número.
- **Qualidade:** de hora a hora o worker consulta o número; `RED`, `FLAGGED`, restrito, banido ou desligado
  **suspende** o canal (as mensagens passam ao `wa.me`) e avisa o fundador. Reactivar é decisão humana.
- **Segredos:** o token de cada operador fica cifrado (AES-256-GCM, chave `MESSAGING_ENCRYPTION_KEY` só no servidor) em
  `messaging_secrets`. Nunca em texto, nunca no repositório. **Não mudar a chave depois de criada.**

## Ligar um operador (feito pela Wandr)

Pré-requisitos do lado da Meta (developers.facebook.com / business.facebook.com):
1. Uma app com o produto WhatsApp; guardar o **App Secret** (Definições da app > Básico).
2. A conta WhatsApp Business (WABA) e o número do operador; guardar o **phone_number_id** e o **waba_id**.
3. Um **token de sistema** (utilizador de sistema do Business Manager, permissões `whatsapp_business_messaging` e
   `whatsapp_business_management`). Os tokens temporários de 24 h só servem para testes.
4. No painel da app, WhatsApp > Configuração > Webhook: URL `https://api.saldesk.cv/webhooks/whatsapp/cloud`, token de
   verificação (impresso por `cloud_env.sh`), e subscrever os campos `messages` e `message_template_status_update`.
5. Número de teste: acrescentar os destinatários permitidos (máximo 5).

No servidor:
```
ssh -t -i ~/.ssh/saldesk_vps root@76.13.248.135 sh /root/cloud_env.sh        # uma vez: chaves e App Secret
cd /var/www/saldesk/repo/backend
node scripts/messaging-cloud.js connect <slug> --phone-id <id> --waba-id <id>  # pede o token sem eco
node scripts/messaging-cloud.js templates <slug> submit                        # submete os 6 templates (PT e EN)
node scripts/messaging-cloud.js templates <slug> sync                          # ver aprovações
node scripts/messaging-cloud.js status <slug>
node scripts/messaging-cloud.js suspend|activate <slug>
node scripts/messaging-cloud.js disconnect <slug>                              # apaga o token e volta ao wa.me
```

## Critério de saída da fase 3

30 dias com taxa de entrega acima de 95 % e nenhuma queda de qualidade do número.

```sql
-- Taxa de entrega dos ultimos 30 dias, por operador (Cloud API)
select o.name,
       count(*) filter (where m.status in ('sent','delivered','read','failed')) as enviadas,
       count(*) filter (where m.status in ('delivered','read'))                 as entregues,
       count(*) filter (where m.status = 'failed')                              as falhadas,
       round(100.0 * count(*) filter (where m.status in ('delivered','read'))
             / nullif(count(*) filter (where m.status in ('sent','delivered','read','failed')), 0), 1) as pct_entrega
from message_outbox m join operators o on o.id = m.operator_id
where m.provider = 'cloud_api' and m.created_at > now() - interval '30 days'
group by o.name;
```

## Antes de activar com clientes reais

- Rever com o jurista e acrescentar à Política de Privacidade e aos Termos (rascunho abaixo).
- Confirmar o custo por mensagem/template e a quota por plano (decisão em aberto no documento de desenho).
- Pedidos de avaliação contam como **marketing** para a Meta (custam mais e pesam na qualidade do número).
- O Embedded Signup (onboarding sem a Wandr) fica para quando a Meta aprovar a app como Tech Provider.
- **Por fazer:** tratar automaticamente a resposta "PARAR" (retirar o consentimento da reserva). Hoje as mensagens recebidas
  ficam guardadas (message_inbound) mas nao accionam nada; ate la, quem retira o consentimento fala com o operador.

### Rascunho para a Política de Privacidade (a rever por um jurista)

> **WhatsApp.** Se nos indicar o seu número de telefone e aceitar, enviamos-lhe mensagens sobre a sua reserva
> (confirmação, lembrete e pedido de avaliação) através do WhatsApp. Para isso, o seu nome, número de telefone e os
> dados da reserva são tratados pelo operador turístico responsável pela reserva e pela Meta Platforms Ireland Ltd.,
> que presta o serviço WhatsApp Business como subcontratante. Pode retirar o consentimento a qualquer momento,
> contactando o operador, sem prejuízo da reserva.

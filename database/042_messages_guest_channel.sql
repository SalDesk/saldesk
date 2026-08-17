-- SalDesk - Mensagens internas ganham destinatario "guest" (hospede real)

-- Ate agora messages.recipient_type so aceitava manager/staff/group -- a caixa
-- interna nao tinha nenhum conceito de cliente/hospede como destinatario.
-- channel regista como a mensagem foi (ou devia ser) entregue: 'internal'
-- para staff-a-staff (nunca sai da app), 'email'/'whatsapp' para hospedes,
-- usando os mesmos helpers ja provados em producao pelas Automacoes.
alter table messages drop constraint if exists messages_recipient_type_check;
alter table messages add constraint messages_recipient_type_check
  check (recipient_type in ('manager','staff','group','guest'));

alter table messages add column if not exists channel text not null default 'internal'
  check (channel in ('internal','email','whatsapp'));

-- Preenchido so quando channel != 'internal': confirma se o envio real
-- (SendGrid/Twilio) teve sucesso, sem bloquear o registo da mensagem em si.
alter table messages add column if not exists delivery_status text
  check (delivery_status in ('sent','failed'));

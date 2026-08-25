-- SalDesk - Chat publico a serio (widget da pagina do operador deixa de ser
-- so um formulario de contacto de uma via, passa a conversa real e bidireccional)

-- Ate agora sender_type so aceitava manager/staff/system -- o visitante do
-- site publico nunca podia ser o remetente de uma mensagem guardada em
-- messages, so gerava um "lead"/email de uma via (slugContact).
alter table messages drop constraint if exists messages_sender_type_check;
alter table messages add constraint messages_sender_type_check
  check (sender_type in ('manager','staff','system','guest'));

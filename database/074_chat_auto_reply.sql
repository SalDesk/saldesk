-- SalDesk - Chat do site: resposta automatica fora de horas
--
-- Configuracao por operador (nula = desligada). Forma:
--   { "enabled": true, "days": [1,2,3,4,5], "from": "09:00", "to": "18:00",
--     "message_pt": "...", "message_en": "..." }
-- days: 0 = domingo ... 6 = sabado. Horario na hora de Cabo Verde (Atlantic/Cape_Verde).
-- A forma e validada pelo backend (helpers/chatAutoReply.js) ao guardar.
alter table operators add column if not exists chat_auto_reply jsonb;

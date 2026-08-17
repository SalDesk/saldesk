-- SalDesk - Verificacao real da assinatura do webhook PayPal (por operador)

-- Cada operador tem a sua propria conta PayPal Business (credenciais ja
-- guardadas em paypal_client_id_enc/paypal_client_secret_enc). A API de
-- verificacao de assinatura da PayPal (v1/notifications/verify-webhook-signature)
-- exige um access token obtido com as credenciais DA MESMA conta que possui
-- o webhook -- por isso o Webhook ID tem de ser guardado por operador, nao
-- como uma unica variavel global (que so serviria para uma conta).
alter table operators add column if not exists paypal_webhook_id_enc text;

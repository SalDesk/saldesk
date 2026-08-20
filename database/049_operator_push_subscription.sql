-- operators.push_subscription era referenciado por 3 pontos do codigo
-- (paymentController.js's push de confirmacao de pagamento, notifications.js's
-- subscribe/unsubscribe, e o novo callWaiter em publicController.js) mas a
-- coluna nunca existiu -- so staff tem push_subscription (006_fase5_staff.sql).
-- Qualquer select que a incluia falhava a query inteira (coluna inexistente),
-- silenciosamente engolido pelos callers, que so verificam `if (!data)`.
alter table operators add column if not exists push_subscription jsonb;

-- SalDesk - Correcao de 2 bloqueadores criticos antes da fase de teste:
-- 1) Sobreposicao de reservas em condicao de corrida (sem garantia a nivel de BD)
-- 2) Reembolso PayPal usa o order_id em vez do capture_id (guardar o capture_id)

-- ============================================================
-- 1) Impedir sobreposicao de reservas para a mesma unidade
-- ============================================================
-- verificarDisponibilidade() faz um SELECT e so depois o INSERT acontece
-- noutra chamada -- sem transacao nem lock, dois pedidos em simultaneo para
-- a mesma unidade/datas passam ambos a verificacao e ambos inserem. Esta
-- constraint garante a exclusao mesmo sob concorrencia real, ao nivel do
-- Postgres, independente do que a aplicacao verificou antes.
create extension if not exists btree_gist;

alter table reservations
  add constraint reservations_no_overlap
  exclude using gist (
    unit_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('pending','confirmed','checked_in'));

-- ============================================================
-- 2) Guardar o capture_id do PayPal, distinto do order_id
-- ============================================================
-- refundCapture() da paypalService.js chama POST /v2/payments/captures/{id}/refund
-- -- exige o ID da CAPTURA, nao o ID da ORDEM. Ate agora so o order_id era
-- guardado, por isso qualquer reembolso real enviaria o ID errado.
alter table reservations add column if not exists paypal_capture_id text;

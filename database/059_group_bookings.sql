-- SalDesk - Reserva "Groups" (preco fixo por grupo, GetYourGuide + motor interno)

-- Uma reserva de grupo ocupa o slot/dia INTEIRO em exclusivo (mais nenhuma
-- reserva, individual ou de grupo, pode coexistir nesse mesmo slot/dia) --
-- ao contrario de uma reserva individual, que partilha capacidade com
-- outras ate ao limite do slot. Nullable/default false: reservas
-- existentes e todos os outros tipos de operador (hotel/rentacar/
-- restaurante) nunca usam isto.
alter table reservations add column if not exists is_group_booking boolean not null default false;
alter table ota_reservation_holds add column if not exists is_group_booking boolean not null default false;

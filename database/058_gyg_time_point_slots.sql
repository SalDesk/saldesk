-- SalDesk - Suporte a produtos "Time point" da GetYourGuide (reserva por
-- slot de hora especifico, em vez de so "Time period" por dia inteiro)

-- Guarda qual slot (hora) ficou reservado num hold, para createBooking
-- conseguir transportar essa hora para a reserva definitiva. Nullable --
-- so preenchido para unidades com time_slots configurado (TourForm's
-- TimeSlotsEditor); holds de produtos "Time period" continuam sem hora,
-- exactamente como ate agora.
alter table ota_reservation_holds add column if not exists start_time time;

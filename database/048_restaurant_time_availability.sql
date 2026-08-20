-- Tempo real de reserva -- so usado por restaurant; NULL para os restantes tipos
alter table reservations add column if not exists start_time time;
alter table reservations add column if not exists duration_minutes int
  check (duration_minutes is null or duration_minutes > 0);

-- Fecha a divergencia entre o ficheiro de migracao original (check_out > check_in)
-- e o estado real da BD em producao (check_out >= check_in, ja confirmado ao vivo) --
-- idempotente, nao muda comportamento actual.
alter table reservations drop constraint if exists check_dates;
alter table reservations add constraint check_dates check (check_out >= check_in);

-- Exclusao por sobreposicao de HORARIO -- so entra em jogo quando start_time/
-- duration_minutes estao preenchidos (reservas de restaurante). Coexiste com
-- reservations_no_overlap (040) sem conflito: essa usa daterange(check_in,check_out,'[)'),
-- que fica vazio quando check_in=check_out (caso de restaurante), logo nunca colide
-- com esta. Reutiliza a extensao btree_gist ja activa (usada pela constraint 040).
alter table reservations
  add constraint reservations_no_overlap_time
  exclude using gist (
    unit_id with =,
    tsrange(
      (check_in + start_time),
      (check_in + start_time + (duration_minutes * interval '1 minute')),
      '[)'
    ) with &&
  )
  where (status in ('pending','confirmed','checked_in')
         and start_time is not null and duration_minutes is not null);

-- ============================================================
-- FIX — salary_payments.staff_id sem foreign key
-- A tabela ja existia (criada fora da migracao 030 rastreada, que usou
-- "create table if not exists" e por isso nunca alterou a estrutura ja
-- existente) sem a FK para staff, apesar da coluna staff_id existir e
-- estar sempre preenchida correctamente pelo codigo. Sem a FK, o
-- PostgREST nao conseguia resolver o join `staff(name)` usado por
-- listarSalaryPayments() (expensesController.js), falhando com
-- "Could not find a relationship between 'salary_payments' and 'staff'
-- in the schema cache" -- confirmado nos logs de producao.
--
-- Tabela estava vazia (0 registos) no momento da correccao, por isso
-- adicionar a FK e' seguro sem risco de violar dados existentes.
-- ============================================================

alter table public.salary_payments
  add constraint salary_payments_staff_id_fkey
  foreign key (staff_id) references public.staff(id) on delete cascade;

notify pgrst, 'reload schema';

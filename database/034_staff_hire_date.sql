-- ============================================================
-- staff.hire_date -- data de admissao, usada para sugerir o direito
-- a ferias proporcional (22 dias/12 meses, lei cabo-verdiana).
-- ============================================================

alter table staff add column if not exists hire_date date;

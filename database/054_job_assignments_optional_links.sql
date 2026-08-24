-- ============================================================
-- 054: job_assignments — staff_id opcional
-- ============================================================
-- O modal "Nova tarefa" (Staff.jsx) permite deixar uma tarefa "Sem
-- atribuicao" (staff_id null) enquanto aguarda um colaborador. A
-- coluna era NOT NULL, o que fazia a criacao falhar sempre com 400
-- nesse caso. reservation_id mantem-se obrigatorio -- toda a tarefa
-- pertence sempre a uma reserva.

alter table job_assignments alter column staff_id drop not null;

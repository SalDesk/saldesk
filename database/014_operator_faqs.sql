-- SalDesk - FAQ personalizado por operador

alter table operators
  add column if not exists custom_faqs jsonb default '[]'::jsonb;

-- Formato de cada item: { question_pt, question_en, answer_pt, answer_en }

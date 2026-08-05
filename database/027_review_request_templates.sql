-- Template do email de pedido de avaliacao: existia apenas em
-- localStorage e, mesmo quando "guardado", nunca era lido pelo backend
-- ao enviar o pedido real (requestReview em reviewController.js
-- mandava sempre um texto fixo em PT, ignorando por completo o que o
-- operador configurasse).
create table if not exists review_request_templates (
  operator_id  uuid primary key references operators(id) on delete cascade,
  subject_pt   text not null default 'Como correu o seu tour? Deixe a sua avaliacao',
  subject_en   text not null default 'How was your tour? Leave your review',
  body_pt      text not null default 'Ola {nome_cliente},

Esperamos que tenha gostado do seu tour {nome_tour}!

A sua opiniao e muito importante para nos e para futuros clientes.
Clique no link abaixo para deixar a sua avaliacao:

-> {link_avaliacao}

Obrigado pela sua confianca!',
  body_en      text not null default 'Hello {nome_cliente},

We hope you enjoyed your {nome_tour} tour!

Your feedback is very important to us and future guests.
Click the link below to leave your review:

-> {link_avaliacao}

Thank you for your trust!',
  updated_at   timestamptz not null default now()
);

alter table review_request_templates enable row level security;
drop policy if exists operador_acesso_proprio_review_request_templates on review_request_templates;
create policy operador_acesso_proprio_review_request_templates on review_request_templates
  for all using (operator_id in (select id from operators where user_id = auth.uid()));

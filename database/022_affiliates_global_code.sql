-- O Portal do Afiliado usa a rota /afiliado/:codigo (sem slug do operador),
-- por isso o codigo tem de ser globalmente unico, nao apenas por operador.
alter table affiliates drop constraint if exists affiliates_operator_id_code_key;
alter table affiliates add constraint affiliates_code_key unique (code);

-- Bug: requestReview() criava a linha "pendente" (para guardar o token) com
-- rating:5 fixo (porque a coluna era NOT NULL) e is_public assumia o
-- default true da tabela -- ou seja, um simples pedido de avaliacao ja
-- contava publicamente como uma avaliacao real de 5 estrelas, ANTES do
-- cliente responder. Inflava a media/contagem no directorio publico e o
-- badge "Mais Vendido".
alter table reviews alter column rating drop not null;

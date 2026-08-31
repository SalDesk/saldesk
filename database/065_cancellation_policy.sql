/* Politica de cancelamento configuravel por operador -- exigida pelo
   checklist de validacao de site da SISP (item "Politica de Entrega e
   Devolucao"). Ate agora a pagina publica mostrava um texto generico fixo,
   identico para todos os operadores e nao necessariamente verdadeiro
   (ver comentario no ServiceDetail.jsx). Nullable: sem valor configurado,
   o frontend mostra um aviso honesto ("ainda nao configurada") em vez de
   inventar uma politica. */
alter table operators add column if not exists cancellation_policy_pt text;
alter table operators add column if not exists cancellation_policy_en text;

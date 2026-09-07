-- Programa de indicacao entre operadores: 1 mes gratis para o indicador e
-- para o indicado quando este ultimo se torna cliente pagante. O rastreio
-- de quem indicou ja existia em operator_leads (referred_by_operator_id,
-- vindo do link operadores.html?ref={slug}), mas nunca era copiado para o
-- operador real criado a partir do lead -- por isso a recompensa nunca
-- podia ser aplicada. referral_reward_granted_at protege contra dar a
-- recompensa mais que uma vez ao mesmo operador indicado (ex. renovacoes
-- seguintes nunca devem voltar a accionar isto).
alter table operators add column if not exists referred_by_operator_id uuid references operators(id) on delete set null;
alter table operators add column if not exists referral_reward_granted_at timestamptz;

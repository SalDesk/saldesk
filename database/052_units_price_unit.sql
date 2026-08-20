-- Todos os formularios de unidade (hotel/actividade/rent-a-car/restaurante) ja
-- enviam price_unit no payload (night/day/hour/session/person), mas a coluna
-- nunca existiu -- era silenciosamente descartada pelo backend em createUnit/
-- updateUnit, deixando o sufixo de preco ("/noite", "/pessoa", etc.) sempre em
-- branco em ServiceDetail.jsx para qualquer tipo de operador. Sem valor por
-- omissao: unidades ja existentes ficam null (fallback ja tratado no frontend
-- com "|| ''"), nunca inventa um sufixo para dados antigos.
alter table units add column if not exists price_unit text;

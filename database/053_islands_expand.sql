/* Expande a tabela islands (criada em 038_conect.sql, so tinha 'sal') para
   cobrir todas as ilhas de Cabo Verde -- suporte tecnico ao reposicionamento
   de marketing feito em claude/reposition-cabo-verde. lat/lng alimentam a
   previsao meteorologica por operador (antes fixa nas coordenadas da Sal);
   airport_code alimenta a lista de recolha/devolucao do rent-a-car -- fica
   null nas ilhas sem aeroporto comercial (Santo Antao, Brava), o frontend
   omite a opcao "Aeroporto" nesse caso em vez de mostrar um codigo errado. */
alter table islands add column if not exists lat numeric(9,6);
alter table islands add column if not exists lng numeric(9,6);
alter table islands add column if not exists airport_code text;

update islands set lat = 16.733300, lng = -22.933300, airport_code = 'SID' where slug = 'sal';

insert into islands (name, slug, primary_language, currency, lat, lng, airport_code) values
  ('Santiago',     'santiago',     'pt', 'EUR', 14.917700, -23.509200, 'RAI'),
  ('São Vicente',  'sao-vicente',  'pt', 'EUR', 16.890100, -24.988700, 'VXE'),
  ('Boa Vista',    'boa-vista',    'pt', 'EUR', 16.150000, -22.900000, 'BVC'),
  ('Maio',         'maio',         'pt', 'EUR', 15.133300, -23.216700, 'MMO'),
  ('Fogo',         'fogo',         'pt', 'EUR', 14.896100, -24.495600, 'SFL'),
  ('Santo Antão',  'santo-antao',  'pt', 'EUR', 17.066700, -25.083300, null),
  ('São Nicolau',  'sao-nicolau',  'pt', 'EUR', 16.616700, -24.283300, 'SNE'),
  ('Brava',        'brava',        'pt', 'EUR', 14.866700, -24.716700, null)
  on conflict (slug) do nothing;

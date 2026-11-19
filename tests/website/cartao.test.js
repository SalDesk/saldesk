/* Regras do cartao de experiencia do Discover (website/discover/_cartao.js).
   Correr com: node --test tests/website/ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../website/discover/_cartao.js');

test('ler_meta_texto_simples_e_json_partido', () => {
  assert.deepEqual(C.lerMeta({ description: 'Passeio de barco' }), {});
  assert.deepEqual(C.lerMeta({ description: '{"desc_pt":' }), {});
  assert.deepEqual(C.lerMeta({ description: null }), {});
  assert.equal(C.lerMeta({ description: '{"tour_type":"grupo"}' }).tour_type, 'grupo');
});

test('duracao_em_horas_ou_minutos', () => {
  assert.equal(C.duracaoTexto({}, { duration: 6.5 }), '6 h 30');
  assert.equal(C.duracaoTexto({}, { duration: '2' }), '2 h');
  assert.equal(C.duracaoTexto({ duration_minutes: 210 }, {}), '3 h 30');
  assert.equal(C.duracaoTexto({ duration_minutes: 20 }, {}), '20 min');
  assert.equal(C.duracaoTexto({ duration_minutes: 120 }, { duration: 1.5 }), '1 h 30');
  assert.equal(C.duracaoTexto({}, {}), null);
});

test('formato_e_linguas', () => {
  assert.equal(C.formatoTexto({ tour_type: 'ambos' }, 'pt'), 'Privado ou grupo');
  assert.equal(C.formatoTexto({ tour_type: 'grupo' }, 'en'), 'Group');
  assert.equal(C.formatoTexto({}, 'pt'), null);
  assert.equal(C.linguasTexto({ languages: ['pt', 'EN', 'en', 'ES'] }), 'PT, EN, ES');
  assert.equal(C.linguasTexto({ languages: [] }), null);
});

test('incluidos_aceita_objectos_e_textos', () => {
  const meta = { included_items: [
    { label: 'Guia local', included: true }, { label: 'Almoço', included: false },
    'Transporte', '  ', { label: 'Água', included: true }, { label: 'Fotos', included: true },
  ] };
  assert.equal(C.incluidosTexto(meta), 'Guia local · Transporte · Água');
  assert.equal(C.incluidosTexto({}), null);
});

test('preco_base_escaloes_privado_e_consulta', () => {
  assert.deepEqual(C.precoCartao({ base_price: 35 }, { price_tiers: [{ price: 20 }] }), { valor: 35, unidade: 'pessoa' });
  assert.deepEqual(C.precoCartao({ base_price: 0 }, { price_tiers: [{ price: 150 }, { price: 120 }, { price: 0 }] }), { valor: 120, unidade: 'grupo' });
  assert.deepEqual(C.precoCartao({ base_price: 0 }, { price_private: 95 }), { valor: 95, unidade: 'grupo' });
  assert.equal(C.precoCartao({ base_price: 0 }, {}), null);
  assert.equal(C.precoCrianca({ price_child: 30 }), 30);
  assert.equal(C.precoCrianca({}), null);
});

test('preco_crianca_e_grupo_convertem_para_cve', () => {
  assert.equal(C.formatarPreco(120, 'EUR', 'EUR'), '€120');
  assert.equal(C.formatarPreco(120, 'EUR', 'CVE'), `${(13200).toLocaleString('pt-PT')} CVE`);
  assert.equal(C.formatarPreco(3300, 'CVE', 'EUR'), '€30');
  assert.equal(C.formatarPreco(5.5, 'EUR', 'EUR'), '€5.5');
});

test('titulo_na_lingua_do_visitante', () => {
  const item = { unit_name: 'Excursão de grupo' };
  assert.equal(C.tituloCartao(item, { name_en: 'Group tour' }, 'en'), 'Group tour');
  assert.equal(C.tituloCartao(item, { name_en: 'Group tour' }, 'pt'), 'Excursão de grupo');
  assert.equal(C.tituloCartao(item, { name_en: '  ' }, 'en'), 'Excursão de grupo');
});

test('sinal_de_procura_singular_e_plural', () => {
  assert.equal(C.sinalProcura({ recent_bookings: 0 }, 'pt'), null);
  assert.equal(C.sinalProcura({ recent_bookings: 1 }, 'pt'), 'Reservado 1 vez no último mês');
  assert.equal(C.sinalProcura({ recent_bookings: 2 }, 'pt'), 'Reservado 2 vezes no último mês');
  assert.equal(C.sinalProcura({ recent_bookings: 1 }, 'en'), 'Booked once in the last month');
  assert.equal(C.sinalProcura({ recent_bookings: 3 }, 'en'), 'Booked 3 times in the last month');
});

test('proxima_data_so_quando_nao_e_hoje', () => {
  assert.equal(C.proximaData({ next_available: '2026-11-18' }, '2026-11-18', 'pt'), null);
  assert.equal(C.proximaData({ next_available: null }, '2026-11-18', 'pt'), null);
  assert.equal(C.proximaData({ next_available: '2026-11-22' }, '2026-11-18', 'pt'), 'Próxima data: 22 nov');
  assert.equal(C.proximaData({ next_available: '2026-12-03' }, '2026-11-18', 'en'), 'Next date: 3 Dec');
});

test('hoje_e_o_dia_em_cabo_verde', () => {
  /* 00:30 UTC de 19 nov ainda e 18 nov em Cabo Verde (UTC-1) */
  assert.equal(C.hojeCaboVerde(new Date('2026-11-19T00:30:00Z')), '2026-11-18');
  assert.equal(C.hojeCaboVerde(new Date('2026-11-19T01:30:00Z')), '2026-11-19');
});

test('miniatura_wikimedia', () => {
  const orig = 'https://upload.wikimedia.org/wikipedia/commons/8/80/Cape_Verde_Sal_Buracona_2011.jpg';
  assert.equal(C.miniaturaWikimedia(orig), 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cape_Verde_Sal_Buracona_2011.jpg/500px-Cape_Verde_Sal_Buracona_2011.jpg');
  /* a Wikimedia so serve larguras normalizadas (330, 500, 960...): 640 da erro 400 */
  const outra = 'https://api.saldesk.cv/uploads/operators/x/turtle.jpg';
  assert.equal(C.miniaturaWikimedia(outra), outra);
  const jaThumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/A.jpg/640px-A.jpg';
  assert.equal(C.miniaturaWikimedia(jaThumb), jaThumb);
});

test('iniciais_e_ilhas', () => {
  assert.equal(C.iniciais('Logan Tours'), 'LT');
  assert.equal(C.iniciais('Satur - Serviços de Apoio'), 'SS');
  assert.equal(C.iniciais('Satur'), 'S');
  assert.deepEqual(
    C.ilhasDosItens([{ island_name: 'Santo Antão' }, { island_name: 'Ilha do Sal' }, { island_name: 'Ilha do Sal' }, {}]),
    [{ nome: 'Ilha do Sal', n: 2 }, { nome: 'Santo Antão', n: 1 }],
  );
});

test('nome_da_ilha_na_lingua_do_visitante', () => {
  assert.equal(C.nomeIlha({ island_slug: 'sal', island_name: 'Ilha do Sal' }, 'en'), 'Sal Island');
  assert.equal(C.nomeIlha({ island_slug: 'sal', island_name: 'Ilha do Sal' }, 'pt'), 'Ilha do Sal');
  assert.equal(C.nomeIlha({ island_slug: 'santo-antao', island_name: 'Santo Antão' }, 'en'), 'Santo Antão');
  /* ilha sem traducao conhecida: o nome que vem da API */
  assert.equal(C.nomeIlha({ island_slug: 'nova', island_name: 'Ilha Nova' }, 'en'), 'Ilha Nova');
  assert.equal(C.nomeIlha({}, 'en'), '');
});

test('outros_lugares_da_mesma_ilha_com_foto_primeiro', () => {
  const todos = [
    { slug: 'a', island_slug: 'sal', image_url: null },
    { slug: 'b', island_slug: 'sal', image_url: 'b.jpg' },
    { slug: 'c', island_slug: 'fogo', image_url: 'c.jpg' },
    { slug: 'eu', island_slug: 'sal', image_url: 'eu.jpg' },
    { slug: 'd', island_slug: 'sal', image_url: 'd.jpg' },
  ];
  const eu = todos[3];
  assert.deepEqual(C.outrosLugares(eu, todos).map(l => l.slug), ['b', 'd', 'a']);
  assert.deepEqual(C.outrosLugares(eu, todos, 2).map(l => l.slug), ['b', 'd']);
  assert.deepEqual(C.outrosLugares({ slug: 'x', island_slug: 'maio' }, todos), []);
  assert.deepEqual(C.outrosLugares(eu, null), []);
});

test('estado_do_lugar_distingue_falha_de_inexistente', () => {
  /* null = a API falhou (rede/erro); [] = a API respondeu sem esse lugar */
  assert.deepEqual(C.estadoDoLugar(null, 'buracona'), { estado: 'erro', lugar: null });
  assert.deepEqual(C.estadoDoLugar([], 'buracona'), { estado: 'nao_encontrado', lugar: null });
  assert.deepEqual(C.estadoDoLugar([{ slug: 'outro' }], 'buracona'), { estado: 'nao_encontrado', lugar: null });
  assert.deepEqual(C.estadoDoLugar([{ slug: 'buracona', name_pt: 'B' }], 'buracona'), { estado: 'ok', lugar: { slug: 'buracona', name_pt: 'B' } });
  assert.deepEqual(C.estadoDoLugar([{ slug: 'x' }], ''), { estado: 'nao_encontrado', lugar: null });
});

test('experiencias_do_lugar_pelo_itinerario_so_na_mesma_ilha', () => {
  const lugar = { slug: 'santa-maria', name_pt: 'Santa Maria', name_en: 'Santa Maria', island_slug: 'sal' };
  const u = (id, ilha, paragens, extra = {}) => ({ unit_id: id, island_slug: ilha, description: JSON.stringify({ stops: paragens }), ...extra });
  const units = [
    u('sal-1', 'sal', [{ name: 'Santa Maria' }]),
    u('bv-1', 'boa-vista', [{ name: 'Cabo Santa Maria' }]),
    u('sal-2', 'sal', [{ name: 'Espargos' }], { recent_bookings: 3 }),
    { unit_id: 'sal-3', island_slug: 'sal', description: 'texto simples' },
  ];
  const r = C.experienciasDoLugar(lugar, units);
  assert.equal(r.porItinerario, true);
  assert.deepEqual(r.itens.map(i => i.unit_id), ['sal-1']);
});

test('experiencias_do_lugar_sem_itinerario_usa_a_ilha', () => {
  const lugar = { slug: 'buracona', name_pt: 'Buracona', island_slug: 'sal' };
  const units = [
    { unit_id: 'a', island_slug: 'sal', recent_bookings: 0 },
    { unit_id: 'b', island_slug: 'sal', recent_bookings: 2 },
    { unit_id: 'c', island_slug: 'fogo', recent_bookings: 9 },
  ];
  const r = C.experienciasDoLugar(lugar, units);
  assert.equal(r.porItinerario, false);
  assert.deepEqual(r.itens.map(i => i.unit_id), ['b', 'a']);
  assert.deepEqual(C.experienciasDoLugar(lugar, null), { porItinerario: false, itens: [] });
});

/* Beneficios do operador e da actividade (prazo de cancelamento, confirmacao automatica, recolha) */
test('beneficios_por_ordem_e_so_quando_verdade', () => {
  assert.deepEqual(
    C.beneficiosCartao({ free_cancellation_hours: 24, auto_confirm_bookings: true }, { pickup_included: true }, 'pt'),
    ['Cancelamento grátis até 24 h antes', 'Confirmação imediata', 'Recolha no hotel'],
  );
  assert.deepEqual(
    C.beneficiosCartao({ free_cancellation_hours: 24, auto_confirm_bookings: true }, { pickup_included: true }, 'en'),
    ['Free cancellation up to 24 h before', 'Instant confirmation', 'Hotel pickup'],
  );
  assert.deepEqual(C.beneficiosCartao({ free_cancellation_hours: 168 }, {}, 'en'), ['Free cancellation up to 7 days before']);
  assert.deepEqual(C.beneficiosCartao({ free_cancellation_hours: 168 }, {}, 'pt'), ['Cancelamento grátis até 7 dias antes']);
  assert.deepEqual(C.beneficiosCartao({ free_cancellation_hours: 48 }, {}, 'pt'), ['Cancelamento grátis até 48 h antes']);
  assert.deepEqual(C.beneficiosCartao({ free_cancellation_hours: 72 }, {}, 'pt'), ['Cancelamento grátis até 72 h antes']);
});

test('sem_prazo_ou_sem_cancelamento_gratis_nao_mostra', () => {
  assert.deepEqual(C.beneficiosCartao({ free_cancellation_hours: null }, {}, 'pt'), []);
  assert.deepEqual(C.beneficiosCartao({ free_cancellation_hours: 0 }, {}, 'pt'), []);
  assert.deepEqual(C.beneficiosCartao({ free_cancellation_hours: 36 }, {}, 'pt'), []);
  assert.deepEqual(C.beneficiosCartao({ auto_confirm_bookings: false }, { pickup_included: false }, 'pt'), []);
  assert.deepEqual(C.beneficiosCartao({ auto_confirm_bookings: 'true' }, { pickup_included: 'true' }, 'pt'), []);
  assert.deepEqual(C.beneficiosCartao({}, {}, 'pt'), []);
  assert.deepEqual(C.beneficiosCartao(null, null, 'en'), []);
});

test('recolha_nao_se_repete_nos_incluidos', () => {
  const itens = ['Recolha no hotel', { label: 'Hotel pick-up and drop-off', included: true }, 'Guia', 'Hotel Pickup'];
  assert.equal(C.incluidosTexto({ pickup_included: true, included_items: itens }), 'Guia');
  assert.equal(C.incluidosTexto({ included_items: itens }), 'Recolha no hotel · Hotel pick-up and drop-off · Guia');
  assert.equal(C.incluidosTexto({ pickup_included: true, included_items: ['RECOLHA'] }), null);
});

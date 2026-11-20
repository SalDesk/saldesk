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

test('recolha_com_espaco_some_e_a_do_aeroporto_fica', () => {
  const itens = ['Pick up at your hotel', 'Recolha no aeroporto', { label: 'Airport pickup', included: true }, 'Guia'];
  assert.equal(C.incluidosTexto({ pickup_included: true, included_items: itens }), 'Recolha no aeroporto · Airport pickup · Guia');
});

/* ── Filtros extra do Discover: beneficios, preco, duracao e ordenacao ── */
const xp = (extra = {}, meta = null) => ({ currency: 'EUR', ...extra, description: meta ? JSON.stringify(meta) : extra.description });
const SEM = { beneficio: '', preco: '', duracao: '' };

test('faixas_de_preco_e_duracao', () => {
  const fp = (i) => C.faixaPreco(i, C.lerMeta(i), 110);
  assert.equal(fp(xp({ base_price: 50 })), 'ate50');
  assert.equal(fp(xp({ base_price: 50.01 })), '50a100');
  assert.equal(fp(xp({ base_price: 100 })), '50a100');
  assert.equal(fp(xp({ base_price: 101 })), 'mais100');
  assert.equal(fp(xp({ base_price: 0 }, { price_tiers: [{ price: 300 }, { price: 90 }] })), '50a100');
  assert.equal(fp(xp({})), null);
  const fd = (i) => C.faixaDuracao(i, C.lerMeta(i));
  assert.equal(fd(xp({ duration_minutes: 180 })), 'ate3');
  assert.equal(fd(xp({ duration_minutes: 181 })), '3a6');
  assert.equal(fd(xp({ duration_minutes: 360 })), '3a6');
  assert.equal(fd(xp({ duration_minutes: 390 })), 'mais6');
  assert.equal(fd(xp({ duration_minutes: 60 }, { duration: 6.5 })), 'mais6');
  assert.equal(fd(xp({})), null);
});

test('preco_em_cve_converte_para_eur', () => {
  const i = xp({ base_price: 2750, currency: 'CVE' });
  assert.equal(C.faixaPreco(i, C.lerMeta(i), 110), 'ate50');
  assert.equal(C.faixaPreco(i, C.lerMeta(i)), 'ate50');
  const j = xp({ base_price: 13200, currency: 'CVE' });
  assert.equal(C.faixaPreco(j, C.lerMeta(j), 110), 'mais100');
});

test('beneficios_por_chave', () => {
  const i = xp({ free_cancellation_hours: 48, auto_confirm_bookings: true }, { pickup_included: true });
  const m = C.lerMeta(i);
  assert.equal(C.temBeneficio(i, m, 'cancelamento'), true);
  assert.equal(C.temBeneficio(i, m, 'confirmacao'), true);
  assert.equal(C.temBeneficio(i, m, 'recolha'), true);
  const j = xp({ free_cancellation_hours: 0, auto_confirm_bookings: 'true' }, { pickup_included: 'true' });
  const n = C.lerMeta(j);
  assert.equal(C.temBeneficio(j, n, 'cancelamento'), false);
  assert.equal(C.temBeneficio(j, n, 'confirmacao'), false);
  assert.equal(C.temBeneficio(j, n, 'recolha'), false);
  assert.equal(C.temBeneficio(i, m, 'outra'), false);
});

test('sem_preco_ou_duracao_so_sai_com_filtro_activo', () => {
  const vazio = xp({});
  const m = C.lerMeta(vazio);
  assert.equal(C.passaFiltrosExtra(vazio, m, SEM, 110), true);
  assert.equal(C.passaFiltrosExtra(vazio, m, { ...SEM, preco: 'ate50' }, 110), false);
  assert.equal(C.passaFiltrosExtra(vazio, m, { ...SEM, duracao: 'ate3' }, 110), false);
  const i = xp({ base_price: 40, duration_minutes: 120, free_cancellation_hours: 24 });
  const n = C.lerMeta(i);
  assert.equal(C.passaFiltrosExtra(i, n, { beneficio: 'cancelamento', preco: 'ate50', duracao: 'ate3' }, 110), true);
  assert.equal(C.passaFiltrosExtra(i, n, { beneficio: 'confirmacao', preco: 'ate50', duracao: 'ate3' }, 110), false);
  assert.equal(C.passaFiltrosExtra(i, n, undefined, 110), true);
});

test('ordenar_por_preco_sem_preco_no_fim_e_estavel', () => {
  const a = xp({ unit_id: 'a', base_price: 60 });
  const b = xp({ unit_id: 'b' });
  const c = xp({ unit_id: 'c', base_price: 30 });
  const d = xp({ unit_id: 'd', base_price: 60 });
  const e = xp({ unit_id: 'e', base_price: 2200, currency: 'CVE' });
  const lista = [a, b, c, d, e];
  const ids = (l) => l.map((x) => x.unit_id).join('');
  assert.equal(ids(C.ordenarPorPreco(lista, 'asc', 110)), 'ecadb');
  assert.equal(ids(C.ordenarPorPreco(lista, 'desc', 110)), 'adceb');
  const copia = C.ordenarPorPreco(lista, '', 110);
  assert.equal(ids(copia), 'abcde');
  assert.notEqual(copia, lista);
  assert.equal(ids(lista), 'abcde');
});

test('contar_opcoes_respeita_os_outros_grupos', () => {
  const lista = [
    xp({ base_price: 40, duration_minutes: 120, free_cancellation_hours: 24 }),
    xp({ base_price: 80, duration_minutes: 400, auto_confirm_bookings: true }),
    xp({ base_price: 150, duration_minutes: 200, free_cancellation_hours: 72 }, { pickup_included: true }),
  ];
  assert.deepEqual(C.contarOpcoes(lista, 'beneficio', SEM, 110), { cancelamento: 2, confirmacao: 1, recolha: 1 });
  assert.deepEqual(C.contarOpcoes(lista, 'preco', SEM, 110), { ate50: 1, '50a100': 1, mais100: 1 });
  assert.deepEqual(C.contarOpcoes(lista, 'duracao', SEM, 110), { ate3: 1, '3a6': 1, mais6: 1 });
  /* com cancelamento gratis activo, so contam as duas que o tem; o proprio grupo ignora-se */
  assert.deepEqual(C.contarOpcoes(lista, 'preco', { ...SEM, beneficio: 'cancelamento' }, 110), { ate50: 1, '50a100': 0, mais100: 1 });
  assert.deepEqual(C.contarOpcoes(lista, 'beneficio', { ...SEM, beneficio: 'cancelamento' }, 110), { cancelamento: 2, confirmacao: 1, recolha: 1 });
});

test('jsonld_lugar_com_e_sem_coordenadas', () => {
  const url = 'https://saldesk.cv/discover/ponto.html?slug=buracona';
  const lugar = { slug: 'buracona', name_pt: 'Buracona', description_pt: 'Piscina natural.', image_url: 'https://x/b.jpg', lat: 16.82, lng: -22.98, island_slug: 'sal' };
  assert.deepEqual(C.jsonLdLugar(lugar, url, 'Ilha do Sal'), {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: 'Buracona',
    description: 'Piscina natural.',
    image: 'https://x/b.jpg',
    url,
    geo: { '@type': 'GeoCoordinates', latitude: 16.82, longitude: -22.98 },
    address: { '@type': 'PostalAddress', addressRegion: 'Ilha do Sal', addressCountry: 'CV' },
  });
  const semNada = C.jsonLdLugar({ slug: 'x', name_pt: 'X', lat: null, lng: -22 }, url, '');
  assert.equal('geo' in semNada, false);
  assert.equal('image' in semNada, false);
  assert.equal('description' in semNada, false);
  assert.deepEqual(semNada.address, { '@type': 'PostalAddress', addressCountry: 'CV' });
  assert.equal(C.jsonLdLugar(null, url), null);
  assert.equal(C.jsonLdLugar({ slug: 'x' }, url), null);
});

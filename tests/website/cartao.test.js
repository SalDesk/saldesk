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

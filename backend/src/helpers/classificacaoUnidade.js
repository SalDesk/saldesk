/* Classificacao propria de cada experiencia (unidade) para os cartoes do catalogo: media
   (1 casa decimal) e numero das avaliacoes publicas das reservas dessa unidade. Avaliacoes
   sem reserva conhecida ou com nota fora de 1-5 nao contam. Nunca usa a media do operador.
   Spec: docs/superpowers/specs/2026-11-20-estrelas-por-actividade-design.md */

function classificacaoPorUnidade(reviews, reservas) {
  const unidadeDaReserva = {};
  (reservas || []).forEach((r) => { if (r && r.id && r.unit_id) unidadeDaReserva[r.id] = r.unit_id; });
  const notas = {};
  (reviews || []).forEach((rv) => {
    const unidade = rv && unidadeDaReserva[rv.reservation_id];
    const nota = rv?.rating === null || rv?.rating === undefined || rv?.rating === '' ? NaN : Number(rv.rating);
    if (!unidade || !(nota >= 1 && nota <= 5)) return;
    (notas[unidade] = notas[unidade] || []).push(nota);
  });
  const out = {};
  Object.keys(notas).forEach((u) => {
    const lista = notas[u];
    out[u] = { avg: Math.round((lista.reduce((s, n) => s + n, 0) / lista.length) * 10) / 10, count: lista.length };
  });
  return out;
}

/* Avaliacoes publicas (com nota) dos operadores indicados, ja com a unidade da reserva
   (reservations(unit_id) na mesma consulta). Le por paginas de 1000 -- o limite por pedido do
   PostgREST -- para as contagens nunca ficarem cortadas. Se uma pagina falhar, regista e
   devolve o que ja leu (os cartoes ficam sem estrelas em vez de rebentar). */
const PAGINA = 1000;

async function lerAvaliacoesPublicas(supabase, operatorIds) {
  const ids = (operatorIds || []).filter(Boolean);
  if (!ids.length) return [];
  const out = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from('reviews')
      .select('operator_id, rating, reservation_id, reservations(unit_id)')
      .in('operator_id', ids)
      .eq('is_public', true)
      .not('rating', 'is', null)
      .order('id')
      .range(de, de + PAGINA - 1);
    if (error) {
      console.error('[Classificacao] Falha a ler avaliacoes publicas:', error.message);
      break;
    }
    (data || []).forEach((r) => out.push({
      operator_id: r.operator_id, rating: r.rating, reservation_id: r.reservation_id,
      unit_id: r.reservations?.unit_id || null,
    }));
    if (!data || data.length < PAGINA) break;
  }
  return out;
}

/* Classificacao de todas as unidades a partir de avaliacoes que ja trazem unit_id */
function classificacaoDasAvaliacoes(avaliacoes) {
  const lista = avaliacoes || [];
  return classificacaoPorUnidade(lista, lista.map((a) => ({ id: a.reservation_id, unit_id: a.unit_id })));
}

function classificacaoDaUnidade(avaliacoes, unitId) {
  return classificacaoDasAvaliacoes(avaliacoes)[unitId] || null;
}

module.exports = { classificacaoPorUnidade, lerAvaliacoesPublicas, classificacaoDasAvaliacoes, classificacaoDaUnidade };

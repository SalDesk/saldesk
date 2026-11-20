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

module.exports = { classificacaoPorUnidade };

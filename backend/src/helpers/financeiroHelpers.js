function percentChange(atual, anterior) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function calcularPeriodoAnterior(inicio, fim) {
  const dtIn = new Date(inicio + 'T00:00:00Z');
  const dtFim = new Date(fim + 'T00:00:00Z');
  const duracaoMs = dtFim.getTime() - dtIn.getTime();

  const prevFim = new Date(dtIn.getTime() - 24 * 60 * 60 * 1000);
  const prevIn = new Date(prevFim.getTime() - duracaoMs);

  return {
    inicio: prevIn.toISOString().split('T')[0],
    fim: prevFim.toISOString().split('T')[0]
  };
}

function calcularMetricas(reservas, numUnidades, inicio, fim) {
  const naoCanceladas = reservas.filter((r) => r.status !== 'cancelled');
  const checkout = reservas.filter(
    (r) => r.status === 'checked_out' && r.check_out >= inicio && r.check_out <= fim
  );

  const receita = checkout.reduce((sum, r) => sum + Number(r.total_price), 0);
  const valorMedio = checkout.length > 0 ? receita / checkout.length : 0;

  const dtIn = new Date(inicio + 'T00:00:00Z');
  const dtFim = new Date(fim + 'T00:00:00Z');
  const totalDias = Math.ceil((dtFim - dtIn) / (1000 * 60 * 60 * 24)) + 1;

  let diasOcupados = 0;
  const cur = new Date(dtIn);

  while (cur <= dtFim) {
    const dataStr = cur.toISOString().split('T')[0];
    const unidadesOcupadas = new Set();
    for (const r of naoCanceladas) {
      if (r.check_in <= dataStr && r.check_out > dataStr) {
        unidadesOcupadas.add(r.unit_id);
      }
    }
    diasOcupados += unidadesOcupadas.size;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return {
    receita: Math.round(receita * 100) / 100,
    num_reservas: naoCanceladas.length,
    valor_medio: Math.round(valorMedio * 100) / 100,
    taxa_ocupacao: numUnidades > 0
      ? Math.min(100, Math.round((diasOcupados / (numUnidades * totalDias)) * 100))
      : 0
  };
}

module.exports = { percentChange, calcularPeriodoAnterior, calcularMetricas };

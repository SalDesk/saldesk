const { supabaseAdmin } = require('../config/supabase');
const { percentChange, calcularPeriodoAnterior, calcularMetricas } = require('../helpers/financeiroHelpers');

// Reservas que se sobrepõem ao período (para cálculo de ocupação)
async function fetchReservas(operatorId, inicio, fim) {
  const { data } = await supabaseAdmin
    .from('reservations')
    .select('id, unit_id, total_price, status, check_in, check_out')
    .eq('operator_id', operatorId)
    .lte('check_in', fim)
    .gt('check_out', inicio);
  return data || [];
}

// ─── Endpoints ─────────────────────────────────────────────

async function resumo(req, res, next) {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const prev = calcularPeriodoAnterior(inicio, fim);

    const [unidadesRes, reservasAtual, reservasAnterior] = await Promise.all([
      supabaseAdmin
        .from('units')
        .select('id')
        .eq('operator_id', req.operator.id)
        .eq('status', 'active'),
      fetchReservas(req.operator.id, inicio, fim),
      fetchReservas(req.operator.id, prev.inicio, prev.fim)
    ]);

    const numUnidades = (unidadesRes.data || []).length;
    const atual = calcularMetricas(reservasAtual, numUnidades, inicio, fim);
    const anterior = calcularMetricas(reservasAnterior, numUnidades, prev.inicio, prev.fim);

    return res.json({
      data: {
        periodo: { inicio, fim },
        periodo_anterior: prev,
        atual,
        anterior,
        variacao: {
          receita: percentChange(atual.receita, anterior.receita),
          num_reservas: atual.num_reservas - anterior.num_reservas,
          valor_medio: percentChange(atual.valor_medio, anterior.valor_medio),
          taxa_ocupacao: atual.taxa_ocupacao - anterior.taxa_ocupacao
        }
      },
      message: 'Resumo financeiro'
    });
  } catch (err) {
    next(err);
  }
}

async function receita(req, res, next) {
  try {
    const { inicio, fim, granularidade = 'week' } = req.query;

    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const { data: reservas } = await supabaseAdmin
      .from('reservations')
      .select('check_out, total_price')
      .eq('operator_id', req.operator.id)
      .eq('status', 'checked_out')
      .gte('check_out', inicio)
      .lte('check_out', fim)
      .order('check_out');

    const grupos = {};

    for (const r of reservas || []) {
      const d = new Date(r.check_out + 'T00:00:00Z');
      let chave;

      if (granularidade === 'month') {
        chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      } else if (granularidade === 'week') {
        const diaSemana = d.getUTCDay() || 7;
        const segunda = new Date(d);
        segunda.setUTCDate(d.getUTCDate() - diaSemana + 1);
        chave = segunda.toISOString().split('T')[0];
      } else {
        chave = r.check_out;
      }

      if (!grupos[chave]) grupos[chave] = { periodo: chave, receita: 0, num_reservas: 0 };
      grupos[chave].receita += Number(r.total_price);
      grupos[chave].num_reservas += 1;
    }

    const resultado = Object.values(grupos)
      .map((g) => ({ ...g, receita: Math.round(g.receita * 100) / 100 }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    return res.json({ data: resultado, message: 'Receita por período' });
  } catch (err) {
    next(err);
  }
}

async function unidades(req, res, next) {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const [unidadesRes, reservasRes] = await Promise.all([
      supabaseAdmin
        .from('units')
        .select('id, name, unit_type')
        .eq('operator_id', req.operator.id)
        .eq('status', 'active'),
      fetchReservas(req.operator.id, inicio, fim)
    ]);

    const totalDias =
      Math.ceil(
        (new Date(fim + 'T00:00:00Z') - new Date(inicio + 'T00:00:00Z')) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    const resultado = (unidadesRes.data || [])
      .map((unit) => {
        const reservasUnit = (reservasRes || []).filter((r) => r.unit_id === unit.id);
        const checkout = reservasUnit.filter((r) => r.status === 'checked_out' && r.check_out >= inicio && r.check_out <= fim);
        const receitaUnit = checkout.reduce((sum, r) => sum + Number(r.total_price), 0);

        let diasOcupados = 0;
        const cur = new Date(inicio + 'T00:00:00Z');
        const dtFim = new Date(fim + 'T00:00:00Z');

        while (cur <= dtFim) {
          const dataStr = cur.toISOString().split('T')[0];
          const ocupado = reservasUnit.some(
            (r) => r.status !== 'cancelled' && r.check_in <= dataStr && r.check_out > dataStr
          );
          if (ocupado) diasOcupados++;
          cur.setUTCDate(cur.getUTCDate() + 1);
        }

        return {
          id: unit.id,
          name: unit.name,
          unit_type: unit.unit_type,
          num_reservas: reservasUnit.filter((r) => r.status !== 'cancelled').length,
          receita: Math.round(receitaUnit * 100) / 100,
          taxa_ocupacao: Math.min(100, Math.round((diasOcupados / totalDias) * 100))
        };
      })
      .sort((a, b) => b.receita - a.receita);

    return res.json({ data: resultado, message: 'Performance por unidade' });
  } catch (err) {
    next(err);
  }
}

async function topClientes(req, res, next) {
  try {
    const { inicio, fim } = req.query;

    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim são obrigatórios', code: 'MISSING_FIELDS' });
    }

    const { data: reservas } = await supabaseAdmin
      .from('reservations')
      .select('customer_id, customer_name, customer_email, total_price')
      .eq('operator_id', req.operator.id)
      .eq('status', 'checked_out')
      .gte('check_out', inicio)
      .lte('check_out', fim);

    const mapa = {};

    for (const r of reservas || []) {
      const key = r.customer_id || r.customer_email;
      if (!mapa[key]) {
        mapa[key] = { customer_id: r.customer_id, customer_name: r.customer_name, customer_email: r.customer_email, num_visitas: 0, total_gasto: 0 };
      }
      mapa[key].num_visitas += 1;
      mapa[key].total_gasto += Number(r.total_price);
    }

    const resultado = Object.values(mapa)
      .map((c) => ({ ...c, total_gasto: Math.round(c.total_gasto * 100) / 100 }))
      .sort((a, b) => b.total_gasto - a.total_gasto)
      .slice(0, 10);

    return res.json({ data: resultado, message: 'Top clientes' });
  } catch (err) {
    next(err);
  }
}

module.exports = { resumo, receita, unidades, topClientes };

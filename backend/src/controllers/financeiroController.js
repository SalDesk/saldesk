const { supabaseAdmin } = require('../config/supabase');
const { percentChange, calcularPeriodoAnterior, calcularMetricas } = require('../helpers/financeiroHelpers');
const ExcelJS = require('exceljs');

async function fetchReservas(operatorId, inicio, fim) {
  const { data } = await supabaseAdmin
    .from('reservations')
    .select('id, unit_id, total_price, status, check_in, check_out, source, customer_name, customer_email')
    .eq('operator_id', operatorId)
    .lte('check_in', fim)
    .gt('check_out', inicio);
  return data || [];
}

async function resumo(req, res, next) {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const prev = calcularPeriodoAnterior(inicio, fim);

    const [unidadesRes, reservasAtual, reservasAnterior] = await Promise.all([
      supabaseAdmin.from('units').select('id').eq('operator_id', req.operator.id).eq('status', 'active'),
      fetchReservas(req.operator.id, inicio, fim),
      fetchReservas(req.operator.id, prev.inicio, prev.fim),
    ]);

    const numUnidades = (unidadesRes.data || []).length;
    const atual    = calcularMetricas(reservasAtual,   numUnidades, inicio,     fim);
    const anterior = calcularMetricas(reservasAnterior, numUnidades, prev.inicio, prev.fim);

    const directas = reservasAtual.filter((r) => r.status !== 'cancelled' && (r.source === 'direct' || r.source === 'public' || r.source === 'admin')).length;
    const poupancaComissoes = Math.round(
      reservasAtual
        .filter((r) => r.status === 'checked_out' && (r.source === 'direct' || r.source === 'public' || r.source === 'admin'))
        .reduce((s, r) => s + Number(r.total_price), 0) * 0.20 * 100
    ) / 100;

    return res.json({
      data: {
        periodo: { inicio, fim },
        periodo_anterior: prev,
        atual,
        anterior,
        directas,
        poupanca_comissoes: poupancaComissoes,
        variacao: {
          receita:       percentChange(atual.receita,       anterior.receita),
          num_reservas:  atual.num_reservas - anterior.num_reservas,
          valor_medio:   percentChange(atual.valor_medio,   anterior.valor_medio),
          taxa_ocupacao: atual.taxa_ocupacao - anterior.taxa_ocupacao,
        },
      },
      message: 'Resumo financeiro',
    });
  } catch (err) {
    next(err);
  }
}

async function receita(req, res, next) {
  try {
    const { inicio, fim, granularidade = 'week' } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios', code: 'MISSING_FIELDS' });
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
        const dow = d.getUTCDay() || 7;
        const seg = new Date(d); seg.setUTCDate(d.getUTCDate() - dow + 1);
        chave = seg.toISOString().split('T')[0];
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

    return res.json({ data: resultado, message: 'Receita por periodo' });
  } catch (err) {
    next(err);
  }
}

async function unidades(req, res, next) {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const [unidadesRes, reservasRes] = await Promise.all([
      supabaseAdmin.from('units').select('id, name, unit_type').eq('operator_id', req.operator.id).eq('status', 'active'),
      fetchReservas(req.operator.id, inicio, fim),
    ]);

    const totalDias = Math.ceil((new Date(fim + 'T00:00:00Z') - new Date(inicio + 'T00:00:00Z')) / (1000 * 60 * 60 * 24)) + 1;

    const resultado = (unidadesRes.data || []).map((unit) => {
      const reservasUnit = reservasRes.filter((r) => r.unit_id === unit.id);
      const checkout = reservasUnit.filter((r) => r.status === 'checked_out' && r.check_out >= inicio && r.check_out <= fim);
      const receitaUnit = checkout.reduce((s, r) => s + Number(r.total_price), 0);

      let diasOcupados = 0;
      const cur = new Date(inicio + 'T00:00:00Z');
      const dtFim = new Date(fim + 'T00:00:00Z');
      while (cur <= dtFim) {
        const ds = cur.toISOString().split('T')[0];
        if (reservasUnit.some((r) => r.status !== 'cancelled' && r.check_in <= ds && r.check_out > ds)) diasOcupados++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      return {
        id: unit.id, name: unit.name, unit_type: unit.unit_type,
        num_reservas: reservasUnit.filter((r) => r.status !== 'cancelled').length,
        receita: Math.round(receitaUnit * 100) / 100,
        taxa_ocupacao: Math.min(100, Math.round((diasOcupados / totalDias) * 100)),
      };
    }).sort((a, b) => b.receita - a.receita);

    return res.json({ data: resultado, message: 'Performance por unidade' });
  } catch (err) {
    next(err);
  }
}

async function topClientes(req, res, next) {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios', code: 'MISSING_FIELDS' });
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
      if (!mapa[key]) mapa[key] = { customer_name: r.customer_name, customer_email: r.customer_email, num_visitas: 0, total_gasto: 0 };
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

async function canais(req, res, next) {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const reservas = await fetchReservas(req.operator.id, inicio, fim);
    const naoCanceladas = reservas.filter((r) => r.status !== 'cancelled');

    const mapa = {};
    for (const r of naoCanceladas) {
      const source = r.source || 'manual';
      if (!mapa[source]) mapa[source] = { source, num_reservas: 0, receita: 0 };
      mapa[source].num_reservas += 1;
      if (r.status === 'checked_out') mapa[source].receita += Number(r.total_price);
    }

    const resultado = Object.values(mapa)
      .map((c) => ({ ...c, receita: Math.round(c.receita * 100) / 100 }))
      .sort((a, b) => b.num_reservas - a.num_reservas);

    return res.json({ data: resultado, message: 'Distribuicao por canal' });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const [reservasRes, unidadesRes] = await Promise.all([
      supabaseAdmin
        .from('reservations')
        .select('*, units(name, unit_type)')
        .eq('operator_id', req.operator.id)
        .gte('check_in', inicio)
        .lte('check_out', fim)
        .order('check_in'),
      supabaseAdmin
        .from('units')
        .select('id, name, unit_type')
        .eq('operator_id', req.operator.id)
        .eq('status', 'active'),
    ]);

    const reservas = reservasRes.data || [];
    const unidadesData = unidadesRes.data || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalDesk';
    workbook.created = new Date();

    const OCEAN = 'FF0D5470';
    const WHITE = 'FFFFFFFF';
    const headerStyle = { font: { bold: true, color: { argb: WHITE } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: OCEAN } }, alignment: { vertical: 'middle' } };

    /* Folha 1 — Reservas */
    const wsRes = workbook.addWorksheet('Reservas');
    wsRes.columns = [
      { header: 'Check-in',   key: 'check_in',       width: 12 },
      { header: 'Check-out',  key: 'check_out',       width: 12 },
      { header: 'Unidade',    key: 'unit_name',       width: 20 },
      { header: 'Cliente',    key: 'customer_name',   width: 24 },
      { header: 'Email',      key: 'customer_email',  width: 28 },
      { header: 'Hospedes',   key: 'guests',          width: 10 },
      { header: 'Total (€)',  key: 'total_price',     width: 12 },
      { header: 'Status',     key: 'status',          width: 14 },
      { header: 'Fonte',      key: 'source',          width: 14 },
    ];
    wsRes.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
    for (const r of reservas) {
      wsRes.addRow({
        check_in: r.check_in, check_out: r.check_out,
        unit_name: r.units?.name || '',
        customer_name: r.customer_name, customer_email: r.customer_email,
        guests: r.guests, total_price: Number(r.total_price),
        status: r.status, source: r.source,
      });
    }

    /* Folha 2 — Resumo por unidade */
    const wsUnid = workbook.addWorksheet('Por Unidade');
    wsUnid.columns = [
      { header: 'Unidade',       key: 'name',           width: 22 },
      { header: 'Tipo',          key: 'unit_type',       width: 16 },
      { header: 'Reservas',      key: 'num_reservas',    width: 12 },
      { header: 'Receita (€)',   key: 'receita',         width: 14 },
      { header: 'Ocupacao (%)',  key: 'taxa_ocupacao',   width: 14 },
    ];
    wsUnid.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

    const totalDias = Math.ceil((new Date(fim + 'T00:00:00Z') - new Date(inicio + 'T00:00:00Z')) / (1000 * 60 * 60 * 24)) + 1;
    for (const unit of unidadesData) {
      const reservasUnit = reservas.filter((r) => r.unit_id === unit.id);
      const checkout = reservasUnit.filter((r) => r.status === 'checked_out');
      const receitaUnit = checkout.reduce((s, r) => s + Number(r.total_price), 0);
      let diasOcupados = 0;
      const cur = new Date(inicio + 'T00:00:00Z');
      const dtFim = new Date(fim + 'T00:00:00Z');
      while (cur <= dtFim) {
        const ds = cur.toISOString().split('T')[0];
        if (reservasUnit.some((r) => r.status !== 'cancelled' && r.check_in <= ds && r.check_out > ds)) diasOcupados++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      wsUnid.addRow({
        name: unit.name, unit_type: unit.unit_type,
        num_reservas: reservasUnit.filter((r) => r.status !== 'cancelled').length,
        receita: Math.round(receitaUnit * 100) / 100,
        taxa_ocupacao: Math.min(100, Math.round((diasOcupados / totalDias) * 100)),
      });
    }

    /* Folha 3 — Resumo geral */
    const wsRes2 = workbook.addWorksheet('Resumo');
    wsRes2.columns = [{ header: 'Metrica', key: 'metrica', width: 26 }, { header: 'Valor', key: 'valor', width: 20 }];
    wsRes2.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
    const receitaTotal = reservas.filter((r) => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_price), 0);
    wsRes2.addRows([
      { metrica: 'Periodo', valor: `${inicio} a ${fim}` },
      { metrica: 'Total de reservas', valor: reservas.filter((r) => r.status !== 'cancelled').length },
      { metrica: 'Receita total (€)', valor: Math.round(receitaTotal * 100) / 100 },
      { metrica: 'Reservas directas', valor: reservas.filter((r) => r.status !== 'cancelled' && ['direct','public','admin'].includes(r.source)).length },
      { metrica: 'Operador', valor: req.operator.name },
    ]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="saldesk-${inicio}-${fim}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { resumo, receita, unidades, topClientes, canais, exportExcel };

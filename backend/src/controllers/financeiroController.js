const { supabaseAdmin } = require('../config/supabase');
const { percentChange, calcularPeriodoAnterior, calcularMetricas, bucketKey } = require('../helpers/financeiroHelpers');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

async function fetchReservas(operatorId, inicio, fim) {
  const { data } = await supabaseAdmin
    .from('reservations')
    .select('id, unit_id, total_price, status, check_in, check_out, source, customer_name, customer_email')
    .eq('operator_id', operatorId)
    .lte('check_in', fim)
    .gt('check_out', inicio);
  return data || [];
}

async function fetchReceitasManuais(operatorId, inicio, fim) {
  const { data } = await supabaseAdmin
    .from('manual_revenues')
    .select('amount, date')
    .eq('operator_id', operatorId)
    .gte('date', inicio)
    .lte('date', fim);
  return data || [];
}

async function resumo(req, res, next) {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'inicio e fim sao obrigatorios', code: 'MISSING_FIELDS' });
    }

    const prev = calcularPeriodoAnterior(inicio, fim);

    const [unidadesRes, reservasAtual, reservasAnterior, manuaisAtual, manuaisAnterior] = await Promise.all([
      supabaseAdmin.from('units').select('id').eq('operator_id', req.operator.id).eq('status', 'active'),
      fetchReservas(req.operator.id, inicio, fim),
      fetchReservas(req.operator.id, prev.inicio, prev.fim),
      fetchReceitasManuais(req.operator.id, inicio, fim),
      fetchReceitasManuais(req.operator.id, prev.inicio, prev.fim),
    ]);

    const numUnidades = (unidadesRes.data || []).length;
    const atual    = calcularMetricas(reservasAtual,   numUnidades, inicio,     fim);
    const anterior = calcularMetricas(reservasAnterior, numUnidades, prev.inicio, prev.fim);

    /* Receita manual soma-se ao total, mas fica fora de valor_medio/taxa_ocupacao
       -- essas metricas sao calculadas so a partir de reservas reais. */
    atual.receita_manual    = Math.round(manuaisAtual.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    anterior.receita_manual = Math.round(manuaisAnterior.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    atual.receita    = Math.round((atual.receita    + atual.receita_manual)    * 100) / 100;
    anterior.receita = Math.round((anterior.receita + anterior.receita_manual) * 100) / 100;

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

    const [{ data: reservas }, manuais] = await Promise.all([
      supabaseAdmin
        .from('reservations')
        .select('check_out, total_price')
        .eq('operator_id', req.operator.id)
        .eq('status', 'checked_out')
        .gte('check_out', inicio)
        .lte('check_out', fim)
        .order('check_out'),
      fetchReceitasManuais(req.operator.id, inicio, fim),
    ]);

    const grupos = {};
    for (const r of reservas || []) {
      const chave = bucketKey(r.check_out, granularidade);
      if (!grupos[chave]) grupos[chave] = { periodo: chave, receita: 0, num_reservas: 0 };
      grupos[chave].receita += Number(r.total_price);
      grupos[chave].num_reservas += 1;
    }
    for (const m of manuais) {
      const chave = bucketKey(m.date, granularidade);
      if (!grupos[chave]) grupos[chave] = { periodo: chave, receita: 0, num_reservas: 0 };
      grupos[chave].receita += Number(m.amount);
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

async function exportPdf(req, res, next) {
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
    const naoCanceladas = reservas.filter((r) => r.status !== 'cancelled');
    const checkout = reservas.filter((r) => r.status === 'checked_out');
    const receitaTotal = Math.round(checkout.reduce((s, r) => s + Number(r.total_price), 0) * 100) / 100;
    const directas = naoCanceladas.filter((r) => ['direct', 'public', 'admin'].includes(r.source)).length;

    const totalDias = Math.ceil((new Date(fim + 'T00:00:00Z') - new Date(inicio + 'T00:00:00Z')) / (1000 * 60 * 60 * 24)) + 1;
    const porUnidade = unidadesData.map((unit) => {
      const reservasUnit = reservas.filter((r) => r.unit_id === unit.id);
      const receitaUnit = reservasUnit.filter((r) => r.status === 'checked_out').reduce((s, r) => s + Number(r.total_price), 0);
      return { name: unit.name, unit_type: unit.unit_type, num_reservas: reservasUnit.filter((r) => r.status !== 'cancelled').length, receita: Math.round(receitaUnit * 100) / 100 };
    }).sort((a, b) => b.receita - a.receita);

    const OCEAN = '#0D5470';
    const N900   = '#1A2332';
    const N500   = '#6B7280';
    const N200   = '#E5E8EC';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="saldesk-${inicio}-${fim}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(18).fillColor(OCEAN).text('SalDesk', 40, 40);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(N900).text(req.operator.name || '', 40, 62);
    doc.font('Helvetica').fontSize(9).fillColor(N500).text(`Relatorio financeiro  ·  ${inicio} a ${fim}`, 40, 80);
    doc.moveTo(40, 100).lineTo(555, 100).strokeColor(N200).stroke();

    let y = 118;
    const summary = [
      ['Receita total (checked-out)', `EUR ${receitaTotal.toLocaleString('pt-PT')}`],
      ['Total de reservas', String(naoCanceladas.length)],
      ['Reservas directas', String(directas)],
    ];
    summary.forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(10).fillColor(N500).text(label, 40, y);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(N900).text(value, 300, y);
      y += 18;
    });

    y += 16;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(OCEAN).text('Desempenho por unidade', 40, y);
    y += 20;
    const cols = [{ x: 40, w: 220, h: 'Unidade' }, { x: 260, w: 100, h: 'Tipo' }, { x: 370, w: 80, h: 'Reservas' }, { x: 460, w: 95, h: 'Receita' }];
    cols.forEach((c) => doc.font('Helvetica-Bold').fontSize(8).fillColor(N500).text(c.h.toUpperCase(), c.x, y, { width: c.w }));
    y += 14;
    doc.moveTo(40, y).lineTo(555, y).strokeColor(N200).stroke();
    y += 6;
    for (const u of porUnidade) {
      if (y > 760) { doc.addPage(); y = 40; }
      doc.font('Helvetica').fontSize(9).fillColor(N900).text(u.name, cols[0].x, y, { width: cols[0].w });
      doc.text(u.unit_type || '—', cols[1].x, y, { width: cols[1].w });
      doc.text(String(u.num_reservas), cols[2].x, y, { width: cols[2].w });
      doc.text(`EUR ${u.receita.toLocaleString('pt-PT')}`, cols[3].x, y, { width: cols[3].w });
      y += 16;
    }

    y += 10;
    if (y > 700) { doc.addPage(); y = 40; }
    doc.font('Helvetica-Bold').fontSize(11).fillColor(OCEAN).text('Reservas do periodo', 40, y);
    y += 20;
    const rcols = [{ x: 40, w: 60, h: 'Check-in' }, { x: 105, w: 60, h: 'Check-out' }, { x: 170, w: 140, h: 'Cliente' }, { x: 320, w: 120, h: 'Unidade' }, { x: 460, w: 95, h: 'Total' }];
    rcols.forEach((c) => doc.font('Helvetica-Bold').fontSize(8).fillColor(N500).text(c.h.toUpperCase(), c.x, y, { width: c.w }));
    y += 14;
    doc.moveTo(40, y).lineTo(555, y).strokeColor(N200).stroke();
    y += 6;
    for (const r of naoCanceladas) {
      if (y > 770) { doc.addPage(); y = 40; }
      doc.font('Helvetica').fontSize(8).fillColor(N900).text(r.check_in || '—', rcols[0].x, y, { width: rcols[0].w });
      doc.text(r.check_out || '—', rcols[1].x, y, { width: rcols[1].w });
      doc.text(r.customer_name || '—', rcols[2].x, y, { width: rcols[2].w });
      doc.text(r.units?.name || '—', rcols[3].x, y, { width: rcols[3].w });
      doc.text(`EUR ${Number(r.total_price).toLocaleString('pt-PT')}`, rcols[4].x, y, { width: rcols[4].w });
      y += 14;
    }

    doc.end();
  } catch (err) { next(err); }
}

/* ── Receitas manuais ── */

async function listarReceitasManuais(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('manual_revenues')
      .select('*')
      .eq('operator_id', req.operator.id)
      .order('date', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Receitas manuais listadas' });
  } catch (err) { next(err); }
}

async function criarReceitaManual(req, res, next) {
  try {
    const { category, amount, currency, date, notes, receipt_url } = req.body;
    if (!category || amount === undefined || !date) {
      return res.status(400).json({ error: 'category, amount e date sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data, error } = await supabaseAdmin
      .from('manual_revenues')
      .insert({
        operator_id: req.operator.id,
        category,
        amount:      Number(amount),
        currency:    currency || 'EUR',
        date,
        notes:       notes || null,
        receipt_url: receipt_url || null,
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Receita registada' });
  } catch (err) { next(err); }
}

async function actualizarReceitaManual(req, res, next) {
  try {
    const { category, amount, currency, date, notes, receipt_url } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (category !== undefined)    updates.category = category;
    if (amount !== undefined)      updates.amount = Number(amount);
    if (currency !== undefined)    updates.currency = currency;
    if (date !== undefined)        updates.date = date;
    if (notes !== undefined)       updates.notes = notes || null;
    if (receipt_url !== undefined) updates.receipt_url = receipt_url || null;

    const { data, error } = await supabaseAdmin
      .from('manual_revenues')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Receita nao encontrada', code: 'NOT_FOUND' });
    return res.json({ data, message: 'Receita actualizada' });
  } catch (err) { next(err); }
}

async function eliminarReceitaManual(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('manual_revenues')
      .delete()
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id);
    if (error) throw error;
    return res.json({ data: null, message: 'Receita eliminada' });
  } catch (err) { next(err); }
}

async function forecast(req, res, next) {
  try {
    const operatorId = req.operator.id;
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    const horizonte = new Date(hoje); horizonte.setUTCDate(horizonte.getUTCDate() + 8 * 7);
    const horizonteStr = horizonte.toISOString().split('T')[0];

    const anoPassadoInicio = new Date(hoje); anoPassadoInicio.setUTCFullYear(anoPassadoInicio.getUTCFullYear() - 1);
    const anoPassadoFim = new Date(horizonte); anoPassadoFim.setUTCFullYear(anoPassadoFim.getUTCFullYear() - 1);

    const seisMesesAtras = new Date(hoje); seisMesesAtras.setUTCMonth(seisMesesAtras.getUTCMonth() - 6);

    const [futurasRes, anoPassadoRes, historicoRes] = await Promise.all([
      supabaseAdmin.from('reservations').select('check_in, total_price')
        .eq('operator_id', operatorId).in('status', ['confirmed', 'checked_in', 'checked_out'])
        .gte('check_in', hojeStr).lte('check_in', horizonteStr),
      supabaseAdmin.from('reservations').select('total_price')
        .eq('operator_id', operatorId).eq('status', 'checked_out')
        .gte('check_in', anoPassadoInicio.toISOString().split('T')[0]).lte('check_in', anoPassadoFim.toISOString().split('T')[0]),
      supabaseAdmin.from('reservations').select('check_out, total_price')
        .eq('operator_id', operatorId).eq('status', 'checked_out')
        .gte('check_out', seisMesesAtras.toISOString().split('T')[0]),
    ]);

    const futuras = futurasRes.data || [];
    const confirmed_future_revenue = Math.round(futuras.reduce((s, r) => s + Number(r.total_price), 0) * 100) / 100;
    const same_period_last_year = Math.round((anoPassadoRes.data || []).reduce((s, r) => s + Number(r.total_price), 0) * 100) / 100;

    const porMes = {};
    for (const r of historicoRes.data || []) {
      const m = r.check_out.slice(0, 7);
      porMes[m] = (porMes[m] || 0) + Number(r.total_price);
    }
    const valoresMes = Object.values(porMes);
    const historical_avg = valoresMes.length ? Math.round((valoresMes.reduce((a, b) => a + b, 0) / valoresMes.length) * 100) / 100 : 0;

    const weeks = [];
    for (let i = 0; i < 8; i++) {
      const inicioSemana = new Date(hoje); inicioSemana.setUTCDate(hoje.getUTCDate() + i * 7);
      const fimSemana = new Date(inicioSemana); fimSemana.setUTCDate(inicioSemana.getUTCDate() + 6);
      const inicioStr = inicioSemana.toISOString().split('T')[0];
      const fimStr = fimSemana.toISOString().split('T')[0];
      const daSemana = futuras.filter((r) => r.check_in >= inicioStr && r.check_in <= fimStr);
      weeks.push({
        week_label: `${inicioStr.slice(5)} a ${fimStr.slice(5)}`,
        num_reservas: daSemana.length,
        receita: Math.round(daSemana.reduce((s, r) => s + Number(r.total_price), 0) * 100) / 100,
      });
    }

    return res.json({ data: { confirmed_future_revenue, same_period_last_year, historical_avg, weeks }, message: 'Previsao de receita' });
  } catch (err) { next(err); }
}

module.exports = {
  resumo, receita, unidades, topClientes, canais, exportExcel, exportPdf, forecast,
  listarReceitasManuais, criarReceitaManual, actualizarReceitaManual, eliminarReceitaManual,
};

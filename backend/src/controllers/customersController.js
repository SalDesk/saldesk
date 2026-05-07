const { supabaseAdmin } = require('../config/supabase');
const { detectarIdioma } = require('../helpers/languageHelper');

async function listar(req, res, next) {
  try {
    const { search, country_code, sort = 'total_spent' } = req.query;

    let q = supabaseAdmin
      .from('customers')
      .select('*')
      .eq('operator_id', req.operator.id);

    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    if (country_code) q = q.eq('country_code', country_code.toUpperCase());

    const sortField = ['total_spent', 'total_visits', 'created_at', 'name'].includes(sort)
      ? sort
      : 'total_spent';
    q = q.order(sortField, { ascending: sortField === 'name' });

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ data, message: 'Clientes listados' });
  } catch (err) {
    next(err);
  }
}

async function obter(req, res, next) {
  try {
    const [clienteRes, reservasRes] = await Promise.all([
      supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', req.params.id)
        .eq('operator_id', req.operator.id)
        .single(),
      supabaseAdmin
        .from('reservations')
        .select('id, check_in, check_out, total_price, status, source, units(name, unit_type)')
        .eq('customer_id', req.params.id)
        .order('check_in', { ascending: false }),
    ]);

    if (!clienteRes.data) {
      return res.status(404).json({ error: 'Cliente nao encontrado', code: 'NOT_FOUND' });
    }

    return res.json({
      data: { ...clienteRes.data, reservations: reservasRes.data || [] },
      message: 'Cliente encontrado',
    });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { name, phone, country_code, notes } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (country_code !== undefined) {
      updates.country_code = country_code.toUpperCase();
      updates.language = detectarIdioma(country_code);
    }
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updates)
      .eq('id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Cliente nao encontrado', code: 'NOT_FOUND' });
    }

    return res.json({ data, message: 'Cliente actualizado' });
  } catch (err) {
    next(err);
  }
}

async function segmentos(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('operator_id', req.operator.id)
      .order('total_spent', { ascending: false });

    if (error) throw error;

    const todos = data || [];

    const top_spenders = todos.slice(0, 5);

    const frequent = [...todos]
      .sort((a, b) => b.total_visits - a.total_visits)
      .slice(0, 5);

    const by_nationality = todos.reduce((acc, c) => {
      if (!c.country_code) return acc;
      const existing = acc.find((x) => x.country_code === c.country_code);
      if (existing) {
        existing.count++;
        existing.total_spent = Number(existing.total_spent) + Number(c.total_spent);
      } else {
        acc.push({ country_code: c.country_code, count: 1, total_spent: Number(c.total_spent) });
      }
      return acc;
    }, []).sort((a, b) => b.count - a.count).slice(0, 8);

    return res.json({
      data: { top_spenders, frequent, by_nationality, total: todos.length },
      message: 'Segmentos calculados',
    });
  } catch (err) {
    next(err);
  }
}

async function exportCsv(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('name, email, phone, country_code, language, total_visits, total_spent, notes, created_at')
      .eq('operator_id', req.operator.id)
      .order('total_spent', { ascending: false });

    if (error) throw error;

    const header = 'Nome,Email,Telefone,Pais,Idioma,Visitas,Total Gasto,Notas,Criado em';
    const rows = (data || []).map((c) =>
      [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        c.country_code || '',
        c.language || '',
        c.total_visits,
        Number(c.total_spent).toFixed(2),
        `"${(c.notes || '').replace(/"/g, '""')}"`,
        c.created_at ? c.created_at.split('T')[0] : '',
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clientes-${Date.now()}.csv"`);
    return res.send('﻿' + csv);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obter, actualizar, segmentos, exportCsv };

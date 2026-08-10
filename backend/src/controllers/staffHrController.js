const { supabaseAdmin } = require('../config/supabase');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

/* Sugestao de dias de ferias a partir da data de admissao, seguindo a
   proporcao legal cabo-verdiana (22 dias / 12 meses trabalhados, ~1.83
   dias/mes) -- e so uma sugestao para pre-preencher o formulario, nunca
   substitui o entitled_days que o operador configurar. */
function suggestedLeaveDays(hireDate) {
  if (!hireDate) return null;
  const hire = new Date(hireDate);
  const now = new Date();
  let months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  if (now.getDate() < hire.getDate()) months -= 1; // ainda nao completou o mes corrente
  return Math.min(22, Math.round(Math.max(0, months) * 22 / 12));
}

/* ══════════════════════════════════════════
   FERIAS / AUSENCIAS
══════════════════════════════════════════ */
async function listarFerias(req, res, next) {
  try {
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    const { data, error } = await supabaseAdmin
      .from('staff_leave')
      .select('*')
      .eq('staff_id', req.params.id)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Ferias listadas' });
  } catch (err) { next(err); }
}

async function criarFerias(req, res, next) {
  try {
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    const { type, start_date, end_date, notes } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date e end_date sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    if (end_date < start_date) {
      return res.status(400).json({ error: 'end_date deve ser posterior a start_date', code: 'INVALID_DATES' });
    }
    const operatorId = getOperatorId(req);
    const { data, error } = await supabaseAdmin
      .from('staff_leave')
      .insert({
        operator_id: operatorId,
        staff_id: req.params.id,
        type: type || 'vacation',
        start_date, end_date,
        notes: notes || null,
        status: req.staff ? 'pending' : 'approved',
      })
      .select().single();
    if (error) throw error;

    if (data.status === 'approved') {
      await marcarIndisponivel(data);
    }
    return res.status(201).json({ data, message: 'Pedido de ferias criado' });
  } catch (err) { next(err); }
}

async function actualizarEstadoFerias(req, res, next) {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'status invalido', code: 'INVALID_STATUS' });
    }
    const { data, error } = await supabaseAdmin
      .from('staff_leave')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.leaveId)
      .eq('staff_id', req.params.id)
      .eq('operator_id', req.operator.id)
      .select().single();
    if (error || !data) return res.status(404).json({ error: 'Nao encontrado', code: 'NOT_FOUND' });

    if (status === 'approved') {
      await marcarIndisponivel(data);
    }
    return res.json({ data, message: 'Estado actualizado' });
  } catch (err) { next(err); }
}

/* Ao aprovar ferias, expande o periodo em linhas de staff_availability
   (is_available:false) -- mesma tecnica ja usada por StaffAvailability no
   StaffPortal.jsx -- para que escalas/job_assignments continuem a funcionar
   sem precisarem de saber nada sobre ferias. */
async function marcarIndisponivel(leave) {
  const rows = [];
  let d = new Date(leave.start_date + 'T00:00:00Z');
  const end = new Date(leave.end_date + 'T00:00:00Z');
  while (d <= end) {
    rows.push({
      staff_id: leave.staff_id,
      operator_id: leave.operator_id,
      date: d.toISOString().split('T')[0],
      is_available: false,
      notes: 'Ferias/ausencia',
    });
    d = new Date(d.getTime() + 86400000);
  }
  if (rows.length) {
    await supabaseAdmin.from('staff_availability').upsert(rows, { onConflict: 'staff_id,date' });
  }
}

async function obterSaldoFerias(req, res, next) {
  try {
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const [{ data: balance }, { data: approved }, { data: staffRow }] = await Promise.all([
      supabaseAdmin.from('staff_leave_balance').select('*')
        .eq('staff_id', req.params.id).eq('year', year).maybeSingle(),
      supabaseAdmin.from('staff_leave').select('start_date, end_date')
        .eq('staff_id', req.params.id).eq('status', 'approved')
        .gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`),
      supabaseAdmin.from('staff').select('hire_date').eq('id', req.params.id).maybeSingle(),
    ]);

    const usedDays = (approved || []).reduce((sum, l) => {
      const days = Math.round((new Date(l.end_date) - new Date(l.start_date)) / 86400000) + 1;
      return sum + days;
    }, 0);

    return res.json({
      data: {
        year,
        entitled_days: balance?.entitled_days ?? null,
        suggested_days: balance?.entitled_days == null ? suggestedLeaveDays(staffRow?.hire_date) : null,
        used_days: usedDays,
        remaining_days: balance ? Math.max(0, balance.entitled_days - usedDays) : null,
      },
      message: 'Saldo calculado',
    });
  } catch (err) { next(err); }
}

async function actualizarSaldoFerias(req, res, next) {
  try {
    const { year, entitled_days } = req.body;
    if (!year || entitled_days === undefined) {
      return res.status(400).json({ error: 'year e entitled_days sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data, error } = await supabaseAdmin
      .from('staff_leave_balance')
      .upsert({
        operator_id: req.operator.id,
        staff_id: req.params.id,
        year: Number(year),
        entitled_days: Number(entitled_days),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'staff_id,year' })
      .select().single();
    if (error) throw error;
    return res.json({ data, message: 'Saldo de ferias actualizado' });
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════
   DOCUMENTOS
══════════════════════════════════════════ */
async function listarDocumentos(req, res, next) {
  try {
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    const { data, error } = await supabaseAdmin
      .from('staff_documents')
      .select('*')
      .eq('staff_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ data, message: 'Documentos listados' });
  } catch (err) { next(err); }
}

async function criarDocumento(req, res, next) {
  try {
    const { type, name, file_url, expiry_date } = req.body;
    if (!name || !file_url) {
      return res.status(400).json({ error: 'name e file_url sao obrigatorios', code: 'MISSING_FIELDS' });
    }
    const { data, error } = await supabaseAdmin
      .from('staff_documents')
      .insert({
        operator_id: req.operator.id,
        staff_id: req.params.id,
        type: type || 'other',
        name, file_url,
        expiry_date: expiry_date || null,
      })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Documento guardado' });
  } catch (err) { next(err); }
}

async function eliminarDocumento(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('staff_documents')
      .delete()
      .eq('id', req.params.docId)
      .eq('staff_id', req.params.id)
      .eq('operator_id', req.operator.id);
    if (error) throw error;
    return res.json({ data: null, message: 'Documento eliminado' });
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════
   CERTIFICACOES
══════════════════════════════════════════ */
async function listarCertificacoes(req, res, next) {
  try {
    if (req.staff && req.staff.id !== req.params.id) {
      return res.status(403).json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' });
    }
    const { data, error } = await supabaseAdmin
      .from('staff_certifications')
      .select('*')
      .eq('staff_id', req.params.id)
      .order('expiry_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return res.json({ data, message: 'Certificacoes listadas' });
  } catch (err) { next(err); }
}

async function criarCertificacao(req, res, next) {
  try {
    const { name, issuer, issued_date, expiry_date, file_url } = req.body;
    if (!name) return res.status(400).json({ error: 'name e obrigatorio', code: 'MISSING_FIELDS' });
    const { data, error } = await supabaseAdmin
      .from('staff_certifications')
      .insert({
        operator_id: req.operator.id,
        staff_id: req.params.id,
        name, issuer: issuer || null,
        issued_date: issued_date || null,
        expiry_date: expiry_date || null,
        file_url: file_url || null,
      })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Certificacao guardada' });
  } catch (err) { next(err); }
}

async function eliminarCertificacao(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('staff_certifications')
      .delete()
      .eq('id', req.params.certId)
      .eq('staff_id', req.params.id)
      .eq('operator_id', req.operator.id);
    if (error) throw error;
    return res.json({ data: null, message: 'Certificacao eliminada' });
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════════
   VISAO GERAL DE RH (operador)
══════════════════════════════════════════ */
async function obterVisaoGeralRH(req, res, next) {
  try {
    const operatorId = req.operator.id;
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const [{ data: staffList }, { data: pendingLeave }, { data: docs }, { data: certs }] = await Promise.all([
      supabaseAdmin.from('staff').select('id, name, role, photo_url, status')
        .eq('operator_id', operatorId).eq('status', 'active').order('name'),
      supabaseAdmin.from('staff_leave').select('*, staff(name)')
        .eq('operator_id', operatorId).eq('status', 'pending').order('start_date'),
      supabaseAdmin.from('staff_documents').select('*, staff(name)')
        .eq('operator_id', operatorId).not('expiry_date', 'is', null).lte('expiry_date', in30Days),
      supabaseAdmin.from('staff_certifications').select('*, staff(name)')
        .eq('operator_id', operatorId).not('expiry_date', 'is', null).lte('expiry_date', in30Days),
    ]);

    const expiring = [
      ...(docs || []).map((d) => ({ ...d, kind: 'document', staff_name: d.staff?.name })),
      ...(certs || []).map((c) => ({ ...c, kind: 'certification', staff_name: c.staff?.name })),
    ].sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

    return res.json({
      data: {
        staff: staffList || [],
        pending_leave: (pendingLeave || []).map((l) => ({ ...l, staff_name: l.staff?.name })),
        expiring,
      },
      message: 'Visao geral de RH',
    });
  } catch (err) { next(err); }
}

module.exports = {
  listarFerias, criarFerias, actualizarEstadoFerias, obterSaldoFerias, actualizarSaldoFerias,
  listarDocumentos, criarDocumento, eliminarDocumento,
  listarCertificacoes, criarCertificacao, eliminarCertificacao,
  obterVisaoGeralRH,
};

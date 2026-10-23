/* Camada de mensagens (WhatsApp): rotas do painel e da vista /staff.
   Nenhuma chamada ao WhatsApp acontece aqui: o wa.me so devolve um link. */

const { supabaseAdmin } = require('../config/supabase');
const service = require('../messaging/service');
const outbox = require('../messaging/outbox');
const templates = require('../messaging/templates');
const { renderTemplate, variaveisDesconhecidas } = require('../helpers/automationTemplate');

function getOperatorId(req) {
  return req.operator?.id || req.staff?.operator_id;
}

// Perfis de staff que gerem o operador: veem todas as reservas; os restantes so as que lhes foram atribuidas.
const PERFIS_GESTAO = ['Administracao', 'Gestor/Supervisor'];

function ePerfilDeGestao(req) {
  return !!req.operator || PERFIS_GESTAO.includes(req.staff?.role);
}

async function reservasAtribuidas(req) {
  const { data } = await supabaseAdmin
    .from('job_assignments')
    .select('reservation_id')
    .eq('operator_id', getOperatorId(req)).eq('staff_id', req.staff.id);
  return [...new Set((data || []).map((r) => r.reservation_id))];
}

async function podeAceder(req, reservationId) {
  if (ePerfilDeGestao(req)) return true;
  const { data } = await supabaseAdmin
    .from('job_assignments').select('id')
    .eq('operator_id', getOperatorId(req)).eq('staff_id', req.staff.id).eq('reservation_id', reservationId)
    .limit(1);
  return !!data?.length;
}

/* POST /messaging/reservations/:id/send  { trigger, resend? } */
async function enviarParaReserva(req, res, next) {
  try {
    const { trigger, resend } = req.body || {};
    const reservationId = req.params.id;
    if (!(await podeAceder(req, reservationId))) {
      return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }
    const data = await service.enviarParaReserva({
      operatorId: getOperatorId(req), reservationId, trigger, resend: resend === true,
    });
    return res.status(data.created ? 201 : 200).json({ data, message: data.created ? 'Mensagem preparada' : 'Mensagem ja preparada' });
  } catch (err) { next(err); }
}

/* POST /messaging/outbox/:id/opened: o humano abriu o link do WhatsApp. */
async function marcarAberto(req, res, next) {
  try {
    const operatorId = getOperatorId(req);
    const { data: linha } = await supabaseAdmin
      .from('message_outbox').select('id, booking_id').eq('id', req.params.id).eq('operator_id', operatorId).maybeSingle();
    if (!linha) return res.status(404).json({ error: 'Mensagem nao encontrada', code: 'NOT_FOUND' });
    if (linha.booking_id && !(await podeAceder(req, linha.booking_id))) {
      return res.status(403).json({ error: 'Acesso negado', code: 'FORBIDDEN' });
    }
    await outbox.marcarAberto(operatorId, linha.id);
    return res.json({ message: 'Registado' });
  } catch (err) { next(err); }
}

/* GET /messaging/outbox?status=awaiting_human&booking_id=...&limit=50 */
async function listar(req, res, next) {
  try {
    const { status, booking_id, limit } = req.query;
    const filtros = { status, bookingId: booking_id, limit };
    if (!ePerfilDeGestao(req)) {
      // Staff sem perfil de gestao: so as mensagens das reservas que lhe estao atribuidas.
      filtros.bookingIds = await reservasAtribuidas(req);
    }
    const data = await outbox.listar(getOperatorId(req), filtros);
    return res.json({ data, message: 'Mensagens listadas' });
  } catch (err) { next(err); }
}

/* GET /messaging/templates */
async function listarTemplates(req, res, next) {
  try {
    return res.json({ data: await templates.listarTemplates(req.operator.id), message: 'Templates listados' });
  } catch (err) { next(err); }
}

/* PUT /messaging/templates/:trigger/:locale  { body }  (body vazio = volta ao texto por omissao) */
async function guardarTemplate(req, res, next) {
  try {
    const data = await templates.guardarTemplate(req.operator.id, req.params.trigger, req.params.locale, req.body?.body);
    return res.json({ data, message: data.custom ? 'Template guardado' : 'Template reposto' });
  } catch (err) { next(err); }
}

/* Dados de exemplo da pre-visualizacao. Sem ponto de encontro (a plataforma ainda nao o guarda),
   para o operador ver exactamente o que o cliente recebe: essa linha desaparece. */
function dadosDeExemplo(operatorName, locale) {
  return {
    customer_name: 'Maria Silva',
    unit_name: locale === 'en' ? 'Sunset Boat Trip' : 'Passeio de Barco ao Pôr do Sol',
    check_in: '2026-12-15',
    start_time: '17:30:00',
    guide_name: 'João',
    meeting_point: '',
    operator_name: operatorName || 'a sua empresa',
    review_link: 'https://app.saldesk.cv/review/exemplo',
  };
}

/* POST /messaging/templates/preview  { body, locale } */
async function previewTemplate(req, res, next) {
  try {
    const { body, locale } = req.body || {};
    const texto = String(body || '');
    if (texto.length > 2000) {
      return res.status(400).json({ error: 'Mensagem demasiado longa', code: 'TEMPLATE_TOO_LONG' });
    }
    const idioma = templates.idiomaValido(locale);
    return res.json({
      data: {
        text: renderTemplate(texto, dadosDeExemplo(req.operator.name, idioma)),
        unknown_variables: variaveisDesconhecidas(texto),
      },
      message: 'Pre-visualizacao',
    });
  } catch (err) { next(err); }
}

module.exports = { enviarParaReserva, marcarAberto, listar, listarTemplates, guardarTemplate, previewTemplate };

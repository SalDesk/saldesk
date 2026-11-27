import { useState, useEffect } from 'react';
import {
  Mail, MessageCircle, Calendar, Star, Gift, Newspaper,
  ChevronDown, ChevronUp, Eye, Edit2, Save, X as XIcon,
  History,
} from 'lucide-react';
import {
  listAutomations, createAutomation, updateAutomation,
  toggleAutomation, getLogsAll,
} from '../services/automationsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import EmptyState from '../components/ui/EmptyState';
import Input, { Textarea } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { formatarData } from '../utils/formatoLingua';

/* Estilo Mare: cartao de pagina, titulo de cartao e figuras */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card min-w-0';
const TITULO = 'font-display text-lg font-semibold text-ocean-900';
const NUM = 'font-mono tabular-nums';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';
/* pilula PT/EN da pre-visualizacao: um unico conjunto de cores por estado */
const pilulaLingua = (activa) => `text-xs px-3 min-h-11 md:min-h-8 rounded-full font-mono transition-colors ${FOCO} ${activa ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-700 hover:bg-n-200'}`;

/* ── Sequence definitions ── */
const SEQUENCES = [
  {
    id: 'booking_email',
    trigger_type: 'booking_confirmed', trigger_days: null, channel: 'email',
    Icon: Mail, iconColor: 'text-ocean-700', iconBg: 'bg-ocean-50',
    defaults: {
      name: 'Confirmação de reserva',
      subject_pt: 'A sua reserva foi confirmada — {nome_tour}',
      subject_en: 'Your booking is confirmed — {nome_tour}',
      message_pt: 'Olá {nome_cliente},\n\nA sua reserva de {nome_tour} em {data} às {hora} foi confirmada.\n\nPonto de encontro: {ponto_encontro}\nGuia: {guia}\n\nLembre-se de trazer protector solar e vestuário confortável.\n\nObrigado por escolher a nossa empresa!',
      message_en: 'Hello {nome_cliente},\n\nYour {nome_tour} booking for {data} at {hora} is confirmed.\n\nMeeting point: {ponto_encontro}\nGuide: {guia}\n\nRemember to bring sunscreen and comfortable clothing.\n\nThank you for choosing us!',
    },
  },
  {
    id: 'booking_whatsapp',
    trigger_type: 'booking_confirmed', trigger_days: null, channel: 'whatsapp',
    Icon: MessageCircle, iconColor: 'text-[var(--success)]', iconBg: 'bg-[var(--success-light)]',
    defaults: {
      name: 'Boas-vindas WhatsApp',
      subject_pt: '', subject_en: '',
      message_pt: 'Olá {nome_cliente}! Confirmamos a sua reserva de *{nome_tour}* em {data} às {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Qualquer questão, estamos disponíveis!',
      message_en: 'Hello {nome_cliente}! Your *{nome_tour}* booking for {data} at {hora} is confirmed. Meeting point: {ponto_encontro}. Guide: {guia}. Contact us for any questions!',
    },
  },
  {
    id: 'd7_email',
    trigger_type: 'days_before_checkin', trigger_days: 7, channel: 'email',
    Icon: Calendar, iconColor: 'text-ocean-500', iconBg: 'bg-ocean-50',
    defaults: {
      name: 'Lembrete 7 dias',
      subject_pt: 'O seu tour é em 7 dias — {nome_tour}',
      subject_en: 'Your tour is in 7 days — {nome_tour}',
      message_pt: 'Olá {nome_cliente},\n\nO seu tour {nome_tour} é em 7 dias, em {data} às {hora}.\n\nPonto de encontro: {ponto_encontro}\nGuia: {guia}\n\nO que trazer:\n- Vestuário confortável\n- Protector solar e oculos de sol\n- Água e snack leve\n- Documento de identidade\n\nAte breve!',
      message_en: 'Hello {nome_cliente},\n\nYour {nome_tour} tour is in 7 days, on {data} at {hora}.\n\nMeeting point: {ponto_encontro}\nGuide: {guia}\n\nWhat to bring:\n- Comfortable clothing\n- Sunscreen and sunglasses\n- Water and light snack\n- ID document\n\nSee you soon!',
    },
  },
  {
    id: 'd3_email',
    trigger_type: 'days_before_checkin', trigger_days: 3, channel: 'email',
    Icon: Calendar, iconColor: 'text-sand-600', iconBg: 'bg-sand-50',
    defaults: {
      name: 'Instruções D-3',
      subject_pt: 'Instruções finais para o seu tour — {nome_tour}',
      subject_en: 'Final instructions for your tour — {nome_tour}',
      message_pt: 'Olá {nome_cliente},\n\nO seu tour {nome_tour} é em apenas 3 dias!\n\n- Data: {data} às {hora}\n- Ponto de encontro: {ponto_encontro}\n- Guia: {guia}\n\nEm caso de cancelamento por mau tempo, entraremos em contacto com 24h de antecedência.\n\nAte breve!',
      message_en: 'Hello {nome_cliente},\n\nYour {nome_tour} tour is in just 3 days!\n\n- Date: {data} at {hora}\n- Meeting point: {ponto_encontro}\n- Guide: {guia}\n\nIn case of cancellation due to bad weather, we will contact you 24h in advance.\n\nSee you soon!',
    },
  },
  {
    id: 'd1_whatsapp',
    trigger_type: 'days_before_checkin', trigger_days: 1, channel: 'whatsapp',
    Icon: MessageCircle, iconColor: 'text-[var(--success)]', iconBg: 'bg-[var(--success-light)]',
    defaults: {
      name: 'Lembrete D-1',
      subject_pt: '', subject_en: '',
      message_pt: 'Olá {nome_cliente}! Lembrete: o seu tour *{nome_tour}* é amanhã em {data} às {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Até amanhã!',
      message_en: 'Hello {nome_cliente}! Reminder: your *{nome_tour}* tour is tomorrow {data} at {hora}. Meeting point: {ponto_encontro}. Guide: {guia}. See you tomorrow!',
    },
  },
  {
    id: 'post1_review',
    trigger_type: 'days_after_checkout', trigger_days: 1, channel: 'email',
    Icon: Star, iconColor: 'text-sand-600', iconBg: 'bg-sand-50',
    defaults: {
      name: 'Pedido de avaliação',
      subject_pt: 'Como correu o seu tour? — {nome_tour}',
      subject_en: 'How was your tour? — {nome_tour}',
      message_pt: 'Olá {nome_cliente},\n\nEsperamos que tenha tido uma experiência incrível no tour {nome_tour}!\n\nA sua opinião é muito importante para nós. Clique no link abaixo para deixar a sua avaliação:\n\n→ Avaliar o meu tour\n\nObrigado pela sua confiança!',
      message_en: 'Hello {nome_cliente},\n\nWe hope you had an amazing experience on the {nome_tour} tour!\n\nYour feedback means the world to us. Click the link below to leave your review:\n\n→ Rate my tour\n\nThank you for your trust!',
    },
  },
  {
    id: 'post7_discount',
    trigger_type: 'days_after_checkout', trigger_days: 7, channel: 'email',
    Icon: Gift, iconColor: 'text-[var(--success)]', iconBg: 'bg-[var(--success-light)]',
    defaults: {
      name: 'Desconto fidelidade D+7',
      subject_pt: 'Um presente especial para si — {nome_tour}',
      subject_en: 'A special gift for you',
      message_pt: 'Olá {nome_cliente},\n\nObrigado por ter escolhido o tour {nome_tour}!\n\nComo agradecimento, temos um desconto especial de 10% para a sua próxima reserva. Use o código: VOLTA10\n\nValido por 30 dias. Reserve em: saldesk.cv\n\nEsperamos ve-lo em breve!',
      message_en: 'Hello {nome_cliente},\n\nThank you for joining the {nome_tour} tour!\n\nAs a thank you, we have a special 10% discount for your next booking. Use code: BACK10\n\nValid for 30 days. Book at: saldesk.cv\n\nWe hope to see you soon!',
    },
  },
  {
    id: 'post30_newsletter',
    trigger_type: 'days_after_checkout', trigger_days: 30, channel: 'email',
    Icon: Newspaper, iconColor: 'text-n-600', iconBg: 'bg-n-100',
    defaults: {
      name: 'Newsletter D+30',
      subject_pt: 'Novidades e novos tours para si',
      subject_en: 'New tours and updates for you',
      message_pt: 'Olá {nome_cliente},\n\nJá passou um mês desde o seu tour {nome_tour}! Temos novidades incríveis:\n\n- Novos tours disponíveis para esta epoca\n- Pacotes especiais de fim de semana\n- Experiências exclusivas em Cabo Verde\n\nVeja todas as novidades e reserve em: saldesk.cv\n\nAte breve!',
      message_en: 'Hello {nome_cliente},\n\nA month has passed since your {nome_tour} tour! We have amazing news:\n\n- New tours available this season\n- Special weekend packages\n- Exclusive experiences across Cabo Verde\n\nCheck out everything at: saldesk.cv\n\nSee you soon!',
    },
  },
];

const VARS = [
  { key: '{nome_cliente}', id: 'nome_cliente' },
  { key: '{nome_tour}',    id: 'nome_tour' },
  { key: '{data}',         id: 'data' },
  { key: '{hora}',         id: 'hora' },
  { key: '{guia}',         id: 'guia' },
  { key: '{ponto_encontro}', id: 'ponto_encontro' },
];

const DEMO = {
  '{nome_cliente}': 'Maria Santos',
  '{nome_tour}':    'Kitesurf Lesson',
  '{data}':         '15 Jun 2025',
  '{hora}':         '09h00',
  '{guia}':         'João Silva',
  '{ponto_encontro}': 'Praia de Santa Maria, Sal',
};

function interpolate(text) {
  if (!text) return '';
  let out = text;
  Object.entries(DEMO).forEach(([k, v]) => { out = out.split(k).join(v); });
  return out;
}

function findAutomation(list, seq) {
  return list.find(a =>
    a.trigger_type === seq.trigger_type &&
    a.channel === seq.channel &&
    (seq.trigger_days == null
      ? !a.trigger_days || a.trigger_days == null
      : Number(a.trigger_days) === seq.trigger_days),
  );
}

/* ── EmailPreview ── */
function EmailPreview({ subject, body, isWhatsApp }) {
  const t = useT();
  const pb = interpolate(body);
  const ps = interpolate(subject);

  if (isWhatsApp) {
    return (
      <div className="border border-mare-card rounded-[14px] overflow-hidden">
        <div className="bg-[var(--success)] px-3 py-2 flex items-center gap-2">
          <MessageCircle size={13} strokeWidth={1.75} className="text-white shrink-0" />
          <p className="text-white text-xs font-body font-semibold">{t('automations.previewWhatsApp')}</p>
        </div>
        <div className="bg-n-100 p-3">
          <div className="bg-white rounded-lg px-3 py-2 max-w-xs shadow-sm">
            <pre className="text-xs font-body text-n-800 whitespace-pre-wrap leading-relaxed">{pb || t('automations.emptyBody')}</pre>
            <p className="text-[10px] font-mono tabular-nums text-n-600 text-right mt-1">09:00</p>
          </div>
        </div>
        <div className="bg-n-50 px-3 py-1.5 border-t border-n-100">
          <p className="text-[11px] font-mono text-n-600">{t('automations.sampleNote')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-mare-card rounded-[14px] overflow-hidden">
      <div className="bg-ocean-900 px-4 py-2.5">
        <p className="text-white text-[11px] font-display font-semibold">SalDesk Tours</p>
        {ps && <p className="text-ocean-300 text-[11px] font-mono mt-0.5">{t('automations.previewSubject')} {ps}</p>}
      </div>
      <div className="bg-white px-5 py-4">
        <pre className="text-xs font-body text-n-700 whitespace-pre-wrap leading-relaxed">{pb || t('automations.emptyBody')}</pre>
      </div>
      <div className="bg-n-50 px-4 py-2 border-t border-n-100">
        <p className="text-[11px] font-mono text-n-600">{t('automations.sampleNoteLong')}</p>
      </div>
    </div>
  );
}

/* ── SequenceCard ── */
function SequenceCard({ seq, automation, onSaved }) {
  const t = useT();
  const titulo = t(`automations.seq.${seq.id}.title`);
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewLang, setPreviewLang] = useState('pt');
  const [saving,   setSaving]  = useState(false);
  const [toggling, setToggling] = useState(false);

  const [form, setForm] = useState(() => ({
    subject_pt: automation?.subject_pt || automation?.subject || seq.defaults.subject_pt || '',
    subject_en: automation?.subject_en || seq.defaults.subject_en || '',
    message_pt: automation?.message_pt || seq.defaults.message_pt,
    message_en: automation?.message_en || seq.defaults.message_en,
  }));

  useEffect(() => {
    setForm({
      subject_pt: automation?.subject_pt || automation?.subject || seq.defaults.subject_pt || '',
      subject_en: automation?.subject_en || seq.defaults.subject_en || '',
      message_pt: automation?.message_pt || seq.defaults.message_pt,
      message_en: automation?.message_en || seq.defaults.message_en,
    });
  }, [automation?.id]);

  const isActive = automation?.active ?? false;
  const hasEmail = seq.channel === 'email';

  async function handleToggle(e) {
    e.stopPropagation();
    setToggling(true);
    try {
      if (automation) {
        const updated = await toggleAutomation(automation.id, !automation.active);
        onSaved(updated, false);
      } else {
        const created = await createAutomation({
          name: seq.defaults.name,
          trigger_type: seq.trigger_type,
          trigger_days: seq.trigger_days,
          channel: seq.channel,
          subject: seq.defaults.subject_pt || '',
          subject_pt: seq.defaults.subject_pt || '',
          subject_en: seq.defaults.subject_en || '',
          message_pt: seq.defaults.message_pt,
          message_en: seq.defaults.message_en,
          active: true,
        });
        onSaved(created, true);
      }
    } catch (err) { console.error(err); }
    finally { setToggling(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: seq.defaults.name,
        trigger_type: seq.trigger_type,
        trigger_days: seq.trigger_days,
        channel: seq.channel,
        subject: form.subject_pt,
        subject_pt: form.subject_pt,
        subject_en: form.subject_en,
        message_pt: form.message_pt,
        message_en: form.message_en,
        active: automation?.active ?? true,
      };
      let result;
      if (automation) {
        result = await updateAutomation(automation.id, payload);
      } else {
        result = await createAutomation(payload);
      }
      onSaved(result, !automation);
      setEditing(false);
      setPreview(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function insertVar(v) {
    setForm(p => ({ ...p, message_pt: p.message_pt + v }));
  }

  function toggleOpen() {
    setOpen(p => !p);
    setEditing(false);
    setPreview(false);
  }

  const previewSubject = previewLang === 'en' ? form.subject_en : form.subject_pt;
  const previewBody    = previewLang === 'en' ? form.message_en : form.message_pt;

  return (
    <article className={`${CARTAO} overflow-hidden transition-opacity ${isActive ? '' : 'opacity-70'}`}>
      {/* Header */}
      <div
        role="button" tabIndex={0} aria-expanded={open}
        className={`flex items-center gap-3 px-[22px] py-4 min-h-11 cursor-pointer select-none ${FOCO}`}
        onClick={toggleOpen}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); }
        }}
      >
        <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${seq.iconBg}`}>
          <seq.Icon size={16} strokeWidth={1.75} className={seq.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`${TITULO} truncate`}>{titulo}</h3>
          <p className="text-xs font-body text-n-600">{t(`automations.seq.${seq.id}.subtitle`)}</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-n-700 bg-n-100 px-2.5 py-0.5 rounded-full shrink-0">
          {hasEmail
            ? <Mail size={10} strokeWidth={1.75} />
            : <MessageCircle size={10} strokeWidth={1.75} />}
          {hasEmail ? 'Email' : 'WhatsApp'}
        </span>
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          aria-pressed={isActive}
          aria-label={t(isActive ? 'automations.deactivate' : 'automations.activate', { title: titulo })}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors before:absolute before:content-[''] before:-inset-x-1.5 before:-inset-y-3.5 ${FOCO} ${toggling ? 'opacity-50' : ''} ${isActive ? 'bg-ocean-700' : 'bg-n-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        {open
          ? <ChevronUp size={15} strokeWidth={1.75} className="text-n-500 shrink-0" />
          : <ChevronDown size={15} strokeWidth={1.75} className="text-n-500 shrink-0" />}
      </div>

      {/* Expanded */}
      {open && (
        <div className="border-t border-mare-card px-[22px] py-4 space-y-4 bg-mare-head">
          {!editing ? (
            /* Read-only */
            <div className="space-y-3">
              {hasEmail && form.subject_pt && (
                <div className="bg-white border border-mare-card rounded-[14px] px-3 py-2">
                  <p className="text-[11px] font-mono text-n-600 mb-0.5 uppercase tracking-wide">{t('automations.subjectPt')}</p>
                  <p className="text-xs font-body text-n-700 truncate">{form.subject_pt}</p>
                </div>
              )}
              <div className="bg-white border border-mare-card rounded-[14px] px-3 py-2">
                <p className="text-[11px] font-mono text-n-600 mb-0.5 uppercase tracking-wide">{t('automations.messagePt')}</p>
                <p className="text-xs font-body text-n-600 whitespace-pre-wrap line-clamp-3">{form.message_pt}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={Edit2} className="min-h-11 md:min-h-0" onClick={e => { e.stopPropagation(); setEditing(true); }}>
                  {t('automations.editTemplate')}
                </Button>
                <Button variant="secondary" size="sm" icon={Eye} className="min-h-11 md:min-h-0" onClick={e => { e.stopPropagation(); setPreview(p => !p); }}>
                  {preview ? t('automations.hide') : t('automations.preview')}
                </Button>
              </div>
              {preview && (
                <>
                  <div className="flex gap-1">
                    {['pt', 'en'].map(l => (
                      <button key={l} type="button" aria-pressed={previewLang === l} onClick={() => setPreviewLang(l)}
                        className={pilulaLingua(previewLang === l)}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <EmailPreview subject={previewSubject} body={previewBody} isWhatsApp={!hasEmail} />
                </>
              )}
            </div>
          ) : (
            /* Editing */
            <div className="space-y-4">
              {/* Variables */}
              <div>
                <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">{t('automations.variablesHint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARS.map(v => (
                    <button key={v.key} type="button" onClick={() => insertVar(v.key)} title={t(`automations.vars.${v.id}`)}
                      className={`text-xs font-mono px-2.5 min-h-11 md:min-h-8 rounded-full bg-white text-ocean-700 border border-mare-card hover:bg-ocean-50 transition-colors ${FOCO}`}>
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>

              {hasEmail && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label={t('automations.subjectPt')} aria-label={t('automations.subjectPt')} value={form.subject_pt} onChange={e => setForm(p => ({ ...p, subject_pt: e.target.value }))} />
                  <Input label={t('automations.subjectEn')} aria-label={t('automations.subjectEn')} value={form.subject_en} onChange={e => setForm(p => ({ ...p, subject_en: e.target.value }))} />
                </div>
              )}
              <Textarea label={t('automations.messagePt')} aria-label={t('automations.messagePt')} value={form.message_pt} rows={5} onChange={e => setForm(p => ({ ...p, message_pt: e.target.value }))} />
              <Textarea label={t('automations.messageEn')} aria-label={t('automations.messageEn')} value={form.message_en} rows={5} onChange={e => setForm(p => ({ ...p, message_en: e.target.value }))} />

              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setPreview(p => !p)}
                  className={`text-xs font-body text-ocean-700 hover:underline flex items-center gap-1 min-h-11 md:min-h-0 rounded-sm ${FOCO}`}>
                  <Eye size={12} strokeWidth={1.75} />
                  {preview ? t('automations.hidePreview') : t('automations.viewPreview')}
                </button>
                {preview && (
                  <div className="flex gap-1">
                    {['pt', 'en'].map(l => (
                      <button key={l} type="button" aria-pressed={previewLang === l} onClick={() => setPreviewLang(l)}
                        className={pilulaLingua(previewLang === l)}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {preview && <EmailPreview subject={previewSubject} body={previewBody} isWhatsApp={!hasEmail} />}

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" icon={XIcon}
                  onClick={() => { setEditing(false); setPreview(false); }} className="flex-1">
                  {t('common.cancel')}
                </Button>
                <Button icon={Save} loading={saving} onClick={handleSave} className="flex-1">
                  {t('automations.saveTemplate')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ── LogsTab ── */
const STATUS_BADGE = { sent: 'confirmed', failed: 'cancelled', pending: 'pending' };

function colunasHistorico(t) {
  return [
    {
      key: 'created_at', label: t('automations.logs.date'),
      render: l => (
        <span className={`text-xs ${NUM} text-n-600 whitespace-nowrap`}>
          {l.created_at ? formatarData(new Date(l.created_at), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'automation', label: t('automations.logs.automation'),
      render: l => <span className="font-body text-n-700 block max-w-[180px] truncate">{l.automation_name || l.automation?.name || '—'}</span>,
    },
    {
      key: 'customer', label: t('automations.logs.customer'),
      render: l => <span className="font-body text-n-800 whitespace-nowrap">{l.recipient_name || l.customer_name || '—'}</span>,
    },
    {
      key: 'channel', label: t('automations.logs.channel'),
      render: l => (
        <span className="flex items-center gap-1 text-xs font-body text-n-700">
          {l.channel === 'email'
            ? <Mail size={11} strokeWidth={1.75} />
            : <MessageCircle size={11} strokeWidth={1.75} />}
          {l.channel === 'email' ? 'Email' : 'WhatsApp'}
        </span>
      ),
    },
    {
      key: 'status', label: t('automations.logs.status'),
      render: l => (
        <Badge variant={STATUS_BADGE[l.status] || 'default'}>
          {l.status === 'sent' ? t('automations.logs.sent') : l.status === 'failed' ? t('automations.logs.failed') : l.status || '—'}
        </Badge>
      ),
    },
  ];
}

function LogsTab({ logs, loading }) {
  const t = useT();
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  if (!logs || logs.length === 0) {
    return (
      <section className={`${CARTAO} p-[22px]`}>
        <EmptyState
          icon={History}
          title={t('automations.logs.emptyTitle')}
          description={t('automations.logs.emptyDescription')}
        />
      </section>
    );
  }

  return (
    <section className={`${CARTAO} p-[22px]`}>
      <Table columns={colunasHistorico(t)} rows={logs.slice(0, 100)} />
      {logs.length > 100 && (
        <p className="text-xs font-body text-n-600 text-center pt-3">{t('automations.logs.showing', { shown: 100, total: logs.length })}</p>
      )}
    </section>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Automations() {
  const t = useT();
  const [activeTab,    setActiveTab]    = useState('sequencias');
  const [automations,  setAutomations]  = useState([]);
  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingLogs,  setLoadingLogs]  = useState(false);
  const [logsLoaded,   setLogsLoaded]   = useState(false);

  useEffect(() => {
    listAutomations()
      .then(d => setAutomations(d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'historico' && !logsLoaded) {
      setLoadingLogs(true);
      getLogsAll()
        .then(d => { setLogs(d || []); setLogsLoaded(true); })
        .catch(() => setLogsLoaded(true))
        .finally(() => setLoadingLogs(false));
    }
  }, [activeTab, logsLoaded]);

  function handleSaved(automation, isNew) {
    setAutomations(prev =>
      isNew ? [...prev, automation] : prev.map(a => a.id === automation.id ? automation : a),
    );
  }

  const activeCount = automations.filter(a => a.active).length;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.crescimento')}
        title={t('automations.title')}
        subtitle={t('automations.activeCount', { count: activeCount })}
      />

      {/* Info */}
      <div className="bg-mare-head rounded-[14px] px-4 py-3 mb-5">
        <p className="text-xs font-body text-ocean-800">
          <span className="font-semibold">{t('automations.varsAvailable')}</span>{' '}
          <span className="font-mono break-words">{VARS.map(v => v.key).join(' · ')}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5">
        <Tabs
          tabs={[{ id: 'sequencias', label: t('automations.tabs.sequences') }, { id: 'historico', label: t('automations.tabs.history') }]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'sequencias' && (
        loading ? (
          <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
        ) : (
          <div className="space-y-3">
            {SEQUENCES.map(seq => (
              <SequenceCard
                key={seq.id}
                seq={seq}
                automation={findAutomation(automations, seq)}
                onSaved={handleSaved}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'historico' && (
        <LogsTab logs={logs} loading={loadingLogs} />
      )}
    </div>
  );
}

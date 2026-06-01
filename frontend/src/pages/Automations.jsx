import { useState, useEffect } from 'react';
import {
  Mail, MessageCircle, Calendar, Star, Gift, Newspaper,
  ChevronDown, ChevronUp, Eye, Edit2, Save, X as XIcon,
  History, Zap, Check,
} from 'lucide-react';
import {
  listAutomations, createAutomation, updateAutomation,
  toggleAutomation, getLogsAll,
} from '../services/automationsService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input, { Textarea } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── Sequence definitions ── */
const SEQUENCES = [
  {
    id: 'booking_email',
    trigger_type: 'booking_confirmed', trigger_days: null, channel: 'email',
    title: 'Nova reserva — Email de confirmacao',
    subtitle: 'Email imediato ao cliente apos confirmacao',
    Icon: Mail, iconColor: 'text-ocean-700', iconBg: 'bg-ocean-50',
    defaults: {
      name: 'Confirmacao de reserva',
      subject_pt: 'A sua reserva foi confirmada — {nome_tour}',
      subject_en: 'Your booking is confirmed — {nome_tour}',
      message_pt: 'Ola {nome_cliente},\n\nA sua reserva de {nome_tour} em {data} as {hora} foi confirmada.\n\nPonto de encontro: {ponto_encontro}\nGuia: {guia}\n\nLembre-se de trazer protector solar e vestuario confortavel.\n\nObrigado por escolher a nossa empresa!',
      message_en: 'Hello {nome_cliente},\n\nYour {nome_tour} booking for {data} at {hora} is confirmed.\n\nMeeting point: {ponto_encontro}\nGuide: {guia}\n\nRemember to bring sunscreen and comfortable clothing.\n\nThank you for choosing us!',
    },
  },
  {
    id: 'booking_whatsapp',
    trigger_type: 'booking_confirmed', trigger_days: null, channel: 'whatsapp',
    title: 'Nova reserva — WhatsApp de boas-vindas',
    subtitle: 'Mensagem imediata ao cliente via WhatsApp',
    Icon: MessageCircle, iconColor: 'text-[#25D366]', iconBg: 'bg-[#F0FFF4]',
    defaults: {
      name: 'Boas-vindas WhatsApp',
      subject_pt: '', subject_en: '',
      message_pt: 'Ola {nome_cliente}! Confirmamos a sua reserva de *{nome_tour}* em {data} as {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Qualquer questao, estamos disponiveis!',
      message_en: 'Hello {nome_cliente}! Your *{nome_tour}* booking for {data} at {hora} is confirmed. Meeting point: {ponto_encontro}. Guide: {guia}. Contact us for any questions!',
    },
  },
  {
    id: 'd7_email',
    trigger_type: 'days_before_checkin', trigger_days: 7, channel: 'email',
    title: 'D-7 — Email de preparacao',
    subtitle: '7 dias antes do tour',
    Icon: Calendar, iconColor: 'text-ocean-500', iconBg: 'bg-ocean-50',
    defaults: {
      name: 'Lembrete 7 dias',
      subject_pt: 'O seu tour e em 7 dias — {nome_tour}',
      subject_en: 'Your tour is in 7 days — {nome_tour}',
      message_pt: 'Ola {nome_cliente},\n\nO seu tour {nome_tour} e em 7 dias, em {data} as {hora}.\n\nPonto de encontro: {ponto_encontro}\nGuia: {guia}\n\nO que trazer:\n- Vestuario confortavel\n- Protector solar e oculos de sol\n- Agua e snack leve\n- Documento de identidade\n\nAte breve!',
      message_en: 'Hello {nome_cliente},\n\nYour {nome_tour} tour is in 7 days, on {data} at {hora}.\n\nMeeting point: {ponto_encontro}\nGuide: {guia}\n\nWhat to bring:\n- Comfortable clothing\n- Sunscreen and sunglasses\n- Water and light snack\n- ID document\n\nSee you soon!',
    },
  },
  {
    id: 'd3_email',
    trigger_type: 'days_before_checkin', trigger_days: 3, channel: 'email',
    title: 'D-3 — Email com instrucoes',
    subtitle: '3 dias antes do tour',
    Icon: Calendar, iconColor: 'text-sand-500', iconBg: 'bg-[#FFF7E6]',
    defaults: {
      name: 'Instrucoes D-3',
      subject_pt: 'Instrucoes finais para o seu tour — {nome_tour}',
      subject_en: 'Final instructions for your tour — {nome_tour}',
      message_pt: 'Ola {nome_cliente},\n\nO seu tour {nome_tour} e em apenas 3 dias!\n\n- Data: {data} as {hora}\n- Ponto de encontro: {ponto_encontro}\n- Guia: {guia}\n\nEm caso de cancelamento por mau tempo, entraremos em contacto com 24h de antecedencia.\n\nAte breve!',
      message_en: 'Hello {nome_cliente},\n\nYour {nome_tour} tour is in just 3 days!\n\n- Date: {data} at {hora}\n- Meeting point: {ponto_encontro}\n- Guide: {guia}\n\nIn case of cancellation due to bad weather, we will contact you 24h in advance.\n\nSee you soon!',
    },
  },
  {
    id: 'd1_whatsapp',
    trigger_type: 'days_before_checkin', trigger_days: 1, channel: 'whatsapp',
    title: 'D-1 — WhatsApp de lembrete',
    subtitle: 'Mensagem um dia antes do tour',
    Icon: MessageCircle, iconColor: 'text-[#25D366]', iconBg: 'bg-[#F0FFF4]',
    defaults: {
      name: 'Lembrete D-1',
      subject_pt: '', subject_en: '',
      message_pt: 'Ola {nome_cliente}! Lembrete: o seu tour *{nome_tour}* e amanha em {data} as {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Ate amanha!',
      message_en: 'Hello {nome_cliente}! Reminder: your *{nome_tour}* tour is tomorrow {data} at {hora}. Meeting point: {ponto_encontro}. Guide: {guia}. See you tomorrow!',
    },
  },
  {
    id: 'post1_review',
    trigger_type: 'days_after_checkout', trigger_days: 1, channel: 'email',
    title: 'D+1 — Pedido de avaliacao',
    subtitle: '1 dia apos o tour',
    Icon: Star, iconColor: 'text-sand-500', iconBg: 'bg-[#FFF7E6]',
    defaults: {
      name: 'Pedido de avaliacao',
      subject_pt: 'Como correu o seu tour? — {nome_tour}',
      subject_en: 'How was your tour? — {nome_tour}',
      message_pt: 'Ola {nome_cliente},\n\nEsperamos que tenha tido uma experiencia incrivel no tour {nome_tour}!\n\nA sua opiniao e muito importante para nos. Clique no link abaixo para deixar a sua avaliacao:\n\n→ Avaliar o meu tour\n\nObrigado pela sua confianca!',
      message_en: 'Hello {nome_cliente},\n\nWe hope you had an amazing experience on the {nome_tour} tour!\n\nYour feedback means the world to us. Click the link below to leave your review:\n\n→ Rate my tour\n\nThank you for your trust!',
    },
  },
  {
    id: 'post7_discount',
    trigger_type: 'days_after_checkout', trigger_days: 7, channel: 'email',
    title: 'D+7 — Desconto proxima reserva',
    subtitle: '7 dias apos o tour',
    Icon: Gift, iconColor: 'text-[#1A7A4A]', iconBg: 'bg-[#ECFDF5]',
    defaults: {
      name: 'Desconto fidelidade D+7',
      subject_pt: 'Um presente especial para si — {nome_tour}',
      subject_en: 'A special gift for you',
      message_pt: 'Ola {nome_cliente},\n\nObrigado por ter escolhido o tour {nome_tour}!\n\nComo agradecimento, temos um desconto especial de 10% para a sua proxima reserva. Use o codigo: VOLTA10\n\nValido por 30 dias. Reserve em: saldesk.cv\n\nEsperamos ve-lo em breve!',
      message_en: 'Hello {nome_cliente},\n\nThank you for joining the {nome_tour} tour!\n\nAs a thank you, we have a special 10% discount for your next booking. Use code: BACK10\n\nValid for 30 days. Book at: saldesk.cv\n\nWe hope to see you soon!',
    },
  },
  {
    id: 'post30_newsletter',
    trigger_type: 'days_after_checkout', trigger_days: 30, channel: 'email',
    title: 'D+30 — Newsletter de novos tours',
    subtitle: '30 dias apos o tour',
    Icon: Newspaper, iconColor: 'text-n-600', iconBg: 'bg-n-100',
    defaults: {
      name: 'Newsletter D+30',
      subject_pt: 'Novidades e novos tours para si',
      subject_en: 'New tours and updates for you',
      message_pt: 'Ola {nome_cliente},\n\nJa passou um mes desde o seu tour {nome_tour}! Temos novidades incriveis:\n\n- Novos tours disponiveis para esta epoca\n- Pacotes especiais de fim de semana\n- Experiencias exclusivas na Ilha do Sal\n\nVeja todas as novidades e reserve em: saldesk.cv\n\nAte breve!',
      message_en: 'Hello {nome_cliente},\n\nA month has passed since your {nome_tour} tour! We have amazing news:\n\n- New tours available this season\n- Special weekend packages\n- Exclusive experiences on Sal Island\n\nCheck out everything at: saldesk.cv\n\nSee you soon!',
    },
  },
];

const VARS = [
  { key: '{nome_cliente}', desc: 'Nome do cliente' },
  { key: '{nome_tour}',    desc: 'Nome do tour/servico' },
  { key: '{data}',         desc: 'Data do tour' },
  { key: '{hora}',         desc: 'Hora do tour' },
  { key: '{guia}',         desc: 'Nome do guia atribuido' },
  { key: '{ponto_encontro}', desc: 'Ponto de encontro' },
];

const DEMO = {
  '{nome_cliente}': 'Maria Santos',
  '{nome_tour}':    'Kitesurf Lesson',
  '{data}':         '15 Jun 2025',
  '{hora}':         '09h00',
  '{guia}':         'Joao Silva',
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
  const pb = interpolate(body);
  const ps = interpolate(subject);

  if (isWhatsApp) {
    return (
      <div className="border border-n-200 rounded-md overflow-hidden">
        <div className="bg-[#128C7E] px-3 py-2 flex items-center gap-2">
          <MessageCircle size={13} strokeWidth={1.75} className="text-white shrink-0" />
          <p className="text-white text-xs font-body font-semibold">WhatsApp Preview</p>
        </div>
        <div className="bg-[#ECE5DD] p-3">
          <div className="bg-white rounded-lg px-3 py-2 max-w-xs shadow-sm">
            <pre className="text-xs font-body text-n-800 whitespace-pre-wrap leading-relaxed">{pb || '(sem conteudo)'}</pre>
            <p className="text-[10px] font-mono text-n-400 text-right mt-1">09:00</p>
          </div>
        </div>
        <div className="bg-n-50 px-3 py-1.5 border-t border-n-100">
          <p className="text-[10px] font-mono text-n-400">Preview com dados de exemplo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-n-200 rounded-md overflow-hidden">
      <div className="bg-ocean-900 px-4 py-2.5">
        <p className="text-white text-[11px] font-display font-semibold">SalDesk Tours</p>
        {ps && <p className="text-ocean-300 text-[11px] font-mono mt-0.5">Assunto: {ps}</p>}
      </div>
      <div className="bg-white px-5 py-4">
        <pre className="text-xs font-body text-n-700 whitespace-pre-wrap leading-relaxed">{pb || '(sem conteudo)'}</pre>
      </div>
      <div className="bg-n-50 px-4 py-2 border-t border-n-100">
        <p className="text-[10px] font-mono text-n-400">Preview com dados de exemplo. Variaveis substituidas no envio real.</p>
      </div>
    </div>
  );
}

/* ── SequenceCard ── */
function SequenceCard({ seq, automation, onSaved }) {
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

  const previewSubject = previewLang === 'en' ? form.subject_en : form.subject_pt;
  const previewBody    = previewLang === 'en' ? form.message_en : form.message_pt;

  return (
    <div className={`bg-white rounded-md border overflow-hidden transition-opacity ${isActive ? 'border-n-200' : 'border-n-100 opacity-70'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
        onClick={() => { setOpen(p => !p); setEditing(false); setPreview(false); }}
      >
        <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${seq.iconBg}`}>
          <seq.Icon size={16} strokeWidth={1.75} className={seq.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-n-900 truncate">{seq.title}</p>
          <p className="text-xs font-body text-n-500">{seq.subtitle}</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-n-500 bg-n-100 px-2 py-0.5 rounded-xs shrink-0">
          {hasEmail
            ? <Mail size={10} strokeWidth={1.75} />
            : <MessageCircle size={10} strokeWidth={1.75} />}
          {hasEmail ? 'Email' : 'WhatsApp'}
        </span>
        <button
          onClick={handleToggle}
          disabled={toggling}
          aria-label={isActive ? 'Desactivar' : 'Activar'}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${toggling ? 'opacity-50' : ''} ${isActive ? 'bg-ocean-700' : 'bg-n-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        {open
          ? <ChevronUp size={15} strokeWidth={1.75} className="text-n-400 shrink-0" />
          : <ChevronDown size={15} strokeWidth={1.75} className="text-n-400 shrink-0" />}
      </div>

      {/* Expanded */}
      {open && (
        <div className="border-t border-n-100 px-4 py-4 space-y-4 bg-n-50">
          {!editing ? (
            /* Read-only */
            <div className="space-y-3">
              {hasEmail && form.subject_pt && (
                <div className="bg-white border border-n-200 rounded-sm px-3 py-2">
                  <p className="text-[10px] font-mono text-n-400 mb-0.5 uppercase tracking-wide">Assunto PT</p>
                  <p className="text-xs font-body text-n-700 truncate">{form.subject_pt}</p>
                </div>
              )}
              <div className="bg-white border border-n-200 rounded-sm px-3 py-2">
                <p className="text-[10px] font-mono text-n-400 mb-0.5 uppercase tracking-wide">Mensagem PT</p>
                <p className="text-xs font-body text-n-600 whitespace-pre-wrap line-clamp-3">{form.message_pt}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={Edit2} onClick={e => { e.stopPropagation(); setEditing(true); }}>
                  Editar template
                </Button>
                <Button variant="secondary" size="sm" icon={Eye} onClick={e => { e.stopPropagation(); setPreview(p => !p); }}>
                  {preview ? 'Ocultar' : 'Preview'}
                </Button>
              </div>
              {preview && (
                <>
                  <div className="flex gap-1">
                    {['pt', 'en'].map(l => (
                      <button key={l} onClick={() => setPreviewLang(l)}
                        className={`text-xs px-2.5 py-1 rounded-xs font-mono transition-colors ${previewLang === l ? 'bg-ocean-700 text-white' : 'bg-n-200 text-n-600 hover:bg-n-300'}`}>
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
                <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">Variaveis — clique para inserir no corpo PT</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARS.map(v => (
                    <button key={v.key} type="button" onClick={() => insertVar(v.key)} title={v.desc}
                      className="text-xs font-mono px-2 py-0.5 rounded-xs bg-ocean-50 text-ocean-700 border border-ocean-100 hover:bg-ocean-100 transition-colors">
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>

              {hasEmail && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Assunto PT" value={form.subject_pt} onChange={e => setForm(p => ({ ...p, subject_pt: e.target.value }))} />
                  <Input label="Assunto EN" value={form.subject_en} onChange={e => setForm(p => ({ ...p, subject_en: e.target.value }))} />
                </div>
              )}
              <Textarea label="Mensagem PT" value={form.message_pt} rows={5} onChange={e => setForm(p => ({ ...p, message_pt: e.target.value }))} />
              <Textarea label="Mensagem EN" value={form.message_en} rows={5} onChange={e => setForm(p => ({ ...p, message_en: e.target.value }))} />

              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setPreview(p => !p)}
                  className="text-xs font-body text-ocean-700 hover:underline flex items-center gap-1">
                  <Eye size={12} strokeWidth={1.75} />
                  {preview ? 'Ocultar preview' : 'Ver preview'}
                </button>
                {preview && (
                  <div className="flex gap-1">
                    {['pt', 'en'].map(l => (
                      <button key={l} onClick={() => setPreviewLang(l)}
                        className={`text-xs px-2.5 py-1 rounded-xs font-mono transition-colors ${previewLang === l ? 'bg-ocean-700 text-white' : 'bg-n-200 text-n-600'}`}>
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
                  Cancelar
                </Button>
                <Button icon={Save} loading={saving} onClick={handleSave} className="flex-1">
                  Guardar template
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── LogsTab ── */
function LogsTab({ logs, loading }) {
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <History size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
          <p className="font-body text-n-500">Sem historico de envios.</p>
          <p className="text-xs font-body text-n-400 mt-1">Os envios aparecerao aqui apos as primeiras automacoes serem disparadas.</p>
        </div>
      </Card>
    );
  }

  const STATUS_CLS = {
    sent:    'text-[#1A7A4A] bg-[#ECFDF5]',
    failed:  'text-error bg-red-50',
    pending: 'text-yellow-700 bg-yellow-50',
  };

  return (
    <Card padding="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-n-200">
              {['Data', 'Automacao', 'Cliente', 'Canal', 'Estado'].map(h => (
                <th key={h} className="text-left py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-n-100">
            {logs.slice(0, 100).map((l, i) => (
              <tr key={l.id || i} className="hover:bg-n-50 transition-colors">
                <td className="py-2.5 px-4 text-xs font-mono text-n-500 whitespace-nowrap">
                  {l.created_at ? new Date(l.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="py-2.5 px-4 font-body text-n-700 max-w-[180px] truncate">{l.automation_name || l.automation?.name || '—'}</td>
                <td className="py-2.5 px-4 font-body text-n-800 whitespace-nowrap">{l.recipient_name || l.customer_name || '—'}</td>
                <td className="py-2.5 px-4">
                  <span className="flex items-center gap-1 text-xs font-body text-n-600">
                    {l.channel === 'email'
                      ? <Mail size={11} strokeWidth={1.75} />
                      : <MessageCircle size={11} strokeWidth={1.75} />}
                    {l.channel === 'email' ? 'Email' : 'WhatsApp'}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-xs ${STATUS_CLS[l.status] || 'text-n-500 bg-n-100'}`}>
                    {l.status === 'sent' ? 'Enviado' : l.status === 'failed' ? 'Falhou' : l.status || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length > 100 && (
          <p className="text-xs font-body text-n-400 text-center py-3">A mostrar 100 de {logs.length} registos</p>
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Automations() {
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
        title="Automacoes de Comunicacao"
        subtitle={`${activeCount} sequencia(s) activa(s)`}
      />

      {/* Info */}
      <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-4 py-3 mb-5">
        <p className="text-xs font-body text-ocean-700">
          <span className="font-semibold">Variaveis disponiveis:</span>{' '}
          {VARS.map(v => v.key).join(' · ')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-n-200 mb-5">
        {[
          { key: 'sequencias', label: 'Sequencias', Icon: Zap },
          { key: 'historico',  label: 'Historico de envios', Icon: History },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />{label}
          </button>
        ))}
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

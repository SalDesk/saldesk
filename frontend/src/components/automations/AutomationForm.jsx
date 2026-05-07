import { useState } from 'react';

const TRIGGERS = [
  { value: 'booking_confirmed',  label: 'Reserva Confirmada',             needsDays: false },
  { value: 'checkin_reminder',   label: 'Lembrete de Check-in (dia antes)',needsDays: false },
  { value: 'checkout_thanks',    label: 'Agradecimento após Check-out',   needsDays: false },
  { value: 'days_before_checkin',label: 'X dias antes do Check-in',       needsDays: true  },
  { value: 'days_after_checkout',label: 'X dias após o Check-out',        needsDays: true  }
];

const VARIAVEIS = '{{nome}}  {{unidade}}  {{check_in}}  {{check_out}}  {{total}}  {{operador}}';

const DEFAULTS = {
  booking_confirmed: {
    subject: 'Reserva confirmada / Booking confirmed',
    message_pt: 'Olá {{nome}},\n\nA sua reserva de {{unidade}} está confirmada!\n\nCheck-in: {{check_in}}\nCheck-out: {{check_out}}\nTotal: {{total}}\n\nAté breve!\n{{operador}}',
    message_en: 'Hello {{nome}},\n\nYour booking for {{unidade}} is confirmed!\n\nCheck-in: {{check_in}}\nCheck-out: {{check_out}}\nTotal: {{total}}\n\nSee you soon!\n{{operador}}'
  },
  checkin_reminder: {
    subject: 'O seu check-in é amanhã / Your check-in is tomorrow',
    message_pt: 'Olá {{nome}},\n\nLembrete: o seu check-in em {{unidade}} é amanhã ({{check_in}}).\n\nAté amanhã!\n{{operador}}',
    message_en: 'Hello {{nome}},\n\nReminder: your check-in at {{unidade}} is tomorrow ({{check_in}}).\n\nSee you tomorrow!\n{{operador}}'
  },
  checkout_thanks: {
    subject: 'Obrigado pela sua visita / Thank you for your stay',
    message_pt: 'Olá {{nome}},\n\nObrigado por ter ficado connosco em {{unidade}}!\n\nEsperamos vê-lo novamente em breve.\n{{operador}}',
    message_en: 'Hello {{nome}},\n\nThank you for staying with us at {{unidade}}!\n\nWe hope to see you again soon.\n{{operador}}'
  }
};

export default function AutomationForm({ automation, onSave, onCancel, loading, erro }) {
  const [form, setForm] = useState({
    name: automation?.name || '',
    trigger_type: automation?.trigger_type || 'booking_confirmed',
    trigger_days: automation?.trigger_days || 3,
    channel: automation?.channel || 'email',
    subject: automation?.subject || DEFAULTS.booking_confirmed.subject,
    message_pt: automation?.message_pt || DEFAULTS.booking_confirmed.message_pt,
    message_en: automation?.message_en || DEFAULTS.booking_confirmed.message_en
  });

  function handleTriggerChange(trigger_type) {
    const defaults = DEFAULTS[trigger_type] || {};
    setForm({
      ...form,
      trigger_type,
      subject: defaults.subject || form.subject,
      message_pt: defaults.message_pt || form.message_pt,
      message_en: defaults.message_en || form.message_en
    });
  }

  const triggerConfig = TRIGGERS.find((t) => t.value === form.trigger_type);

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    if (!triggerConfig?.needsDays) delete payload.trigger_days;
    if (form.channel !== 'email') delete payload.subject;
    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome da automação *</label>
        <input type="text" className="input" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus
          placeholder="Ex: Email de confirmação" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Gatilho (trigger) *</label>
          <select className="input" value={form.trigger_type} onChange={(e) => handleTriggerChange(e.target.value)}>
            {TRIGGERS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Canal *</label>
          <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            <option value="email">✉️ Email</option>
            <option value="whatsapp">💬 WhatsApp</option>
          </select>
        </div>
      </div>

      {triggerConfig?.needsDays && (
        <div>
          <label className="label">Número de dias *</label>
          <input type="number" className="input" value={form.trigger_days} min={1} max={30}
            onChange={(e) => setForm({ ...form, trigger_days: Number(e.target.value) })} required />
        </div>
      )}

      {form.channel === 'email' && (
        <div>
          <label className="label">Assunto do email *</label>
          <input type="text" className="input" value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        </div>
      )}

      <div>
        <label className="label">Mensagem em Português *</label>
        <textarea className="input resize-none font-mono text-xs" rows={5} value={form.message_pt}
          onChange={(e) => setForm({ ...form, message_pt: e.target.value })} required />
      </div>

      <div>
        <label className="label">Mensagem em Inglês *</label>
        <textarea className="input resize-none font-mono text-xs" rows={5} value={form.message_en}
          onChange={(e) => setForm({ ...form, message_en: e.target.value })} required />
      </div>

      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
        <p className="font-medium mb-1">Variáveis disponíveis:</p>
        <code className="text-blue-600 tracking-wide">{VARIAVEIS}</code>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'A guardar...' : automation ? 'Guardar' : 'Criar automação'}
        </button>
      </div>
    </form>
  );
}

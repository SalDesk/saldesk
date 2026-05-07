import { useState } from 'react';
import { useT } from '../../i18n';
import Input, { Textarea, Select } from '../ui/Input';
import Button from '../ui/Button';

const TRIGGERS = [
  { value: 'booking_confirmed',   label: 'Confirmacao de reserva',     hasDays: false },
  { value: 'checkin_reminder',    label: 'Lembrete de check-in',        hasDays: false },
  { value: 'checkout_thanks',     label: 'Agradecimento pos checkout',  hasDays: false },
  { value: 'days_before_checkin', label: 'X dias antes do check-in',    hasDays: true  },
  { value: 'days_after_checkout', label: 'X dias apos o checkout',      hasDays: true  },
];

const CHANNELS = [
  { value: 'email',    label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const VARS = ['{{nome}}', '{{unidade}}', '{{check_in}}', '{{check_out}}', '{{total}}', '{{operador}}'];

export default function AutomationForm({ automation, onSave, onCancel, loading, error }) {
  const t = useT();
  const [form, setForm] = useState({
    name:         automation?.name || '',
    trigger_type: automation?.trigger_type || 'booking_confirmed',
    trigger_days: automation?.trigger_days || '',
    channel:      automation?.channel || 'email',
    subject:      automation?.subject || '',
    message_pt:   automation?.message_pt || '',
    message_en:   automation?.message_en || '',
  });

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const trigger = TRIGGERS.find((t) => t.value === form.trigger_type);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      trigger_days: trigger?.hasDays ? Number(form.trigger_days) : null,
    });
  }

  function insertVar(variable, field) {
    setForm((prev) => ({ ...prev, [field]: prev[field] + variable }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nome da automacao" value={form.name} onChange={set('name')} required placeholder="Ex: Confirmacao de reserva" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Trigger" value={form.trigger_type} onChange={set('trigger_type')} required>
          {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Select label="Canal" value={form.channel} onChange={set('channel')} required>
          {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </div>

      {trigger?.hasDays && (
        <Input
          label="Numero de dias"
          type="number"
          value={form.trigger_days}
          onChange={set('trigger_days')}
          min="1"
          required
          hint={form.trigger_type === 'days_before_checkin' ? 'Dias antes do check-in' : 'Dias apos o checkout'}
        />
      )}

      {form.channel === 'email' && (
        <Input label="Assunto do email" value={form.subject} onChange={set('subject')} required placeholder="Ex: A sua reserva foi confirmada" />
      )}

      {/* Variaveis disponiveis */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">Variaveis disponiveis</p>
        <div className="flex flex-wrap gap-1.5">
          {VARS.map((v) => (
            <button
              key={v}
              type="button"
              className="text-xs font-mono px-2 py-0.5 rounded-xs bg-ocean-50 text-ocean-700 border border-ocean-100 hover:bg-ocean-100 transition-colors"
              onClick={() => {}}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="text-xs font-body text-n-400 mt-1">Clique numa variavel para a copiar e use nas mensagens abaixo</p>
      </div>

      <Textarea
        label="Mensagem em Portugues"
        value={form.message_pt}
        onChange={set('message_pt')}
        required
        rows={4}
        placeholder={`Ola {{nome}},\n\nA sua reserva em {{unidade}} esta confirmada.\n\nCheck-in: {{check_in}}\nCheck-out: {{check_out}}\n\nObrigado!`}
      />

      <Textarea
        label="Mensagem em Ingles"
        value={form.message_en}
        onChange={set('message_en')}
        required
        rows={4}
        placeholder={`Hello {{nome}},\n\nYour reservation at {{unidade}} is confirmed.\n\nCheck-in: {{check_in}}\nCheck-out: {{check_out}}\n\nThank you!`}
      />

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {automation ? t('common.save') : 'Criar automacao'}
        </Button>
      </div>
    </form>
  );
}

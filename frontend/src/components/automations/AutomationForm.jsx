import { useState } from 'react';
import { useT } from '../../i18n';
import Input, { Textarea, Select } from '../ui/Input';
import Button from '../ui/Button';
import { rotuloGatilhoOpcao, rotuloCanal, gatilhoTemDias } from './rotulosAutomacoes';

/* valores gravados; o rotulo vem de rotulosAutomacoes */
const TRIGGERS = ['booking_confirmed', 'checkin_reminder', 'checkout_thanks', 'days_before_checkin', 'days_after_checkout'];

const CHANNELS = ['email', 'whatsapp'];

/* exemplo de assunto de email ao cliente: texto do cliente, fica em portugues em qualquer lingua do painel */
const EXEMPLO_ASSUNTO_CLIENTE = 'Ex: A sua reserva foi confirmada';

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
  const temDias = gatilhoTemDias(form.trigger_type);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      trigger_days: temDias ? Number(form.trigger_days) : null,
    });
  }

  function insertVar(variable, field) {
    setForm((prev) => ({ ...prev, [field]: prev[field] + variable }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label={t('automations.form.name')} value={form.name} onChange={set('name')} required placeholder={t('automations.form.namePlaceholder')} />

      <div className="grid grid-cols-2 gap-3">
        <Select label={t('automations.form.trigger')} value={form.trigger_type} onChange={set('trigger_type')} required>
          {TRIGGERS.map((g) => <option key={g} value={g}>{rotuloGatilhoOpcao(g, t)}</option>)}
        </Select>
        <Select label={t('automations.form.channel')} value={form.channel} onChange={set('channel')} required>
          {CHANNELS.map((c) => <option key={c} value={c}>{rotuloCanal(c)}</option>)}
        </Select>
      </div>

      {temDias && (
        <Input
          label={t('automations.form.days')}
          type="number"
          value={form.trigger_days}
          onChange={set('trigger_days')}
          min="1"
          required
          hint={form.trigger_type === 'days_before_checkin' ? t('automations.form.daysBefore') : t('automations.form.daysAfter')}
        />
      )}

      {form.channel === 'email' && (
        <Input label={t('automations.form.subject')} value={form.subject} onChange={set('subject')} required placeholder={EXEMPLO_ASSUNTO_CLIENTE} />
      )}

      {/* Variaveis disponiveis */}
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">{t('automations.form.varsTitle')}</p>
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
        <p className="text-xs font-body text-n-400 mt-1">{t('automations.form.varsHint')}</p>
      </div>

      <Textarea
        label={t('automations.form.messagePt')}
        value={form.message_pt}
        onChange={set('message_pt')}
        required
        rows={4}
        placeholder={`Olá {{nome}},\n\nA sua reserva em {{unidade}} está confirmada.\n\nCheck-in: {{check_in}}\nCheck-out: {{check_out}}\n\nObrigado!`}
      />

      <Textarea
        label={t('automations.form.messageEn')}
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
          {automation ? t('common.save') : t('automations.form.create')}
        </Button>
      </div>
    </form>
  );
}

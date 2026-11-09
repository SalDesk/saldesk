import { useState } from 'react';
import { updateOperator } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import { SaveBanner } from './shared';

/* ─────────────────────────────────────────────────────────
   TAB 4 — NOTIFICACOES
───────────────────────────────────────────────────────── */
const NOTIF_ITEMS = [
  { key: 'new_booking',       label: 'Nova reserva',             hint: 'Alertar imediatamente quando uma nova reserva for criada' },
  { key: 'cancellation',      label: 'Cancelamento',             hint: 'Notificar quando uma reserva for cancelada' },
  { key: 'payment_confirmed', label: 'Pagamento confirmado',     hint: 'Confirmacao de pagamento online recebido' },
  { key: 'review_received',   label: 'Nova avaliacao',           hint: 'Quando um cliente submete uma avaliacao' },
  { key: 'new_message',       label: 'Mensagem interna',         hint: 'Mensagem de um colaborador no chat interno' },
  { key: 'checkin_reminder',  label: 'Lembrete de check-in',     hint: 'Lembrete 24h antes do check-in do cliente' },
];

export default function NotificacoesTab() {
  const { operator, setOperator } = useAuthStore();
  const [prefs, setPrefs] = useState(() => ({
    new_booking:       true,
    cancellation:      true,
    payment_confirmed: true,
    review_received:   true,
    new_message:       true,
    checkin_reminder:  false,
    ...operator?.notification_prefs,
  }));
  const [channel, setChannel] = useState(operator?.notif_channel || 'both');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const updated = await updateOperator({ notification_prefs: prefs, notif_channel: channel });
      setOperator(updated);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Canal de notificacoes</h3>}>
        <div className="grid grid-cols-3 gap-2">
          {[['email', 'Email'], ['push', 'Push (PWA)'], ['both', 'Ambos']].map(([v, l]) => (
            <label key={v} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded border cursor-pointer text-sm font-body transition-colors ${channel === v ? 'bg-ocean-700 text-white border-ocean-700' : 'bg-n-50 text-n-700 border-n-200 hover:border-n-300'}`}>
              <input type="radio" value={v} checked={channel === v} onChange={() => setChannel(v)} className="hidden" />
              {l}
            </label>
          ))}
        </div>
      </Card>

      <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Tipos de notificacao</h3>}>
        <div>
          {NOTIF_ITEMS.map(item => (
            <Toggle key={item.key} checked={prefs[item.key]} onChange={v => setPrefs(p => ({ ...p, [item.key]: v }))}
              label={item.label} hint={item.hint} />
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>Guardar preferencias</Button>
        <SaveBanner saved={saved} />
      </div>
    </form>
  );
}

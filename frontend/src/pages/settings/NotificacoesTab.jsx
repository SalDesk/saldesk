import { useState, useRef } from 'react';
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

const CANAIS = [['email', 'Email'], ['push', 'Push (PWA)'], ['both', 'Ambos']];

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
  const radiosRef = useRef([]);

  /* Grupo de radio com teclado: setas (e Home/End) marcam e focam o canal vizinho, com volta ao fim/principio */
  function aoCarregarTecla(e, indice) {
    const ultimo = CANAIS.length - 1;
    let destino = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') destino = indice === ultimo ? 0 : indice + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') destino = indice === 0 ? ultimo : indice - 1;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = ultimo;
    if (destino === null) return;
    e.preventDefault();
    setChannel(CANAIS[destino][0]);
    radiosRef.current[destino]?.focus();
  }

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
        <div role="radiogroup" aria-label="Canal de notificacoes" className="grid grid-cols-3 gap-2">
          {CANAIS.map(([v, l], i) => (
            <button key={v} type="button" role="radio" aria-checked={channel === v} onClick={() => setChannel(v)}
              ref={el => { radiosRef.current[i] = el; }} tabIndex={channel === v ? 0 : -1} onKeyDown={e => aoCarregarTecla(e, i)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded border cursor-pointer text-sm font-body transition-colors ${channel === v ? 'bg-ocean-700 text-white border-ocean-700' : 'bg-n-50 text-n-700 border-n-200 hover:border-n-300'}`}>
              {l}
            </button>
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

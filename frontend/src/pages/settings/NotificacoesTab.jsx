import { useState, useRef } from 'react';
import { updateOperator } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import { SaveBanner, CARTAO, TITULO } from './shared';
import { useT } from '../../i18n';

/* ─────────────────────────────────────────────────────────
   TAB 4 — NOTIFICACOES
───────────────────────────────────────────────────────── */
/* rotulo e dica de cada tipo: settings.notificacoes.items.<key>.label / .hint */
const NOTIF_ITEMS = ['new_booking', 'cancellation', 'payment_confirmed', 'review_received', 'new_message', 'checkin_reminder'];

/* rotulo de cada canal: settings.notificacoes.channels.<valor> */
const CANAIS = ['email', 'push', 'both'];

export default function NotificacoesTab() {
  const t = useT();
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
    setChannel(CANAIS[destino]);
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
      <section className={CARTAO}>
        <h2 className={`${TITULO} mb-4`}>{t('settings.notificacoes.channelTitle')}</h2>
        <div role="radiogroup" aria-label={t('settings.notificacoes.channelTitle')} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CANAIS.map((v, i) => (
            <button key={v} type="button" role="radio" aria-checked={channel === v} onClick={() => setChannel(v)}
              ref={el => { radiosRef.current[i] = el; }} tabIndex={channel === v ? 0 : -1} onKeyDown={e => aoCarregarTecla(e, i)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 min-h-11 md:min-h-0 rounded-[14px] border cursor-pointer text-sm font-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500 ${channel === v ? 'bg-ocean-700 text-white border-ocean-700' : 'bg-white text-n-700 border-mare-field hover:border-ocean-400'}`}>
              {t(`settings.notificacoes.channels.${v}`)}
            </button>
          ))}
        </div>
      </section>

      <section className={CARTAO}>
        <h2 className={`${TITULO} mb-4`}>{t('settings.notificacoes.typesTitle')}</h2>
        <div>
          {NOTIF_ITEMS.map(key => (
            <Toggle key={key} checked={prefs[key]} onChange={v => setPrefs(p => ({ ...p, [key]: v }))}
              label={t(`settings.notificacoes.items.${key}.label`)} hint={t(`settings.notificacoes.items.${key}.hint`)} />
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>{t('settings.notificacoes.save')}</Button>
        <SaveBanner saved={saved} />
      </div>
    </form>
  );
}

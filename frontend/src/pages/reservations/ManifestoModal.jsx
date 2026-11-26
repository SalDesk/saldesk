import { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useT } from '../../i18n';
import { formatDate, eurosInteiros } from './shared';

/* tourIdInicial e dataInicial (opcionais) abrem o manifesto ja filtrado, por exemplo para uma saida do dia */
export default function ManifestoModal({ open, onClose, reservations, units, tourIdInicial = '', dataInicial = '' }) {
  const t = useT();
  const [tourId, setTourId] = useState(tourIdInicial);
  const [date,   setDate]   = useState(dataInicial);

  const participants = useMemo(() => {
    if (!tourId && !date) return [];
    return reservations.filter(r => {
      const matchTour = !tourId || r.unit_id === tourId;
      const matchDate = !date   || r.check_in === date;
      const active    = ['pending', 'confirmed', 'checked_in', 'checked_out'].includes(r.status);
      return matchTour && matchDate && active;
    }).sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || ''));
  }, [reservations, tourId, date]);

  const totalPax = participants.reduce((s, r) => s + (r.guests || 0), 0);
  const tourName = units.find(u => u.id === tourId)?.name || '';

  function handlePrintPdf() {
    window.print();
  }

  return (
    <Modal open={open} onClose={onClose} title={t('reservations.manifest.title')} size="xl">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Select label={t('reservations.columns.tour')} value={tourId} onChange={e => setTourId(e.target.value)}>
              <option value="">{t('reservations.filters.allTours')}</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <div className="flex-1">
            <Input label={t('common.date')} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {(tourId || date) ? (
          <>
            <div className="bg-ocean-50 border border-ocean-100 rounded-[14px] px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-sm text-ocean-900">
                  {tourName || t('reservations.filters.allTours')}{date ? ` · ${formatDate(date)}` : ''}
                </p>
                <p className="text-xs font-body text-ocean-600 mt-0.5">{t('reservations.manifest.summary', { n: participants.length, pax: totalPax })}</p>
              </div>
              {participants.length > 0 && (
                <Button variant="secondary" size="sm" icon={FileText} onClick={handlePrintPdf}>{t('reservations.manifest.export')}</Button>
              )}
            </div>

            {participants.length === 0 ? (
              <p className="text-sm font-body text-n-500 text-center py-6">{t('reservations.manifest.empty')}</p>
            ) : (
              <div className="border border-mare-card rounded-[14px] overflow-hidden overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 820 }}>
                  <thead>
                    <tr className="bg-mare-head border-b border-mare-card">
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('reservations.manifest.name')}</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('customers.phone')}</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('reservations.manifest.hotelRoom')}</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('reservations.manifest.emergency')}</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('reservations.manifest.specialReqs')}</th>
                      <th className="text-center px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('reservations.pax')}</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('common.status')}</th>
                      <th className="text-right px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('reservations.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-n-100">
                    {participants.map((r, i) => {
                      let extra = {};
                      try { extra = JSON.parse(r.notes_guest || '{}'); } catch {}
                      return (
                        <tr key={r.id} className="hover:bg-mare-head">
                          <td className="px-3 py-2.5 text-xs font-mono tabular-nums text-n-500">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-body font-medium text-sm text-n-900">{r.customer_name || '—'}</p>
                            <p className="text-xs font-body text-n-400">{r.customer_country || ''}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-body text-n-600">{r.customer_phone || extra.phone || '—'}</td>
                          <td className="px-3 py-2.5 text-xs font-body text-n-600">
                            {extra.hotel ? `${extra.hotel}${extra.room ? ` — ${extra.room}` : ''}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-body text-n-600">{extra.emergency_contact || '—'}</td>
                          <td className="px-3 py-2.5 text-xs font-body text-n-600 max-w-[120px] truncate">{extra.special_requirements || r.notes_guest || '—'}</td>
                          <td className="px-3 py-2.5 text-center font-mono tabular-nums font-medium text-sm text-n-900">{r.guests}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant={r.status}>{t(`reservations.status.${r.status}`)}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium text-sm text-ocean-900">
                            {eurosInteiros(r.total_price || r.total_amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-mare-head border-t border-mare-card">
                      <td colSpan={6} className="px-3 py-2.5 text-xs font-body font-bold text-n-700 uppercase tracking-wide">{t('reservations.total')}</td>
                      <td className="px-3 py-2.5 text-center font-mono tabular-nums font-medium text-sm text-n-900">{totalPax}</td>
                      <td />
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium text-sm text-ocean-900">
                        {eurosInteiros(participants.reduce((s, r) => s + Number(r.total_price || r.total_amount || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-body text-n-500 text-center py-6">{t('reservations.manifest.prompt')}</p>
        )}
      </div>
    </Modal>
  );
}

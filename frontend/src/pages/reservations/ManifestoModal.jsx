import { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { formatDate } from './shared';

export default function ManifestoModal({ open, onClose, reservations, units }) {
  const [tourId, setTourId] = useState('');
  const [date,   setDate]   = useState('');

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
    <Modal open={open} onClose={onClose} title="Manifesto de Participantes" size="xl">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Select label="Tour" value={tourId} onChange={e => setTourId(e.target.value)}>
              <option value="">Todos os tours</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <div className="flex-1">
            <Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {(tourId || date) ? (
          <>
            <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-sm text-ocean-900">
                  {tourName || 'Todos os tours'}{date ? ` · ${formatDate(date)}` : ''}
                </p>
                <p className="text-xs font-body text-ocean-600 mt-0.5">{participants.length} reservas · {totalPax} participantes</p>
              </div>
              {participants.length > 0 && (
                <Button variant="secondary" size="sm" icon={FileText} onClick={handlePrintPdf}>Exportar PDF</Button>
              )}
            </div>

            {participants.length === 0 ? (
              <p className="text-sm font-body text-n-500 text-center py-6">Nenhum participante encontrado.</p>
            ) : (
              <div className="border border-n-200 rounded-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 820 }}>
                  <thead>
                    <tr className="bg-n-50 border-b border-n-200">
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Nome</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Telefone</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Hotel / Quarto</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Contacto emergencia</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Req. especiais</th>
                      <th className="text-center px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Pax</th>
                      <th className="text-left px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Estado</th>
                      <th className="text-right px-3 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-n-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-n-100">
                    {participants.map((r, i) => {
                      let extra = {};
                      try { extra = JSON.parse(r.notes_guest || '{}'); } catch {}
                      return (
                        <tr key={r.id} className="hover:bg-n-50">
                          <td className="px-3 py-2.5 text-xs font-mono text-n-400">{i + 1}</td>
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
                          <td className="px-3 py-2.5 text-center font-body font-semibold text-sm text-n-900">{r.guests}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded-xs uppercase tracking-wide ${
                              ['confirmed','checked_in'].includes(r.status) ? 'bg-[#ECFDF5] text-[#1A7A4A]' : 'bg-n-100 text-n-500'
                            }`}>{r.status}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-display font-bold text-sm text-ocean-700">
                            €{Number(r.total_price || r.total_amount || 0).toFixed(0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-n-50 border-t border-n-200">
                      <td colSpan={6} className="px-3 py-2.5 text-xs font-body font-bold text-n-700 uppercase tracking-wide">Total</td>
                      <td className="px-3 py-2.5 text-center font-display font-bold text-sm text-n-900">{totalPax}</td>
                      <td />
                      <td className="px-3 py-2.5 text-right font-display font-bold text-sm text-ocean-700">
                        €{participants.reduce((s, r) => s + Number(r.total_price || r.total_amount || 0), 0).toFixed(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-body text-n-500 text-center py-6">Seleccione um tour e/ou uma data para ver o manifesto.</p>
        )}
      </div>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendar, createBlockedDates } from '../services/calendarService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import CalendarView from '../components/calendar/CalendarView';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const MESES_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function Calendar() {
  const t = useT();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [dados, setDados] = useState({ units: [], reservations: [], blocked_dates: [] });
  const [loading, setLoading] = useState(true);
  const [blockModal, setBlockModal] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  async function carregar(a, m) {
    setLoading(true);
    try {
      const start = `${a}-${String(m + 1).padStart(2, '0')}-01`;
      const end   = `${a}-${String(m + 1).padStart(2, '0')}-${new Date(a, m + 1, 0).getDate()}`;
      const data  = await getCalendar(start, end);
      setDados(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(ano, mes); }, [ano, mes]);

  function navMes(delta) {
    let nm = mes + delta, na = ano;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMes(nm); setAno(na);
  }

  function handleDayClick(date, unit, reservation) {
    if (reservation) return;
    setBlockReason('');
    setBlockModal({ date, unit });
  }

  async function handleBlock() {
    if (!blockModal) return;
    setBlockLoading(true);
    try {
      await createBlockedDates({ unit_id: blockModal.unit.id, dates: [blockModal.date], reason: blockReason || null });
      await carregar(ano, mes);
      setBlockModal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setBlockLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('nav.calendar')}
        subtitle="Clique num dia livre para bloquear"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => navMes(-1)} />
            <span className="font-display font-semibold text-sm text-n-800 min-w-[160px] text-center">
              {MESES_PT[mes]} {ano}
            </span>
            <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => navMes(1)} />
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        {[
          { label: 'Confirmada', color: 'bg-ocean-700' },
          { label: 'Pendente',   color: 'bg-sand-400' },
          { label: 'Check-in',   color: 'bg-[var(--success)]' },
          { label: 'Bloqueado',  color: 'bg-n-200' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-xs ${l.color}`} />
            <span className="text-xs font-body text-n-500">{l.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : (
        <CalendarView
          year={ano} month={mes}
          units={dados.units}
          reservations={dados.reservations}
          blockedDates={dados.blocked_dates}
          onDayClick={handleDayClick}
        />
      )}

      <Modal
        open={!!blockModal}
        onClose={() => setBlockModal(null)}
        title="Bloquear data"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockModal(null)}>{t('common.cancel')}</Button>
            <Button loading={blockLoading} onClick={handleBlock}>Bloquear</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-body text-n-700">
            <strong>{blockModal?.date}</strong> · {blockModal?.unit?.name}
          </p>
          <Input
            label="Motivo"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Manutencao, uso proprio..."
          />
        </div>
      </Modal>
    </div>
  );
}

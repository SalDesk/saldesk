import { useState, useEffect } from 'react';
import { Check, X, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const TYPE_LABELS = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function PendingCard({ unit, onApprove, onReject, approving, rejecting }) {
  return (
    <Card>
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-sm bg-n-100 overflow-hidden shrink-0 flex items-center justify-center">
          {unit.images?.[0] ? (
            <img src={unit.images[0]} alt={unit.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-body text-n-400">Sem foto</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-display font-bold text-n-900">{unit.name}</p>
              <p className="text-xs font-body text-n-500">
                {unit.operators?.name || '—'} · {TYPE_LABELS[unit.operators?.operator_type] || unit.operators?.operator_type || '—'}
              </p>
            </div>
            <Badge variant="pending">Em revisão</Badge>
          </div>
          {unit.description && (
            <p className="text-xs font-body text-n-600 mt-1.5 line-clamp-2">{unit.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs font-body text-n-400">
            <span>{unit.experience_categories?.label_pt || 'Sem categoria'}</span>
            <span>€{unit.base_price}</span>
            <span>Submetido {fmtDateTime(unit.updated_at)}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-n-100">
        <Button variant="danger" size="sm" icon={X} loading={rejecting} onClick={() => onReject(unit)}>
          Rejeitar
        </Button>
        <Button size="sm" icon={Check} loading={approving} onClick={() => onApprove(unit)}>
          Aprovar
        </Button>
      </div>
    </Card>
  );
}

export default function AdminConectModeration() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [rejecting, setRejecting] = useState(false);

  function carregar() {
    setLoading(true);
    api.get('/admin/conect/pending')
      .then(r => setPending(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  async function handleApprove(unit) {
    setBusyId(unit.id);
    try {
      await api.put(`/admin/conect/${unit.id}/approve`);
      setPending(prev => prev.filter(u => u.id !== unit.id));
    } catch (err) {
      window.alert(err?.response?.data?.error || 'Não foi possível aprovar.');
    } finally {
      setBusyId(null);
    }
  }

  function openReject(unit) {
    setRejectTarget(unit);
    setMotivo('');
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await api.put(`/admin/conect/${rejectTarget.id}/reject`, { motivo: motivo.trim() || undefined });
      setPending(prev => prev.filter(u => u.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (err) {
      window.alert(err?.response?.data?.error || 'Não foi possível rejeitar.');
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Moderação Conect"
        subtitle={`${pending.length} unidade(s) pendente(s) de aprovação`}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : pending.length === 0 ? (
        <Card>
          <p className="text-sm font-body text-n-500 text-center py-8">
            Sem submissões pendentes de momento.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map(unit => (
            <PendingCard
              key={unit.id}
              unit={unit}
              onApprove={handleApprove}
              onReject={openReject}
              approving={busyId === unit.id}
              rejecting={rejecting && rejectTarget?.id === unit.id}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={`Rejeitar submissão — ${rejectTarget?.name || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>Cancelar</Button>
            <Button variant="danger" loading={rejecting} onClick={confirmReject}>Rejeitar</Button>
          </>
        }
      >
        <Textarea
          label="Motivo (opcional, enviado ao operador por email)"
          rows={4}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ex: falta foto principal, descrição incompleta..."
        />
      </Modal>
    </div>
  );
}

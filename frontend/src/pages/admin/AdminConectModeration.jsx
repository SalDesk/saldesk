import { useState, useEffect } from 'react';
import { Check, X, ExternalLink, MapPin, Users, Clock, Eye } from 'lucide-react';
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

/* unit.description guarda metadados JSON (tour/quarto/viatura/mesa,
   ver UnitForm.jsx) -- nunca mostrar o JSON em bruto ao admin, extrair o
   texto legivel + comodidades/incluidos, mesma logica de ServiceDetail.jsx. */
function getUnitMeta(unit) {
  const raw = unit?.description;
  if (!raw?.startsWith('{')) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function getUnitDescriptionText(unit, meta) {
  if (!unit?.description) return '';
  if (unit.description.startsWith('{')) return meta.desc_pt || meta.description || '';
  return unit.description;
}

function PendingCard({ unit, onView, onApprove, onReject, approving, rejecting }) {
  const meta = getUnitMeta(unit);
  const descText = getUnitDescriptionText(unit, meta);
  return (
    <Card>
      <div className="flex gap-4 cursor-pointer" onClick={() => onView(unit)}>
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
          {descText && (
            <p className="text-xs font-body text-n-600 mt-1.5 line-clamp-2">{descText}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs font-body text-n-400">
            <span>{unit.experience_categories?.label_pt || 'Sem categoria'}</span>
            <span>€{unit.base_price}</span>
            <span>Submetido {fmtDateTime(unit.updated_at)}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-n-100">
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => onView(unit)}>
          Ver detalhes
        </Button>
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

function UnitDetailModal({ unit, onClose, onApprove, onReject, approving, rejecting }) {
  if (!unit) return null;
  const meta = getUnitMeta(unit);
  const descText = getUnitDescriptionText(unit, meta);
  const amenities = Array.isArray(meta.amenities) ? meta.amenities.filter(Boolean) : [];
  const includedItems = Array.isArray(meta.included_items) ? meta.included_items.filter(it => it?.label?.trim()) : [];
  const images = (unit.images || []).filter(Boolean);

  return (
    <Modal open={!!unit} onClose={onClose} title={unit.name} size="lg">
      <div className="space-y-5">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.slice(0, 6).map((src, i) => (
              <img key={i} src={src} alt={`${unit.name} ${i + 1}`} className="w-full h-28 object-cover rounded-sm bg-n-100" />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="pending">Em revisão</Badge>
          <span className="text-xs font-mono text-n-500 bg-n-50 border border-n-200 px-2 py-1 rounded-xs">
            {TYPE_LABELS[unit.operators?.operator_type] || unit.operators?.operator_type || '—'}
          </span>
          {unit.experience_categories?.label_pt && (
            <span className="text-xs font-mono text-n-500 bg-n-50 border border-n-200 px-2 py-1 rounded-xs">
              {unit.experience_categories.label_pt}
            </span>
          )}
        </div>

        <div>
          <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400">Operador</p>
          <p className="text-sm font-body text-n-800">{unit.operators?.name || '—'}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400">Preço</p>
            <p className="text-sm font-display font-bold text-ocean-700">€{unit.base_price}</p>
          </div>
          {unit.capacity != null && (
            <div>
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400 flex items-center gap-1"><Users size={11} strokeWidth={1.75} />Capacidade</p>
              <p className="text-sm font-body text-n-800">{unit.capacity}</p>
            </div>
          )}
          {unit.duration_minutes != null && (
            <div>
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400 flex items-center gap-1"><Clock size={11} strokeWidth={1.75} />Duração</p>
              <p className="text-sm font-body text-n-800">{unit.duration_minutes} min</p>
            </div>
          )}
        </div>

        {descText && (
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400 mb-1">Descrição</p>
            <p className="text-sm font-body text-n-700 leading-relaxed whitespace-pre-wrap">{descText}</p>
          </div>
        )}

        {amenities.length > 0 && (
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400 mb-2">Comodidades</p>
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((a, i) => (
                <span key={i} className="text-xs font-body text-n-700 bg-n-50 border border-n-200 px-2 py-1 rounded-xs">{a}</span>
              ))}
            </div>
          </div>
        )}

        {includedItems.length > 0 && (
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400 mb-2">O que está incluído</p>
            <div className="grid grid-cols-2 gap-2">
              {includedItems.map((it, i) => (
                <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xs border text-xs font-body ${it.included ? 'bg-green-50 border-green-100 text-green-800' : 'bg-n-50 border-n-200 text-n-500'}`}>
                  {it.included ? <Check size={13} strokeWidth={2} className="shrink-0" /> : <X size={13} strokeWidth={2} className="shrink-0" />}
                  {it.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {meta.important_info && (
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400 mb-1">Informação importante</p>
            <p className="text-sm font-body text-amber-800 bg-amber-50 border border-amber-100 rounded-xs px-3 py-2">{meta.important_info}</p>
          </div>
        )}

        {(unit.lat != null && unit.lng != null) && (
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-400 mb-1 flex items-center gap-1"><MapPin size={11} strokeWidth={1.75} />Coordenadas</p>
            <a
              href={`https://www.google.com/maps?q=${unit.lat},${unit.lng}`}
              target="_blank" rel="noreferrer"
              className="text-sm font-body text-ocean-700 hover:underline inline-flex items-center gap-1"
            >
              {unit.lat}, {unit.lng} <ExternalLink size={12} strokeWidth={1.75} />
            </a>
          </div>
        )}

        <p className="text-xs font-body text-n-400">Submetido {fmtDateTime(unit.updated_at)}</p>

        <div className="flex justify-end gap-2 pt-3 border-t border-n-100">
          <Button variant="danger" size="sm" icon={X} loading={rejecting} onClick={() => onReject(unit)}>
            Rejeitar
          </Button>
          <Button size="sm" icon={Check} loading={approving} onClick={() => onApprove(unit)}>
            Aprovar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminConectModeration() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);

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
      setViewTarget(t => (t?.id === unit.id ? null : t));
    } catch (err) {
      window.alert(err?.response?.data?.error || 'Não foi possível aprovar.');
    } finally {
      setBusyId(null);
    }
  }

  function openReject(unit) {
    setRejectTarget(unit);
    setMotivo('');
    setViewTarget(null);
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
              onView={setViewTarget}
              onApprove={handleApprove}
              onReject={openReject}
              approving={busyId === unit.id}
              rejecting={rejecting && rejectTarget?.id === unit.id}
            />
          ))}
        </div>
      )}

      <UnitDetailModal
        unit={viewTarget}
        onClose={() => setViewTarget(null)}
        onApprove={handleApprove}
        onReject={openReject}
        approving={busyId === viewTarget?.id}
        rejecting={rejecting && rejectTarget?.id === viewTarget?.id}
      />

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

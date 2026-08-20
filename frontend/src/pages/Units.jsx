import { useState, useEffect, useMemo } from 'react';
import { Plus, QrCode, Link as LinkIcon, Copy, CheckCircle } from 'lucide-react';
import { listUnits, createUnit, updateUnit, deleteUnit, toggleUnitStatus, updateConectStatus } from '../services/unitsService';
import { getQrCode } from '../services/marketingService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import UnitList from '../components/units/UnitList';
import UnitForm, { parseTourMeta } from '../components/units/UnitForm';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function TableQrModal({ unit, onClose }) {
  const { operator } = useAuthStore();
  const meta = parseTourMeta(unit?.description);
  const [blobUrl, setBlobUrl] = useState(null);
  const [copied,  setCopied]  = useState(false);
  const url = unit && operator ? `${window.location.origin}/book/${operator.slug}/mesa/${unit.id}` : '';

  useEffect(() => {
    if (!unit) { setBlobUrl(null); return; }
    let revoke = null;
    getQrCode({ unitId: unit.id }).then(blob => {
      const u = URL.createObjectURL(blob);
      revoke = u;
      setBlobUrl(u);
    }).catch(() => setBlobUrl(null));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [unit]);

  function download() {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `qrcode-mesa-${meta.number || unit.id}.png`;
    a.click();
  }

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal open={!!unit} onClose={onClose} title={`QR — ${unit?.name || ''}`} size="sm" footer={null}>
      {blobUrl && (
        <img src={blobUrl} alt="QR code" className="w-40 h-40 mx-auto mb-4 rounded-md border border-n-200" />
      )}
      <div className="flex items-center gap-2 bg-n-50 border border-n-200 rounded-md px-3 py-2 mb-3">
        <LinkIcon size={12} strokeWidth={1.75} className="text-n-400 shrink-0" />
        <span className="text-xs font-mono text-n-700 truncate flex-1">{url}</span>
        <button onClick={copyLink} className="p-1 text-n-400 hover:text-ocean-700 transition-colors shrink-0">
          {copied ? <CheckCircle size={13} strokeWidth={1.75} className="text-[#1A7A4A]" /> : <Copy size={13} strokeWidth={1.75} />}
        </button>
      </div>
      <Button onClick={download} className="w-full" icon={QrCode}>Descarregar QR Code</Button>
    </Modal>
  );
}

const LABELS = {
  activity: {
    title:      'Tours & Actividades',
    subtitle:   (n) => `${n} tour(s) disponivel(is)`,
    newBtn:     'Novo Tour',
    editPrefix: 'Editar tour',
    deleteMsg:  (name) => `Eliminar o tour "${name}"? As reservas associadas serao mantidas mas o tour ficara indisponivel.`,
  },
  hotel: {
    title:      'Quartos & Alojamentos',
    subtitle:   (n) => `${n} unidade(s) registada(s)`,
    newBtn:     'Nova Unidade',
    editPrefix: 'Editar',
    deleteMsg:  (name) => `Eliminar a unidade "${name}"? As reservas associadas serao mantidas mas a unidade ficara indisponivel.`,
  },
  rentacar: {
    title:      'Frota',
    subtitle:   (n) => `${n} viatura(s) registada(s)`,
    newBtn:     'Nova Viatura',
    editPrefix: 'Editar',
    deleteMsg:  (name) => `Eliminar a viatura "${name}"? As reservas associadas serao mantidas.`,
  },
  restaurant: {
    title:      'Mesas',
    subtitle:   (n) => `${n} mesa(s) registada(s)`,
    newBtn:     'Nova Mesa',
    editPrefix: 'Editar',
    deleteMsg:  (name) => `Eliminar a mesa "${name}"? As reservas associadas serao mantidas.`,
  },
};

export default function Units() {
  const t = useT();
  const { operator } = useAuthStore();
  const opType = operator?.operator_type || 'hotel';
  const lbl    = LABELS[opType] || LABELS.hotel;

  const [units,        setUnits]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [formLoading,  setFormLoading]  = useState(false);
  const [formError,    setFormError]    = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [qrTarget,     setQrTarget]     = useState(null);

  async function carregar() {
    try {
      const data = await listUnits();
      const filtered = opType === 'restaurant'
        ? data.filter(u => u.unit_type !== 'menu_item' && u.unit_type !== 'tasting_menu')
        : data;
      setUnits(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleSave(dados) {
    setFormError('');
    setFormLoading(true);
    try {
      if (modal === 'create') {
        const unit = await createUnit(dados);
        setUnits([unit, ...units]);
      } else {
        const unit = await updateUnit(modal.id, dados);
        setUnits(units.map((u) => (u.id === unit.id ? unit : u)));
      }
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggle(unit) {
    const next = unit.status === 'inactive' ? 'active' : 'inactive';
    try {
      const updated = await toggleUnitStatus(unit.id, next);
      setUnits(units.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmitConect(unit) {
    const next = ['published', 'paused'].includes(unit.conect_status) ? 'draft' : 'pending_review';
    try {
      const updated = await updateConectStatus(unit.id, next);
      setUnits(units.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUnit(deleteTarget.id);
      setUnits(units.filter((u) => u.id !== deleteTarget.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  }

  const stats = useMemo(() => ({
    total:    units.length,
    active:   units.filter(u => u.status !== 'inactive').length,
    inactive: units.filter(u => u.status === 'inactive').length,
  }), [units]);

  const modalTitle = modal === 'create'
    ? lbl.newBtn
    : modal ? `${lbl.editPrefix}: ${modal.name}` : '';

  return (
    <div>
      <PageHeader
        title={lbl.title}
        subtitle={lbl.subtitle(stats.total)}
        actions={
          <Button icon={Plus} onClick={() => { setFormError(''); setModal('create'); }}>
            {lbl.newBtn}
          </Button>
        }
      />

      {!loading && units.length > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="bg-white rounded-sm border border-n-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-body text-n-500">Total</span>
            <span className="font-display font-bold text-sm text-n-900">{stats.total}</span>
          </div>
          <div className="bg-[#ECFDF5] rounded-sm border border-[#BBF7D0] px-4 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1A7A4A]" />
            <span className="text-xs font-body text-[#1A7A4A]">Activos</span>
            <span className="font-display font-bold text-sm text-[#1A7A4A]">{stats.active}</span>
          </div>
          {stats.inactive > 0 && (
            <div className="bg-n-50 rounded-sm border border-n-200 px-4 py-2.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-n-300" />
              <span className="text-xs font-body text-n-500">Inactivos</span>
              <span className="font-display font-bold text-sm text-n-500">{stats.inactive}</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <UnitList
          units={units}
          operatorType={opType}
          onEdit={(unit) => { setFormError(''); setModal(unit); }}
          onDelete={setDeleteTarget}
          onToggle={handleToggle}
          onSubmitConect={handleSubmitConect}
          onViewQr={opType === 'restaurant' ? setQrTarget : undefined}
        />
      )}

      <TableQrModal unit={qrTarget} onClose={() => setQrTarget(null)} />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modalTitle}
        size={['activity', 'hotel', 'rentacar'].includes(opType) ? 'lg' : 'sm'}
        footer={null}
      >
        {modal && (
          <UnitForm
            unit={modal !== 'create' ? modal : null}
            operatorType={opType}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('common.confirm')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm font-body text-n-700">
          {lbl.deleteMsg(deleteTarget?.name || '')}
        </p>
      </Modal>
    </div>
  );
}

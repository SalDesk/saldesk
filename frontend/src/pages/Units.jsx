import { useState, useEffect, useMemo } from 'react';
import { Plus, QrCode, Link as LinkIcon, Copy, CheckCircle, Sparkles } from 'lucide-react';
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
import { mensagemErro } from '../utils/mensagemErro';

function TableQrModal({ unit, onClose }) {
  const t = useT();
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
        <img src={blobUrl} alt={t('units.qrAlt')} className="w-40 h-40 mx-auto mb-4 rounded-md border border-n-200" />
      )}
      <div className="flex items-center gap-2 bg-n-50 border border-n-200 rounded-md px-3 py-2 mb-3">
        <LinkIcon size={12} strokeWidth={1.75} className="text-n-400 shrink-0" />
        <span className="text-xs font-mono text-n-700 truncate flex-1">{url}</span>
        <button onClick={copyLink} aria-label={t('units.copyLink')} className="p-1 text-n-400 hover:text-ocean-700 transition-colors shrink-0">
          {copied ? <CheckCircle size={13} strokeWidth={1.75} className="text-[var(--success)]" /> : <Copy size={13} strokeWidth={1.75} />}
        </button>
      </div>
      <Button onClick={download} className="w-full" icon={QrCode}>{t('units.downloadQr')}</Button>
    </Modal>
  );
}

/* Textos da pagina por tipo de operador (units.page.<tipo>.*); um tipo sem textos proprios usa os do hotel */
const PAGINAS = ['activity', 'hotel', 'rentacar', 'restaurant'];

export default function Units() {
  const t = useT();
  const { operator } = useAuthStore();
  const opType = operator?.operator_type || 'hotel';
  const pagina = PAGINAS.includes(opType) ? opType : 'hotel';

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
      setFormError(mensagemErro(err, t, t('errors.generic')));
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

  /* Recomendacoes e o "eyebrow" de coordenadas no SalDesk Conect dependem
     de category_id/lat/lng -- so ficam mudos sem isto preenchido (nunca
     inventamos categoria/coordenadas). Mesas de restaurante nunca sao
     elegiveis para o Conect (so os pratos, geridos no Menu Digital), por
     isso o lembrete nao se aplica a elas. */
  const incompleteUnits = opType === 'restaurant' ? [] : units.filter(
    (u) => u.status !== 'inactive' && (!u.category_id || u.lat == null || u.lng == null)
  );

  function abrirCriar() {
    setFormError('');
    setModal('create');
  }

  const newBtn = t(`units.page.${pagina}.newBtn`);
  const modalTitle = modal === 'create'
    ? newBtn
    : modal ? `${t(`units.page.${pagina}.editPrefix`)}: ${modal.name}` : '';

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.operacao')}
        title={t(`units.page.${pagina}.title`)}
        subtitle={t(`units.page.${pagina}.subtitle`, { n: stats.total })}
        actions={
          <Button icon={Plus} onClick={abrirCriar}>
            {newBtn}
          </Button>
        }
      />

      {!loading && units.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="rounded-full border border-mare-card bg-white px-4 py-2 flex items-center gap-2">
            <span className="text-xs font-body font-semibold text-n-600">{t('units.statTotal')}</span>
            <span className="font-mono font-bold text-sm text-ocean-900 tabular-nums">{stats.total}</span>
          </div>
          <div className="rounded-full border border-mare-card bg-white px-4 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-turquoise-600" />
            <span className="text-xs font-body font-semibold text-n-600">{t('units.statActive')}</span>
            <span className="font-mono font-bold text-sm text-ocean-900 tabular-nums">{stats.active}</span>
          </div>
          {stats.inactive > 0 && (
            <div className="rounded-full border border-mare-card bg-white px-4 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-n-300" />
              <span className="text-xs font-body font-semibold text-n-600">{t('units.statInactive')}</span>
              <span className="font-mono font-bold text-sm text-ocean-900 tabular-nums">{stats.inactive}</span>
            </div>
          )}
        </div>
      )}

      {!loading && incompleteUnits.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-sand-50 border border-sand-100 rounded-[14px] flex items-start gap-3">
          <Sparkles size={16} strokeWidth={1.75} className="text-sand-600 shrink-0 mt-0.5" />
          <p className="text-sm font-body text-n-700">
            <span className="font-semibold">{incompleteUnits.length}</span>
            {' '}{t(incompleteUnits.length === 1 ? 'units.incompleteOne' : 'units.incompleteMany')}
          </p>
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
          onCreate={abrirCriar}
          createLabel={newBtn}
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
          {t(`units.page.${pagina}.deleteMsg`, { name: deleteTarget?.name || '' })}
        </p>
      </Modal>
    </div>
  );
}

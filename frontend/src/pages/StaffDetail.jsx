import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Check, X, FileText, Award, Upload, Loader2,
} from 'lucide-react';
import {
  getStaff, listLeave, createLeave, updateLeaveStatus, getLeaveBalance, setLeaveBalance,
  listDocuments, createDocument, deleteDocument,
  listCertifications, createCertification, deleteCertification,
} from '../services/staffService';
import { getSalaryConfig, getSalaryPayments } from '../services/expensesService';
import { uploadDocument, validateDocumentFile } from '../services/uploadService';
import { useToast } from '../store/toastStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import Input, { Select, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ExpiryBadge from '../components/shared/ExpiryBadge';
import { useT } from '../i18n';
import { mensagemErro } from '../utils/mensagemErro';
import { useLingua } from '../utils/formatoLingua';
import { rotuloCargo, rotuloMes, rotuloTipoFerias, rotuloEstadoFerias, TIPOS_FERIAS } from './staff/shared';

/* Separadores: id fixo, rotulo na lingua do painel */
const TABS = [
  { id: 'ferias',        rotulo: 'staffDetail.tabs.leave' },
  { id: 'salario',       rotulo: 'staffDetail.tabs.salary' },
  { id: 'documentos',    rotulo: 'staffDetail.tabs.documents' },
  { id: 'certificacoes', rotulo: 'staffDetail.tabs.certifications' },
];

function fmtMoney(v) {
  return `€${Number(v || 0).toFixed(2)}`;
}

const LEAVE_BADGE = { pending: 'pending', approved: 'confirmed', rejected: 'cancelled' };

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
}

/* ══════════════════════════════════════════
   FERIAS
══════════════════════════════════════════ */
function FeriasTab({ staffId }) {
  const t = useT();
  const toast = useToast();
  const year = new Date().getFullYear();
  const [leave, setLeave] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBalanceForm, setShowBalanceForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'vacation', start_date: '', end_date: '', notes: '' });
  const [entitledInput, setEntitledInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([listLeave(staffId), getLeaveBalance(staffId, year)]);
      setLeave(l);
      setBalance(b);
      setEntitledInput(b.entitled_days ?? b.suggested_days ?? '');
    } catch {
      toast.error(t('staffDetail.leave.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [staffId, year]);

  useEffect(() => { load(); }, [load]);

  async function submitLeave(e) {
    e.preventDefault();
    if (!form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      await createLeave(staffId, form);
      toast.success(t('staffDetail.leave.created'));
      setShowForm(false);
      setForm({ type: 'vacation', start_date: '', end_date: '', notes: '' });
      load();
    } catch (err) {
      toast.error(mensagemErro(err, t, t('staffDetail.leave.errorCreate')));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(leaveId, status) {
    try {
      await updateLeaveStatus(staffId, leaveId, status);
      toast.success(status === 'approved' ? t('hr.requestApproved') : t('hr.requestRejected'));
      load();
    } catch {
      toast.error(t('hr.errorUpdate'));
    }
  }

  async function saveBalance(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await setLeaveBalance(staffId, { year, entitled_days: Number(entitledInput) || 0 });
      toast.success(t('staffDetail.leave.balanceUpdated'));
      setShowBalanceForm(false);
      load();
    } catch {
      toast.error(t('staffDetail.leave.errorBalance'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-5">
      <Card padding="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-8">
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('staffDetail.leave.entitlement', { year })}</p>
            <p className="font-display font-bold text-2xl text-n-900">
              {balance?.entitled_days ?? '—'} {balance?.entitled_days != null && t('hr.daysUnit')}
            </p>
          </div>
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('staffDetail.leave.used')}</p>
            <p className="font-display font-bold text-2xl text-n-900">{balance?.used_days ?? 0} {t('hr.daysUnit')}</p>
          </div>
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('staffDetail.leave.remaining')}</p>
            <p className="font-display font-bold text-2xl text-ocean-700">
              {balance?.remaining_days ?? '—'} {balance?.remaining_days != null && t('hr.daysUnit')}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowBalanceForm(true)}>{t('staffDetail.leave.configure')}</Button>
      </div>
      </Card>

      {balance?.entitled_days == null && (
        <p className="text-xs font-body text-n-700 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm px-3 py-2">
          {balance?.suggested_days != null
            ? t('staffDetail.leave.suggestion', { n: balance.suggested_days })
            : t('staffDetail.leave.notConfigured')}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-n-900">{t('staffDetail.leave.requests')}</h3>
        <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>{t('staffDetail.leave.newRequest')}</Button>
      </div>

      {!leave.length && <Card padding="p-0"><EmptyState title={t('staffDetail.leave.noRequests')} /></Card>}

      <div className="space-y-2">
        {leave.map(l => (
          <Card key={l.id} padding="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body font-semibold text-sm text-n-900">
                {rotuloTipoFerias(l.type, t)} · {l.start_date} → {l.end_date}
                <span className="text-n-400 font-normal"> ({t('hr.daysCount', { n: daysBetween(l.start_date, l.end_date) })})</span>
              </p>
              {l.notes && <p className="text-xs font-body text-n-500 mt-0.5">{l.notes}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={LEAVE_BADGE[l.status]}>{rotuloEstadoFerias(l.status, t)}</Badge>
              {l.status === 'pending' && (
                <>
                  <button onClick={() => changeStatus(l.id, 'approved')} className="text-ocean-700 hover:text-ocean-500" aria-label={t('hr.approve')}><Check size={16} strokeWidth={2} /></button>
                  <button onClick={() => changeStatus(l.id, 'rejected')} className="text-[var(--error)] hover:opacity-70" aria-label={t('hr.reject')}><X size={16} strokeWidth={2} /></button>
                </>
              )}
            </div>
          </div>
          </Card>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('staffDetail.leave.newTitle')}>
        <form onSubmit={submitLeave} className="space-y-4">
          <Select label={t('staffDetail.leave.type')} aria-label={t('staffDetail.leave.type')} required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {TIPOS_FERIAS.map(tipo => <option key={tipo} value={tipo}>{rotuloTipoFerias(tipo, t)}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('staffDetail.leave.start')} aria-label={t('staffDetail.leave.start')} type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input label={t('staffDetail.leave.end')} aria-label={t('staffDetail.leave.end')} type="date" required value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <Textarea label={t('staffDetail.leave.notes')} aria-label={t('staffDetail.leave.notes')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <Button type="submit" loading={saving} className="w-full">{t('staffDetail.leave.createRequest')}</Button>
        </form>
      </Modal>

      <Modal open={showBalanceForm} onClose={() => setShowBalanceForm(false)} title={t('staffDetail.leave.entitlementTitle', { year })}>
        <form onSubmit={saveBalance} className="space-y-4">
          <Input
            label={t('staffDetail.leave.daysPerYear')} aria-label={t('staffDetail.leave.daysPerYear')} type="number" min="0" step="0.5" required
            value={entitledInput} onChange={e => setEntitledInput(e.target.value)}
            hint={balance?.suggested_days != null
              ? t('staffDetail.leave.hintSuggested')
              : t('staffDetail.leave.hintManual')}
          />
          <Button type="submit" loading={saving} className="w-full">{t('common.save')}</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════
   DOCUMENTOS / CERTIFICACOES (upload comum)
══════════════════════════════════════════ */
function UploadButton({ onUploaded }) {
  const t = useT();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateDocumentFile(file);
    if (err) { toast.error(err); return; }
    setUploading(true);
    try {
      const { url } = await uploadDocument(file);
      onUploaded(url, file.name);
    } catch {
      toast.error(t('staffDetail.upload.error'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      <Button size="sm" icon={uploading ? Loader2 : Upload} loading={uploading} onClick={() => inputRef.current?.click()}>
        {t('staffDetail.upload.button')}
      </Button>
    </>
  );
}

function DocumentosTab({ staffId }) {
  const t = useT();
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'contract', name: '', file_url: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocs(await listDocuments(staffId)); }
    catch { toast.error(t('staffDetail.docs.errorLoad')); }
    finally { setLoading(false); }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.file_url) { toast.error(t('staffDetail.docs.needFileAndName')); return; }
    setSaving(true);
    try {
      await createDocument(staffId, form);
      toast.success(t('staffDetail.docs.saved'));
      setShowForm(false);
      setForm({ type: 'contract', name: '', file_url: '', expiry_date: '' });
      load();
    } catch {
      toast.error(t('staffDetail.docs.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(docId) {
    try { await deleteDocument(staffId, docId); toast.success(t('staffDetail.docs.deleted')); load(); }
    catch { toast.error(t('staffDetail.docs.errorDelete')); }
  }

  if (loading) return <div className="py-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-n-900">{t('staffDetail.docs.heading')}</h3>
        <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>{t('staffDetail.docs.add')}</Button>
      </div>

      {!docs.length && <Card padding="p-0"><EmptyState title={t('staffDetail.docs.empty')} /></Card>}

      <div className="space-y-2">
        {docs.map(d => (
          <Card key={d.id} padding="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={18} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
              <div className="min-w-0">
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="font-body font-semibold text-sm text-n-900 hover:text-ocean-700 truncate block">{d.name}</a>
                <ExpiryBadge date={d.expiry_date} />
              </div>
            </div>
            <button onClick={() => remove(d.id)} className="text-n-400 hover:text-[var(--error)] shrink-0" aria-label={t('staffDetail.docs.deleteAria', { name: d.name })}><Trash2 size={16} strokeWidth={1.75} /></button>
          </div>
          </Card>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('staffDetail.docs.newTitle')}>
        <form onSubmit={submit} className="space-y-4">
          <Select label={t('staffDetail.docs.type')} aria-label={t('staffDetail.docs.type')} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="contract">{t('staffDetail.docs.types.contract')}</option>
            <option value="id_document">{t('staffDetail.docs.types.idDocument')}</option>
            <option value="other">{t('staffDetail.docs.types.other')}</option>
          </Select>
          <Input label={t('staffDetail.docs.name')} aria-label={t('staffDetail.docs.name')} required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('staffDetail.docs.namePlaceholder')} />
          <div>
            <UploadButton onUploaded={(url, filename) => setForm(f => ({ ...f, file_url: url, name: f.name || filename }))} />
            {form.file_url && <p className="text-xs font-body text-ocean-700 mt-2">{t('staffDetail.docs.fileUploaded')}</p>}
          </div>
          <Input label={t('staffDetail.docs.expiryOptional')} aria-label={t('staffDetail.docs.expiryOptional')} type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          <Button type="submit" loading={saving} className="w-full">{t('staffDetail.docs.save')}</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════
   CERTIFICACOES
══════════════════════════════════════════ */
function CertificacoesTab({ staffId }) {
  const t = useT();
  const toast = useToast();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', issuer: '', issued_date: '', expiry_date: '', file_url: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCerts(await listCertifications(staffId)); }
    catch { toast.error(t('staffDetail.certs.errorLoad')); }
    finally { setLoading(false); }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name) { toast.error(t('staffDetail.certs.needName')); return; }
    setSaving(true);
    try {
      await createCertification(staffId, form);
      toast.success(t('staffDetail.certs.saved'));
      setShowForm(false);
      setForm({ name: '', issuer: '', issued_date: '', expiry_date: '', file_url: '' });
      load();
    } catch {
      toast.error(t('staffDetail.certs.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(certId) {
    try { await deleteCertification(staffId, certId); toast.success(t('staffDetail.certs.deleted')); load(); }
    catch { toast.error(t('staffDetail.docs.errorDelete')); }
  }

  if (loading) return <div className="py-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-n-900">{t('staffDetail.certs.heading')}</h3>
        <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>{t('staffDetail.docs.add')}</Button>
      </div>

      {!certs.length && <Card padding="p-0"><EmptyState title={t('staffDetail.certs.empty')} /></Card>}

      <div className="space-y-2">
        {certs.map(c => (
          <Card key={c.id} padding="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Award size={18} strokeWidth={1.75} className="text-sand-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-body font-semibold text-sm text-n-900 truncate">{c.name}{c.issuer && <span className="text-n-400 font-normal"> · {c.issuer}</span>}</p>
                <ExpiryBadge date={c.expiry_date} />
              </div>
            </div>
            <button onClick={() => remove(c.id)} className="text-n-400 hover:text-[var(--error)] shrink-0" aria-label={t('staffDetail.certs.deleteAria', { name: c.name })}><Trash2 size={16} strokeWidth={1.75} /></button>
          </div>
          </Card>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('staffDetail.certs.newTitle')}>
        <form onSubmit={submit} className="space-y-4">
          <Input label={t('staffDetail.docs.name')} aria-label={t('staffDetail.docs.name')} required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('staffDetail.certs.namePlaceholder')} />
          <Input label={t('staffDetail.certs.issuer')} aria-label={t('staffDetail.certs.issuer')} value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} placeholder={t('staffDetail.certs.issuerPlaceholder')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('staffDetail.certs.issued')} aria-label={t('staffDetail.certs.issued')} type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
            <Input label={t('staffDetail.certs.validityOptional')} aria-label={t('staffDetail.certs.validityOptional')} type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          </div>
          <div>
            <UploadButton onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
            {form.file_url && <p className="text-xs font-body text-ocean-700 mt-2">{t('staffDetail.certs.uploaded')}</p>}
          </div>
          <Button type="submit" loading={saving} className="w-full">{t('staffDetail.certs.save')}</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════
   SALARIO — configuracao actual + historico de pagamentos
   Dado 100% real, vindo de salary_configs/salary_payments (o mesmo que
   ja alimenta Financeiro > Salarios) -- esta aba e so de leitura, editar
   continua a fazer-se em Financeiro para nao duplicar logica de escrita.
══════════════════════════════════════════ */
function SalarioTab({ staffId }) {
  const t = useT();
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getSalaryConfig(), getSalaryPayments()])
      .then(([configs, allPayments]) => {
        setCfg(configs?.[staffId] || null);
        setPayments((allPayments || []).filter(p => p.staffId === staffId)
          .sort((a, b) => b.year - a.year || b.month - a.month));
      })
      .catch(() => toast.error(t('staffDetail.salary.errorLoad')))
      .finally(() => setLoading(false));
  }, [staffId]);

  if (loading) return <div className="py-12 flex justify-center"><LoadingSpinner /></div>;

  const base = Number(cfg?.base || 0);
  const subsidios = Number(cfg?.food || 0) + Number(cfg?.transport || 0);
  const inpsPct = cfg ? Number(cfg.inps_pct ?? 15) : null;
  const custoTotal = cfg ? base + subsidios + base * (inpsPct / 100) : null;
  const year = new Date().getFullYear();
  const paidThisYear = payments.filter(p => p.year === year).reduce((s, p) => s + Number(p.amount), 0);
  const inpsThisYear = inpsPct != null
    ? payments.filter(p => p.year === year).reduce((s, p) => s + Number(p.amount) * (inpsPct / 100), 0)
    : null;

  return (
    <div className="space-y-5">
      {!cfg ? (
        <p className="text-sm font-body text-n-700 bg-[var(--warning-light)] border border-[var(--warning)] rounded-sm px-3 py-2">
          {t('staffDetail.salary.notConfigured')}{' '}
          <Link to="/financeiro" className="font-semibold text-ocean-700 hover:underline">{t('staffDetail.salary.financeLink')}</Link>.
        </p>
      ) : (
        <Card padding="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('staffDetail.salary.base')}</p>
              <p className="font-display font-bold text-2xl text-n-900">{fmtMoney(base)}</p>
            </div>
            <div>
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('staffDetail.salary.allowances')}</p>
              <p className="font-display font-bold text-2xl text-n-900">{fmtMoney(subsidios)}</p>
            </div>
            <div>
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('staffDetail.salary.employerInps')}</p>
              <p className="font-display font-bold text-2xl text-n-900">{inpsPct}%</p>
            </div>
            <div>
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">{t('staffDetail.salary.totalCost')}</p>
              <p className="font-display font-bold text-2xl text-ocean-700">{fmtMoney(custoTotal)}</p>
            </div>
          </div>
          <Link to="/financeiro" className="text-xs font-body font-semibold text-ocean-700 hover:underline whitespace-nowrap">{t('staffDetail.salary.editInFinance')}</Link>
        </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card padding="px-4 py-3">
          <p className="font-display font-bold text-xl text-n-900">{fmtMoney(paidThisYear)}</p>
          <p className="text-xs font-body text-n-500">{t('staffDetail.salary.paidIn', { year })}</p>
        </Card>
        <Card padding="px-4 py-3">
          <p className="font-display font-bold text-xl text-n-900">{inpsThisYear != null ? fmtMoney(inpsThisYear) : '—'}</p>
          <p className="text-xs font-body text-n-500">{t('staffDetail.salary.inpsEstimated', { year })}</p>
        </Card>
      </div>

      <h3 className="font-display font-semibold text-sm text-n-900">{t('staffDetail.salary.history')}</h3>
      {!payments.length && <Card padding="p-0"><EmptyState title={t('staffDetail.salary.noPayments')} /></Card>}
      <div className="space-y-2">
        {payments.map(p => (
          <Card key={p.id} padding="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-body font-semibold text-sm text-n-900">{p.month >= 1 && p.month <= 12 ? rotuloMes(p.month - 1, t) : ''} {p.year}</p>
            <p className="font-display font-bold text-sm text-n-900">{fmtMoney(p.amount)}</p>
          </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PAGINA
══════════════════════════════════════════ */
export default function StaffDetail() {
  const t = useT();
  const lang = useLingua();
  const { staffId } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [activeTab, setActiveTab] = useState('ferias');

  useEffect(() => {
    getStaff(staffId).then(setStaff).catch(() => setStaff(null));
  }, [staffId]);

  return (
    <div>
      <button onClick={() => navigate('/colaboradores')} className="flex items-center gap-1.5 text-xs font-body font-semibold text-n-500 hover:text-ocean-700 mb-3">
        <ArrowLeft size={14} strokeWidth={2} /> {t('staff.title')}
      </button>
      <PageHeader title={staff?.name || t('staffDetail.fallbackName')} subtitle={rotuloCargo(staff?.role, t, lang)} />

      <div className="mb-5">
        <Tabs tabs={TABS.map(x => ({ id: x.id, label: t(x.rotulo) }))} value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'ferias' && <FeriasTab staffId={staffId} />}
      {activeTab === 'salario' && <SalarioTab staffId={staffId} />}
      {activeTab === 'documentos' && <DocumentosTab staffId={staffId} />}
      {activeTab === 'certificacoes' && <CertificacoesTab staffId={staffId} />}
    </div>
  );
}

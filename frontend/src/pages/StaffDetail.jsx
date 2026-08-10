import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Check, X, FileText, Award, Calendar, Upload, Loader2,
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
import Input, { Select, Textarea } from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ExpiryBadge from '../components/shared/ExpiryBadge';

const TABS = [
  { key: 'ferias',        label: 'Ferias',        Icon: Calendar },
  { key: 'documentos',    label: 'Documentos',    Icon: FileText },
  { key: 'certificacoes', label: 'Certificacoes', Icon: Award },
];

const LEAVE_TYPES = [
  { v: 'vacation',  l: 'Ferias' },
  { v: 'sick',      l: 'Doenca' },
  { v: 'maternity', l: 'Licenca maternidade' },
  { v: 'paternity', l: 'Licenca paternidade' },
  { v: 'unpaid',    l: 'Sem vencimento' },
  { v: 'other',     l: 'Outro' },
];

const LEAVE_TYPE_LABEL = Object.fromEntries(LEAVE_TYPES.map(t => [t.v, t.l]));
const LEAVE_BADGE = { pending: 'pending', approved: 'confirmed', rejected: 'cancelled' };

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
}

/* ══════════════════════════════════════════
   FERIAS
══════════════════════════════════════════ */
function FeriasTab({ staffId }) {
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
      toast.error('Erro ao carregar ferias');
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
      toast.success('Pedido de ferias criado');
      setShowForm(false);
      setForm({ type: 'vacation', start_date: '', end_date: '', notes: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar pedido');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(leaveId, status) {
    try {
      await updateLeaveStatus(staffId, leaveId, status);
      toast.success(status === 'approved' ? 'Pedido aprovado' : 'Pedido rejeitado');
      load();
    } catch {
      toast.error('Erro ao actualizar pedido');
    }
  }

  async function saveBalance(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await setLeaveBalance(staffId, { year, entitled_days: Number(entitledInput) || 0 });
      toast.success('Saldo de ferias actualizado');
      setShowBalanceForm(false);
      load();
    } catch {
      toast.error('Erro ao guardar saldo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-n-200 rounded-md p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-8">
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Direito ({year})</p>
            <p className="font-display font-bold text-2xl text-n-900">
              {balance?.entitled_days ?? '—'} {balance?.entitled_days != null && 'dias'}
            </p>
          </div>
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Usados</p>
            <p className="font-display font-bold text-2xl text-n-900">{balance?.used_days ?? 0} dias</p>
          </div>
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Restantes</p>
            <p className="font-display font-bold text-2xl text-ocean-700">
              {balance?.remaining_days ?? '—'} {balance?.remaining_days != null && 'dias'}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowBalanceForm(true)}>Configurar direito</Button>
      </div>

      {balance?.entitled_days == null && (
        <p className="text-xs font-body text-n-500 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {balance?.suggested_days != null
            ? `O direito a ferias ainda nao foi configurado. Sugestao com base na data de admissao (22 dias/12 meses, proporcional): ${balance.suggested_days} dias — confirma ou ajusta em "Configurar direito".`
            : 'O numero de dias de ferias ainda nao esta configurado — define o direito anual deste colaborador acima (adiciona a data de admissao no perfil do colaborador para receberes uma sugestao automatica).'}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-n-900">Pedidos</h3>
        <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>Novo pedido</Button>
      </div>

      {!leave.length && <p className="text-sm font-body text-n-500">Sem pedidos registados.</p>}

      <div className="space-y-2">
        {leave.map(l => (
          <div key={l.id} className="flex items-center justify-between gap-3 bg-white border border-n-200 rounded-md px-4 py-3">
            <div>
              <p className="font-body font-semibold text-sm text-n-900">
                {LEAVE_TYPE_LABEL[l.type] || l.type} · {l.start_date} → {l.end_date}
                <span className="text-n-400 font-normal"> ({daysBetween(l.start_date, l.end_date)} dias)</span>
              </p>
              {l.notes && <p className="text-xs font-body text-n-500 mt-0.5">{l.notes}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={LEAVE_BADGE[l.status]}>{l.status === 'pending' ? 'Pendente' : l.status === 'approved' ? 'Aprovado' : 'Rejeitado'}</Badge>
              {l.status === 'pending' && (
                <>
                  <button onClick={() => changeStatus(l.id, 'approved')} className="text-ocean-700 hover:text-ocean-500" aria-label="Aprovar"><Check size={16} strokeWidth={2} /></button>
                  <button onClick={() => changeStatus(l.id, 'rejected')} className="text-error hover:opacity-70" aria-label="Rejeitar"><X size={16} strokeWidth={2} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo pedido de ferias">
        <form onSubmit={submitLeave} className="space-y-4">
          <Select label="Tipo" required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {LEAVE_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Inicio" type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input label="Fim" type="date" required value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <Textarea label="Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <Button type="submit" loading={saving} className="w-full">Criar pedido</Button>
        </form>
      </Modal>

      <Modal open={showBalanceForm} onClose={() => setShowBalanceForm(false)} title={`Direito a ferias — ${year}`}>
        <form onSubmit={saveBalance} className="space-y-4">
          <Input
            label="Dias de ferias por ano" type="number" min="0" step="0.5" required
            value={entitledInput} onChange={e => setEntitledInput(e.target.value)}
            hint={balance?.suggested_days != null
              ? `Pre-preenchido com a sugestao proporcional (22 dias/12 meses) a partir da data de admissao — ajusta se o contrato definir outro valor.`
              : 'Define aqui o numero de dias segundo o contrato/lei aplicavel.'}
          />
          <Button type="submit" loading={saving} className="w-full">Guardar</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════
   DOCUMENTOS / CERTIFICACOES (upload comum)
══════════════════════════════════════════ */
function UploadButton({ onUploaded }) {
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
      toast.error('Erro ao carregar ficheiro');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      <Button size="sm" icon={uploading ? Loader2 : Upload} loading={uploading} onClick={() => inputRef.current?.click()}>
        Carregar ficheiro
      </Button>
    </>
  );
}

function DocumentosTab({ staffId }) {
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'contract', name: '', file_url: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocs(await listDocuments(staffId)); }
    catch { toast.error('Erro ao carregar documentos'); }
    finally { setLoading(false); }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.file_url) { toast.error('Carrega um ficheiro e da um nome ao documento'); return; }
    setSaving(true);
    try {
      await createDocument(staffId, form);
      toast.success('Documento guardado');
      setShowForm(false);
      setForm({ type: 'contract', name: '', file_url: '', expiry_date: '' });
      load();
    } catch {
      toast.error('Erro ao guardar documento');
    } finally {
      setSaving(false);
    }
  }

  async function remove(docId) {
    try { await deleteDocument(staffId, docId); toast.success('Documento eliminado'); load(); }
    catch { toast.error('Erro ao eliminar'); }
  }

  if (loading) return <div className="py-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-n-900">Contratos e documentos</h3>
        <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>Adicionar</Button>
      </div>

      {!docs.length && <p className="text-sm font-body text-n-500">Sem documentos guardados.</p>}

      <div className="space-y-2">
        {docs.map(d => (
          <div key={d.id} className="flex items-center justify-between gap-3 bg-white border border-n-200 rounded-md px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={18} strokeWidth={1.75} className="text-ocean-700 shrink-0" />
              <div className="min-w-0">
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="font-body font-semibold text-sm text-n-900 hover:text-ocean-700 truncate block">{d.name}</a>
                <ExpiryBadge date={d.expiry_date} />
              </div>
            </div>
            <button onClick={() => remove(d.id)} className="text-n-400 hover:text-error shrink-0" aria-label="Eliminar"><Trash2 size={16} strokeWidth={1.75} /></button>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo documento">
        <form onSubmit={submit} className="space-y-4">
          <Select label="Tipo" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="contract">Contrato</option>
            <option value="id_document">Documento de identificacao</option>
            <option value="other">Outro</option>
          </Select>
          <Input label="Nome" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Contrato de trabalho 2026" />
          <div>
            <UploadButton onUploaded={(url, filename) => setForm(f => ({ ...f, file_url: url, name: f.name || filename }))} />
            {form.file_url && <p className="text-xs font-body text-ocean-700 mt-2">Ficheiro carregado.</p>}
          </div>
          <Input label="Data de validade (opcional)" type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          <Button type="submit" loading={saving} className="w-full">Guardar documento</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════
   CERTIFICACOES
══════════════════════════════════════════ */
function CertificacoesTab({ staffId }) {
  const toast = useToast();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', issuer: '', issued_date: '', expiry_date: '', file_url: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCerts(await listCertifications(staffId)); }
    catch { toast.error('Erro ao carregar certificacoes'); }
    finally { setLoading(false); }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name) { toast.error('Da um nome a certificacao'); return; }
    setSaving(true);
    try {
      await createCertification(staffId, form);
      toast.success('Certificacao guardada');
      setShowForm(false);
      setForm({ name: '', issuer: '', issued_date: '', expiry_date: '', file_url: '' });
      load();
    } catch {
      toast.error('Erro ao guardar certificacao');
    } finally {
      setSaving(false);
    }
  }

  async function remove(certId) {
    try { await deleteCertification(staffId, certId); toast.success('Certificacao eliminada'); load(); }
    catch { toast.error('Erro ao eliminar'); }
  }

  if (loading) return <div className="py-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-n-900">Formacao e certificacoes</h3>
        <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>Adicionar</Button>
      </div>

      {!certs.length && <p className="text-sm font-body text-n-500">Sem certificacoes registadas.</p>}

      <div className="space-y-2">
        {certs.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-3 bg-white border border-n-200 rounded-md px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Award size={18} strokeWidth={1.75} className="text-sand-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-body font-semibold text-sm text-n-900 truncate">{c.name}{c.issuer && <span className="text-n-400 font-normal"> · {c.issuer}</span>}</p>
                <ExpiryBadge date={c.expiry_date} />
              </div>
            </div>
            <button onClick={() => remove(c.id)} className="text-n-400 hover:text-error shrink-0" aria-label="Eliminar"><Trash2 size={16} strokeWidth={1.75} /></button>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nova certificacao">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nome" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: PADI Open Water" />
          <Input label="Emitido por" value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} placeholder="Ex: PADI" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data de emissao" type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
            <Input label="Validade (opcional)" type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          </div>
          <div>
            <UploadButton onUploaded={(url) => setForm(f => ({ ...f, file_url: url }))} />
            {form.file_url && <p className="text-xs font-body text-ocean-700 mt-2">Certificado carregado.</p>}
          </div>
          <Button type="submit" loading={saving} className="w-full">Guardar certificacao</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════
   RESUMO DE CONFORMIDADE (INPS)
   Dado 100% real -- soma salary_payments x inps_pct ja existentes,
   nao inventa nenhum numero novo.
══════════════════════════════════════════ */
function ConformidadeCard({ staffId }) {
  const [inpsTotal, setInpsTotal] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [configs, payments] = await Promise.all([getSalaryConfig(), getSalaryPayments()]);
        const pct = configs?.[staffId]?.inps_pct;
        if (pct == null) { setInpsTotal(null); return; }
        const year = new Date().getFullYear();
        const total = (payments || [])
          .filter(p => p.staffId === staffId && p.year === year)
          .reduce((s, p) => s + Number(p.amount) * (Number(pct) / 100), 0);
        setInpsTotal(total);
      } catch {
        setInpsTotal(null);
      }
    })();
  }, [staffId]);

  if (inpsTotal == null) return null;

  return (
    <div className="bg-ocean-50 border border-ocean-100 rounded-md px-4 py-3 mb-5 flex items-center justify-between">
      <p className="text-sm font-body text-ocean-800">
        Contribuicoes INPS estimadas em {new Date().getFullYear()}
      </p>
      <p className="font-display font-bold text-ocean-700">€{inpsTotal.toFixed(2)}</p>
    </div>
  );
}

/* ══════════════════════════════════════════
   PAGINA
══════════════════════════════════════════ */
export default function StaffDetail() {
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
        <ArrowLeft size={14} strokeWidth={2} /> Colaboradores
      </button>
      <PageHeader title={staff?.name || 'Colaborador'} subtitle={staff?.role} />

      <ConformidadeCard staffId={staffId} />

      <div className="flex gap-0.5 overflow-x-auto border-b border-n-200 mb-5">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />{label}
          </button>
        ))}
      </div>

      {activeTab === 'ferias' && <FeriasTab staffId={staffId} />}
      {activeTab === 'documentos' && <DocumentosTab staffId={staffId} />}
      {activeTab === 'certificacoes' && <CertificacoesTab staffId={staffId} />}
    </div>
  );
}

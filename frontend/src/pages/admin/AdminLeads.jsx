import { useState, useMemo, useEffect } from 'react';
import {
  Download, Search, ChevronUp, Mail, ArrowRightCircle, Send, Check,
  LayoutGrid, List, Plus, Phone, Users as UsersIcon, Video, MessageSquare,
  Clock, FileText,
} from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select, Textarea } from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';

const STATUS_CONFIG = {
  novo:              { label: 'Novo',              badge: 'pending'   },
  contactado:        { label: 'Contactado',        badge: 'info'      },
  demo_agendada:     { label: 'Demo agendada',     badge: 'pending'   },
  proposta_enviada:  { label: 'Proposta enviada',  badge: 'info'      },
  convertido:        { label: 'Convertido',        badge: 'confirmed' },
  descartado:        { label: 'Descartado',        badge: 'cancelled' },
};

const KANBAN_STAGES = Object.keys(STATUS_CONFIG);
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'convertido');

const TYPE_LABELS = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

const SCORE_LABELS = {
  tipo_negocio:   'Tipo de negocio',
  volume_mensal:  'Volume mensal',
  anos_operacao:  'Anos de operacao',
  tem_site:       'Tem site proprio',
  usa_otas:       'Usa OTAs',
};

const CONTACT_TYPE_CONFIG = {
  email:    { label: 'Email',     icon: Mail },
  telefone: { label: 'Telefone',  icon: Phone },
  reuniao:  { label: 'Reuniao',   icon: UsersIcon },
  demo:     { label: 'Demo',      icon: Video },
};

function scoreColor(score) {
  return score > 70 ? 'text-[var(--success)]' : score >= 40 ? 'text-[var(--warning)]' : 'text-[var(--error)]';
}
function scoreBarColor(score) {
  return score > 70 ? 'bg-[var(--success)]' : score >= 40 ? 'bg-sand-500' : 'bg-[var(--error)]';
}
function priorityBadge(score) {
  if (score > 70) return { label: 'Prioridade alta',  variant: 'confirmed' };
  if (score >= 40) return { label: 'Prioridade media', variant: 'pending' };
  return { label: 'Prioridade baixa', variant: 'cancelled' };
}
function daysInPipeline(lead) {
  return Math.max(0, Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000));
}

function ScoreBar({ score, size = 'sm' }) {
  const h = size === 'lg' ? 'h-2' : 'h-1.5';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} bg-n-200 rounded-full overflow-hidden`} style={{ minWidth: size === 'lg' ? 0 : 64 }}>
        <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

function exportCsv(rows) {
  const keys    = ['email', 'nome', 'nome_negocio', 'tipo_negocio', 'source', 'computed_status', 'score', 'created_at'];
  const headers = ['Email', 'Nome', 'Negocio', 'Tipo', 'Origem', 'Estado', 'Score', 'Data'];
  const lines   = rows.map(l => keys.map(k => `"${(l[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
  const csv     = [headers.join(','), ...lines].join('\n');
  const blob    = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const EMAIL_TEMPLATES = {
  boas_vindas: {
    label: 'Boas-vindas',
    subject: 'SalDesk — obrigado pelo seu interesse',
    body:
      'Ola {{nome}},\n\n' +
      'Obrigado por se candidatar e querer conhecer a SalDesk. Vimos que tem um negocio de {{tipo}} na Ilha do Sal e ' +
      'gostariamos de mostrar como a nossa plataforma pode ajudar a centralizar reservas, equipa e pagamentos num unico lugar.\n\n' +
      'Em breve entraremos em contacto para combinar os proximos passos.\n\nCumprimentos,\nEquipa SalDesk',
  },
  agendar_demo: {
    label: 'Agendar demo',
    subject: 'SalDesk — vamos agendar a sua demonstracao?',
    body:
      'Ola {{nome}},\n\n' +
      'Obrigado pela conversa. Para avancarmos, indique 2-3 horarios que lhe sejam convenientes nos proximos dias ' +
      'e confirmamos a demonstracao da plataforma SalDesk adaptada ao seu negocio de {{tipo}}.\n\n' +
      'Aguardamos a sua resposta.\n\nCumprimentos,\nEquipa SalDesk',
  },
  proposta_comercial: {
    label: 'Proposta comercial',
    subject: 'SalDesk — proposta para o seu negocio',
    body:
      'Ola {{nome}},\n\n' +
      'Com base na nossa conversa, preparamos uma proposta comercial para o seu negocio de {{tipo}}: planos, precos e ' +
      'o que a SalDesk pode automatizar desde o primeiro dia (reservas, equipa, financas e comunicacao com clientes).\n\n' +
      'Fico disponivel para esclarecer qualquer duvida e avancar com a activacao.\n\nCumprimentos,\nEquipa SalDesk',
  },
  follow_up: {
    label: 'Follow-up',
    subject: 'SalDesk — continuamos disponiveis para ajudar',
    body:
      'Ola {{nome}},\n\n' +
      'Notamos que ainda nao avancamos com os proximos passos. A SalDesk continua disponivel para ' +
      'apresentar a plataforma e esclarecer qualquer duvida sobre planos, precos ou funcionalidades.\n\n' +
      'Quando lhe for conveniente, estamos aqui.\n\nCumprimentos,\nEquipa SalDesk',
  },
};

function fillTemplate(text, lead) {
  return text
    .replaceAll('{{nome}}', lead?.nome || lead?.nome_negocio || 'tudo bem')
    .replaceAll('{{tipo}}', (TYPE_LABELS[lead?.tipo_negocio] || lead?.tipo_negocio || 'turismo').toLowerCase());
}

function DetailRow({ label, value }) {
  return (
    <div className="flex gap-2 text-xs font-body py-1">
      <span className="text-n-400 w-32 shrink-0">{label}</span>
      <span className="text-n-700 font-medium break-words">{value || '—'}</span>
    </div>
  );
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

/* ─── Card de lead (Kanban, arrastavel) ─────────────────────── */
function LeadCard({ lead, onOpen, onDragStart }) {
  const score    = lead.score || 0;
  const priority = priorityBadge(score);
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, lead)}
      onClick={() => onOpen(lead)}
      className="bg-white rounded-md border border-n-200 shadow-sm px-3 py-2.5 cursor-grab active:cursor-grabbing hover:border-ocean-300 hover:shadow-md transition-all space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-n-900 text-sm truncate">{lead.nome_negocio || lead.nome || lead.email}</p>
          <p className="text-xs text-n-400 truncate">{TYPE_LABELS[lead.tipo_negocio] || lead.tipo_negocio || '—'}</p>
        </div>
        <span className={`text-sm font-mono font-bold shrink-0 ${scoreColor(score)}`}>{score}</span>
      </div>
      <ScoreBar score={score} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant={priority.variant}>{priority.label}</Badge>
        <span className="inline-flex items-center gap-1 text-xs font-mono text-n-400">
          <Clock size={11} strokeWidth={1.75} /> {daysInPipeline(lead)}d
        </span>
      </div>
    </div>
  );
}

/* ─── Coluna Kanban ──────────────────────────────────────────── */
function KanbanColumn({ stage, leads, onOpen, onDragStart, onDrop, dragOver, setDragOver }) {
  const cfg = STATUS_CONFIG[stage];
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(stage); }}
      onDragLeave={() => setDragOver(prev => (prev === stage ? null : prev))}
      onDrop={e => { e.preventDefault(); setDragOver(null); onDrop(stage); }}
      className={`flex flex-col w-72 shrink-0 rounded-md border transition-colors ${dragOver === stage ? 'border-ocean-400 bg-ocean-50' : 'border-n-200 bg-n-50'}`}
    >
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-n-200">
        <span className="text-xs font-mono font-bold uppercase tracking-wide text-n-600">{cfg.label}</span>
        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-white border border-n-200 text-xs font-mono font-bold text-n-700">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {leads.length === 0 ? (
          <p className="text-xs font-body text-n-300 text-center py-6">Sem leads nesta fase</p>
        ) : (
          leads.map(l => <LeadCard key={l.id} lead={l} onOpen={onOpen} onDragStart={onDragStart} />)
        )}
      </div>
    </div>
  );
}

export default function AdminLeads() {
  const [leads,    setLeads]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [sortScore,    setSortScore]    = useState(false);
  const [view,         setView]         = useState('kanban'); // 'kanban' | 'lista'
  const [dragOver,     setDragOver]     = useState(null);
  const [draggedLead,  setDraggedLead]  = useState(null);

  const [selectedLead, setSelectedLead] = useState(null);

  const [emailModal, setEmailModal] = useState(null);
  const [emailForm,  setEmailForm]  = useState({ template: '', subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentOk,  setEmailSentOk]  = useState(false);

  const [converting, setConverting] = useState(false);

  const [noteText,    setNoteText]    = useState('');
  const [savingNote,  setSavingNote]  = useState(false);
  const [contactForm, setContactForm] = useState({ open: false, type: 'telefone', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [savingContact, setSavingContact] = useState(false);

  function loadLeads() {
    setLoading(true);
    const q = {};
    if (filterType)   q.tipo_negocio = filterType;
    if (filterStatus) q.status       = filterStatus;
    api.get('/admin/leads', { params: q })
      .then(r => setLeads(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(loadLeads, [filterType, filterStatus]);

  function openDetail(lead) {
    setSelectedLead(lead);
    setNoteText('');
    setContactForm({ open: false, type: 'telefone', date: new Date().toISOString().slice(0, 10), notes: '' });
  }

  function applyLeadUpdate(updated) {
    setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
    setSelectedLead(prev => (prev && prev.id === updated.id) ? { ...prev, ...updated } : prev);
  }

  async function handleStageChange(lead, stage) {
    if (!lead || lead.computed_status === stage) return;
    try {
      const { data } = await api.put(`/admin/leads/${lead.id}/stage`, { stage });
      applyLeadUpdate(data.data);
    } catch (err) {
      window.alert(err?.response?.data?.error || 'Nao foi possivel alterar a fase do lead.');
    }
  }

  function handleDragStart(e, lead) {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(stage) {
    if (draggedLead) handleStageChange(draggedLead, stage);
    setDraggedLead(null);
  }

  async function handleConvert(lead) {
    if (!window.confirm(`Converter "${lead.nome_negocio || lead.nome}" num operador SalDesk?\n\nIsto cria um registo de operador em modo trial (30 dias).`)) return;
    setConverting(true);
    try {
      const { data } = await api.post(`/admin/leads/${lead.id}/convert`);
      applyLeadUpdate({ ...data.data.lead, computed_status: 'convertido' });
      setSelectedLead(null);
      window.alert(`Operador criado: ${data.data.operator.name}\nSlug: ${data.data.operator.slug}`);
    } catch (err) {
      window.alert(err?.response?.data?.error || 'Nao foi possivel converter o lead.');
    } finally { setConverting(false); }
  }

  function openEmail(lead) {
    setEmailModal(lead);
    setEmailForm({ template: '', subject: '', body: '' });
    setEmailSentOk(false);
  }

  function applyTemplate(key) {
    const tpl = EMAIL_TEMPLATES[key];
    if (!tpl) { setEmailForm(p => ({ ...p, template: '' })); return; }
    setEmailForm({
      template: key,
      subject:  fillTemplate(tpl.subject, emailModal),
      body:     fillTemplate(tpl.body, emailModal),
    });
  }

  async function handleSendEmail() {
    if (!emailModal || !emailForm.subject.trim() || !emailForm.body.trim()) return;
    setSendingEmail(true);
    try {
      const { data } = await api.post(`/admin/leads/${emailModal.id}/email`, {
        subject: emailForm.subject,
        body:    emailForm.body,
      });
      applyLeadUpdate(data.data);
      setEmailSentOk(true);
      setTimeout(() => { setEmailModal(null); setEmailSentOk(false); }, 1200);
    } catch {} finally { setSendingEmail(false); }
  }

  async function handleAddNote() {
    if (!selectedLead || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data } = await api.post(`/admin/leads/${selectedLead.id}/note`, { text: noteText.trim() });
      applyLeadUpdate(data.data);
      setNoteText('');
    } catch {} finally { setSavingNote(false); }
  }

  async function handleAddContact() {
    if (!selectedLead) return;
    setSavingContact(true);
    try {
      const { data } = await api.post(`/admin/leads/${selectedLead.id}/contact`, {
        type:  contactForm.type,
        date:  contactForm.date,
        notes: contactForm.notes.trim(),
      });
      applyLeadUpdate(data.data);
      setContactForm({ open: false, type: 'telefone', date: new Date().toISOString().slice(0, 10), notes: '' });
    } catch {} finally { setSavingContact(false); }
  }

  const displayed = useMemo(() => {
    let rows = leads;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(l =>
        (l.email || '').toLowerCase().includes(s) ||
        (l.nome  || '').toLowerCase().includes(s) ||
        (l.nome_negocio || '').toLowerCase().includes(s)
      );
    }
    if (sortScore) rows = [...rows].sort((a, b) => (b.score || 0) - (a.score || 0));
    return rows;
  }, [leads, search, sortScore]);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(KANBAN_STAGES.map(s => [s, []]));
    displayed.forEach(l => {
      const s = KANBAN_STAGES.includes(l.computed_status) ? l.computed_status : 'novo';
      g[s].push(l);
    });
    KANBAN_STAGES.forEach(s => g[s].sort((a, b) => (b.score || 0) - (a.score || 0)));
    return g;
  }, [displayed]);

  /* timeline combinada: mudancas de fase + contactos + notas */
  const timeline = useMemo(() => {
    if (!selectedLead) return [];
    const items = [];
    items.push({ at: selectedLead.created_at, type: 'criado', text: 'Candidatura recebida' });
    (selectedLead.stage_history || []).forEach(h => items.push({
      at: h.at, type: 'fase',
      text: `Fase alterada: ${STATUS_CONFIG[h.from]?.label || h.from} -> ${STATUS_CONFIG[h.to]?.label || h.to}`,
    }));
    (selectedLead.contact_log || []).forEach(c => items.push({
      at: c.at, type: 'contacto',
      text: `Contacto registado (${CONTACT_TYPE_CONFIG[c.type]?.label || c.type})${c.notes ? ` — ${c.notes}` : ''}`,
    }));
    (selectedLead.notes_log || []).forEach(n => items.push({ at: n.at, type: 'nota', text: `Nota interna adicionada` }));
    if (selectedLead.converted_at) items.push({ at: selectedLead.converted_at, type: 'convertido', text: 'Convertido em operador' });
    return items.filter(i => i.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [selectedLead]);

  const columns = [
    {
      key: 'created_at', label: 'Data', width: '100px',
      render: l => <span className="font-mono text-xs text-n-500">{l.created_at?.split('T')[0]}</span>,
    },
    {
      key: 'email', label: 'Lead',
      render: l => (
        <div>
          <p className="font-semibold text-n-900 text-sm">{l.nome_negocio || l.nome || l.email}</p>
          <p className="text-xs text-n-400">{l.email}</p>
        </div>
      ),
    },
    {
      key: 'tipo_negocio', label: 'Tipo', width: '110px',
      render: l => <span className="text-xs text-n-600">{TYPE_LABELS[l.tipo_negocio] || l.tipo_negocio || '—'}</span>,
    },
    {
      key: 'score', label: (
        <button className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-n-500" onClick={() => setSortScore(s => !s)}>
          Score <ChevronUp size={12} strokeWidth={2} className={sortScore ? 'text-ocean-700' : 'text-n-300'} />
        </button>
      ), width: '110px',
      render: l => <ScoreBar score={l.score || 0} />,
    },
    {
      key: 'computed_status', label: 'Estado', width: '140px',
      render: l => {
        const cfg = STATUS_CONFIG[l.computed_status] || STATUS_CONFIG.novo;
        return <Badge variant={cfg.badge}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'actions', label: '', width: '160px',
      render: l => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openDetail(l)}>Ver</Button>
          <Button variant="ghost" size="sm" icon={Mail} onClick={() => openEmail(l)} title="Enviar email">Email</Button>
        </div>
      ),
    },
  ];

  const newCount = leads.filter(l => l.computed_status === 'novo').length;

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${newCount} novos · ${leads.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-sm border border-n-200 bg-white overflow-hidden">
              <button
                onClick={() => setView('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 h-8 text-xs font-body font-semibold transition-colors ${view === 'kanban' ? 'bg-ocean-700 text-white' : 'text-n-500 hover:text-n-700'}`}
              >
                <LayoutGrid size={14} strokeWidth={1.75} /> Kanban
              </button>
              <button
                onClick={() => setView('lista')}
                className={`inline-flex items-center gap-1.5 px-3 h-8 text-xs font-body font-semibold transition-colors border-l border-n-200 ${view === 'lista' ? 'bg-ocean-700 text-white' : 'text-n-500 hover:text-n-700'}`}
              >
                <List size={14} strokeWidth={1.75} /> Lista
              </button>
            </div>
            <Button variant="secondary" size="sm" icon={Download} onClick={() => exportCsv(displayed)}>
              Exportar CSV
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-52">
          <Search size={13} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-n-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar email ou nome..."
            className="w-full h-8 pl-8 pr-3 rounded-sm border border-n-200 text-xs font-body bg-white focus:outline-none focus:ring-1 focus:ring-ocean-300"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body bg-white focus:outline-none"
        >
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="h-8 px-2 rounded-sm border border-n-200 text-xs font-body bg-white focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          <option value="activity">Actividade</option>
          <option value="hotel">Hotel</option>
          <option value="rentacar">Rent-a-car</option>
          <option value="restaurant">Restaurante</option>
        </select>
        {(filterStatus || filterType) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(''); setFilterType(''); }}>
            Limpar
          </Button>
        )}
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_STAGES.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={grouped[stage]}
              onOpen={openDetail}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dragOver={dragOver}
              setDragOver={setDragOver}
            />
          ))}
        </div>
      ) : (
        <Card padding="p-0">
          <Table columns={columns} rows={displayed} loading={loading} />
        </Card>
      )}

      {/* Modal detalhe do lead */}
      <Modal
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.nome_negocio || selectedLead?.nome || selectedLead?.email || 'Lead'}
        size="lg"
        footer={
          <div className="flex gap-2 w-full flex-wrap">
            <Button variant="ghost" size="sm" icon={Mail} onClick={() => openEmail(selectedLead)}>Enviar email</Button>
            {selectedLead?.computed_status !== 'convertido' && (
              <Button variant="secondary" size="sm" icon={ArrowRightCircle} loading={converting} onClick={() => handleConvert(selectedLead)}>
                Converter em operador
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => setSelectedLead(null)}>Fechar</Button>
          </div>
        }
      >
        {selectedLead && (
          <div className="space-y-5">
            {/* Resumo + score + fase */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-display font-bold text-n-900">{selectedLead.nome_negocio || selectedLead.nome}</p>
                <p className="text-xs font-body text-n-500">{selectedLead.email} · {selectedLead.telefone || selectedLead.whatsapp || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={priorityBadge(selectedLead.score || 0).variant}>{priorityBadge(selectedLead.score || 0).label}</Badge>
                <span className={`font-display font-bold text-lg ${scoreColor(selectedLead.score || 0)}`}>{selectedLead.score || 0}</span>
              </div>
            </div>

            {/* Fase do pipeline */}
            <Select
              label="Fase do pipeline"
              value={selectedLead.computed_status || 'novo'}
              onChange={e => handleStageChange(selectedLead, e.target.value)}
            >
              {STATUS_OPTIONS.map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              <option value="convertido" disabled={selectedLead.computed_status !== 'convertido'}>{STATUS_CONFIG.convertido.label}</option>
            </Select>

            {/* Score detalhado com barra de progresso */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Composicao do score</p>
              <ScoreBar score={selectedLead.score || 0} size="lg" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {Object.entries(selectedLead.score_breakdown || {}).map(([k, v]) => (
                  <div key={k} className="bg-n-50 rounded-sm px-3 py-2">
                    <p className="text-xs font-body text-n-500">{SCORE_LABELS[k] || k}</p>
                    <p className="font-display font-bold text-sm text-n-900">+{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Respostas do formulario */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Candidatura</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 bg-n-50 rounded-sm p-3">
                <DetailRow label="Funcao"               value={selectedLead.funcao} />
                <DetailRow label="Localizacao"          value={selectedLead.localizacao} />
                <DetailRow label="Tipo de negocio"      value={TYPE_LABELS[selectedLead.tipo_negocio] || selectedLead.tipo_negocio} />
                <DetailRow label="Anos de operacao"     value={selectedLead.anos_operacao} />
                <DetailRow label="Clientes / mes"       value={selectedLead.clientes_mes || selectedLead.volume_mensal} />
                <DetailRow label="Tem site"             value={selectedLead.tem_site ? (selectedLead.url_site || 'Sim') : 'Nao'} />
                <DetailRow label="Funcionarios"         value={selectedLead.num_funcionarios} />
                <DetailRow label="Usa OTAs"             value={Array.isArray(selectedLead.otas) && selectedLead.otas.length ? selectedLead.otas.join(', ') : 'Nao'} />
                <DetailRow label="Gere reservas via"    value={Array.isArray(selectedLead.como_gere_reservas) ? selectedLead.como_gere_reservas.join(', ') : '—'} />
                <DetailRow label="Desafios"             value={Array.isArray(selectedLead.desafios) ? selectedLead.desafios.join(', ') : '—'} />
                <DetailRow label="Plano de interesse"   value={selectedLead.plano_interesse} />
                <DetailRow label="Quando comecar"       value={selectedLead.quando_comecar} />
                <DetailRow label="Como soube da SalDesk" value={selectedLead.como_soube} />
                <DetailRow label="Disponivel p/ demo"   value={selectedLead.disponivel_demo ? 'Sim' : 'Nao'} />
                <DetailRow label="Horario de contacto"  value={selectedLead.horario_contacto} />
                {selectedLead.comentarios && (
                  <div className="sm:col-span-2">
                    <DetailRow label="Comentarios" value={selectedLead.comentarios} />
                  </div>
                )}
              </div>
            </div>

            {/* Notas internas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-mono uppercase tracking-wide text-n-400">Notas internas</p>
              </div>
              <div className="space-y-2 mb-2">
                {(selectedLead.notes_log || []).length === 0 ? (
                  <p className="text-xs font-body text-n-400">Sem notas registadas.</p>
                ) : (
                  [...(selectedLead.notes_log || [])].reverse().map((n, i) => (
                    <div key={i} className="bg-n-50 rounded-sm px-3 py-2">
                      <p className="text-sm font-body text-n-700 whitespace-pre-wrap">{n.text}</p>
                      <p className="text-xs font-mono text-n-400 mt-0.5">{fmtDateTime(n.at)}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  placeholder="Escrever uma nota interna..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" icon={Plus} loading={savingNote} disabled={!noteText.trim()} onClick={handleAddNote}>
                  Adicionar nota
                </Button>
              </div>
            </div>

            {/* Historico de contactos */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-mono uppercase tracking-wide text-n-400">Historico de contactos</p>
                {!contactForm.open && (
                  <Button variant="ghost" size="sm" icon={Plus} onClick={() => setContactForm(p => ({ ...p, open: true }))}>
                    Registar contacto
                  </Button>
                )}
              </div>

              {contactForm.open && (
                <div className="bg-n-50 rounded-sm p-3 mb-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select label="Tipo" value={contactForm.type} onChange={e => setContactForm(p => ({ ...p, type: e.target.value }))}>
                      {Object.entries(CONTACT_TYPE_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                    </Select>
                    <Input label="Data" type="date" value={contactForm.date} onChange={e => setContactForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <Textarea
                    label="Resultado / notas"
                    rows={2}
                    value={contactForm.notes}
                    onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="O que foi discutido, proximos passos..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setContactForm({ open: false, type: 'telefone', date: new Date().toISOString().slice(0, 10), notes: '' })}>
                      Cancelar
                    </Button>
                    <Button size="sm" loading={savingContact} onClick={handleAddContact}>Guardar contacto</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(selectedLead.contact_log || []).length === 0 ? (
                  <p className="text-xs font-body text-n-400">Ainda sem contactos registados.</p>
                ) : (
                  [...(selectedLead.contact_log || [])].reverse().map((c, i) => {
                    const cfg = CONTACT_TYPE_CONFIG[c.type] || { label: c.type, icon: MessageSquare };
                    const Icon = cfg.icon;
                    return (
                      <div key={i} className="flex items-start gap-2.5 bg-n-50 rounded-sm px-3 py-2">
                        <div className="w-7 h-7 rounded-sm bg-white border border-n-200 flex items-center justify-center shrink-0">
                          <Icon size={14} strokeWidth={1.75} className="text-ocean-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-body text-n-700">
                            <span className="font-semibold">{cfg.label}</span> · <span className="font-mono text-xs text-n-500">{c.date}</span>
                          </p>
                          {c.notes && <p className="text-xs font-body text-n-500 mt-0.5">{c.notes}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Timeline de actividade */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Timeline de actividade</p>
              <div className="space-y-0">
                {timeline.map((item, i) => (
                  <div key={i} className="flex gap-3 text-xs font-body">
                    <div className="flex flex-col items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-ocean-700 mt-1.5" />
                      {i < timeline.length - 1 && <span className="w-px flex-1 bg-n-200" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-n-700">{item.text}</p>
                      <p className="font-mono text-n-400">{fmtDateTime(item.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal enviar email */}
      <Modal
        open={!!emailModal}
        onClose={() => setEmailModal(null)}
        title={`Enviar email — ${emailModal?.nome_negocio || emailModal?.nome || emailModal?.email || ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEmailModal(null)}>Cancelar</Button>
            <Button
              icon={emailSentOk ? Check : Send}
              loading={sendingEmail}
              onClick={handleSendEmail}
              disabled={!emailForm.subject.trim() || !emailForm.body.trim()}
              className={emailSentOk ? 'text-[#1A7A4A]' : ''}
            >
              {emailSentOk ? 'Enviado' : 'Enviar'}
            </Button>
          </>
        }
      >
        {emailModal && (
          <div className="space-y-4">
            <p className="text-xs font-body text-n-500">Para: <span className="font-mono text-n-700">{emailModal.email}</span></p>

            <Select label="Modelo" value={emailForm.template} onChange={e => applyTemplate(e.target.value)}>
              <option value="">Escrever do zero...</option>
              {Object.entries(EMAIL_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </Select>

            <Input
              label="Assunto"
              value={emailForm.subject}
              onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))}
            />

            <Textarea
              label="Mensagem"
              value={emailForm.body}
              onChange={e => setEmailForm(p => ({ ...p, body: e.target.value }))}
              rows={9}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

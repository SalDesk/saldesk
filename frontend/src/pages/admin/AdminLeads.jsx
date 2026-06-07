import { useState, useMemo, useEffect } from 'react';
import { Download, Search, ChevronUp, Mail, ArrowRightCircle, Send, Check } from 'lucide-react';
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

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'convertido');

const TYPE_LABELS = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

const SCORE_LABELS = {
  tipo_negocio:   'Tipo de negocio',
  volume:         'Volume mensal',
  anos_operacao:  'Anos de operacao',
  tem_site:       'Tem site proprio',
  usa_otas:       'Usa OTAs',
  recencia:       'Recencia da candidatura',
};

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-[var(--success)]' : score >= 40 ? 'bg-sand-500' : 'bg-n-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-n-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold text-n-600">{score}</span>
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
  contacto_inicial: {
    label: 'Contacto inicial',
    subject: 'SalDesk — vamos simplificar a gestao do seu negocio',
    body:
      'Ola {{nome}},\n\n' +
      'Obrigado pelo seu interesse na SalDesk. Vimos que tem um negocio de {{tipo}} na Ilha do Sal e ' +
      'gostariamos de mostrar como a nossa plataforma pode ajudar a centralizar reservas, equipa e pagamentos num unico lugar.\n\n' +
      'Tem disponibilidade para uma demonstracao de 20 minutos esta semana?\n\n' +
      'Cumprimentos,\nEquipa SalDesk',
  },
  agendar_demo: {
    label: 'Agendar demonstracao',
    subject: 'SalDesk — vamos agendar a sua demonstracao?',
    body:
      'Ola {{nome}},\n\n' +
      'Obrigado pela conversa. Para avancarmos, indique 2-3 horarios que lhe sejam convenientes nos proximos dias ' +
      'e confirmamos a demonstracao da plataforma SalDesk adaptada ao seu negocio.\n\n' +
      'Aguardamos a sua resposta.\n\nCumprimentos,\nEquipa SalDesk',
  },
  follow_up: {
    label: 'Seguimento (follow-up)',
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

export default function AdminLeads() {
  const [leads,    setLeads]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [sortScore,    setSortScore]    = useState(false);

  const [selectedLead, setSelectedLead] = useState(null);
  const [editForm,     setEditForm]     = useState({ status: '', notes: '' });
  const [saving,       setSaving]       = useState(false);
  const [converting,   setConverting]   = useState(false);

  const [emailModal, setEmailModal] = useState(null);
  const [emailForm,  setEmailForm]  = useState({ template: '', subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentOk,  setEmailSentOk]  = useState(false);

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
    setEditForm({ status: lead.computed_status || 'novo', notes: lead.notes_internal || '' });
  }

  function applyLeadUpdate(updated) {
    setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
    setSelectedLead(prev => (prev && prev.id === updated.id) ? { ...prev, ...updated } : prev);
  }

  async function handleSave() {
    if (!selectedLead) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/leads/${selectedLead.id}`, {
        status: editForm.status,
        notes:  editForm.notes,
      });
      applyLeadUpdate(data.data);
    } catch {} finally { setSaving(false); }
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
      ), width: '100px',
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
          <Button variant="secondary" size="sm" icon={Download} onClick={() => exportCsv(displayed)}>
            Exportar CSV
          </Button>
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

      <Card padding="p-0">
        <Table columns={columns} rows={displayed} loading={loading} />
      </Card>

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
            <Button variant="secondary" size="sm" onClick={() => setSelectedLead(null)}>Cancelar</Button>
            <Button size="sm" loading={saving} onClick={handleSave}>Guardar</Button>
          </div>
        }
      >
        {selectedLead && (
          <div className="space-y-5">
            {/* Resumo + score */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-display font-bold text-n-900">{selectedLead.nome_negocio || selectedLead.nome}</p>
                <p className="text-xs font-body text-n-500">{selectedLead.email} · {selectedLead.telefone || selectedLead.whatsapp || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={(STATUS_CONFIG[selectedLead.computed_status] || STATUS_CONFIG.novo).badge}>
                  {(STATUS_CONFIG[selectedLead.computed_status] || STATUS_CONFIG.novo).label}
                </Badge>
                <ScoreBar score={selectedLead.score || 0} />
              </div>
            </div>

            {/* Score breakdown */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Composicao do score</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

            {/* Historico de contacto */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-n-400 mb-1.5">Historico</p>
              <div className="space-y-1 text-xs font-body text-n-600">
                <p>Candidatura recebida em <span className="font-mono text-n-500">{selectedLead.created_at?.split('T')[0]}</span></p>
                {selectedLead.contacted_at && <p>Primeiro contacto em <span className="font-mono text-n-500">{selectedLead.contacted_at.split('T')[0]}</span></p>}
                {selectedLead.converted_at && <p>Convertido em operador em <span className="font-mono text-n-500">{selectedLead.converted_at.split('T')[0]}</span></p>}
                {!selectedLead.contacted_at && !selectedLead.converted_at && <p className="text-n-400">Ainda sem registo de contacto.</p>}
              </div>
            </div>

            {/* Estado + notas internas */}
            <Select label="Estado" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
              {STATUS_OPTIONS.map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              <option value="convertido" disabled>{STATUS_CONFIG.convertido.label} (usar botao "Converter")</option>
            </Select>

            <Textarea
              label="Notas internas (visiveis apenas para a equipa SalDesk)"
              value={editForm.notes}
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Adicionar contexto sobre este lead..."
              rows={3}
            />
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

            <Select label="Modelo (opcional)" value={emailForm.template} onChange={e => applyTemplate(e.target.value)}>
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

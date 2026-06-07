import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, TrendingUp, Clock, Users, Flame } from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const STAGE_LABELS = {
  novo:              'Novo',
  contactado:        'Contactado',
  demo_agendada:     'Demo agendada',
  proposta_enviada:  'Proposta enviada',
  convertido:        'Convertido',
  descartado:        'Descartado',
};
const STAGE_BADGE = {
  novo: 'pending', contactado: 'info', demo_agendada: 'pending',
  proposta_enviada: 'info', convertido: 'confirmed', descartado: 'cancelled',
};
const FUNNEL_ORDER = ['novo', 'contactado', 'demo_agendada', 'proposta_enviada', 'convertido'];
const TYPE_LABELS  = { activity: 'Actividade', hotel: 'Hotel', rentacar: 'Rent-a-car', restaurant: 'Restaurante' };

function scoreColor(score) {
  return score > 70 ? 'text-[var(--success)]' : score >= 40 ? 'text-[var(--warning)]' : 'text-[var(--error)]';
}

function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
        <Icon size={20} strokeWidth={1.75} className="text-ocean-700" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-xl text-n-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs font-body text-n-400 truncate">{label}</p>
        {sub && <p className="text-xs font-body text-n-500">{sub}</p>}
      </div>
    </div>
  );
}

function exportPipelineCsv(stats, leads) {
  const lines = [];
  lines.push('Relatorio de Pipeline Comercial — SalDesk');
  lines.push(`Gerado em,${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('Fase,Total de leads,Tempo medio (dias),Taxa de conversao (%)');
  (stats?.conversion_by_stage || []).forEach(s => {
    lines.push(`"${STAGE_LABELS[s.stage] || s.stage}",${stats.by_stage?.[s.stage] ?? 0},${stats.avg_days_per_stage?.[s.stage] ?? '—'},${s.rate}`);
  });
  lines.push('');
  lines.push('Leads com maior probabilidade de fechar');
  lines.push('Nome,Negocio,Tipo,Score,Estado,Data de entrada');
  (stats?.top_leads || []).forEach(l => {
    lines.push(`"${l.nome || ''}","${l.nome_negocio || ''}","${TYPE_LABELS[l.tipo_negocio] || l.tipo_negocio || ''}",${l.score},"${STAGE_LABELS[l.status] || l.status}","${(l.created_at || '').slice(0, 10)}"`);
  });
  lines.push('');
  lines.push('Leads filtrados');
  lines.push('Nome,Negocio,Tipo,Score,Estado,Data de entrada');
  leads.forEach(l => {
    lines.push(`"${l.nome || ''}","${l.nome_negocio || ''}","${TYPE_LABELS[l.tipo_negocio] || l.tipo_negocio || ''}",${l.score || 0},"${STAGE_LABELS[l.computed_status] || l.computed_status}","${(l.created_at || '').slice(0, 10)}"`);
  });

  const csv  = lines.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `pipeline-comercial-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPipeline() {
  const navigate = useNavigate();
  const { user }  = useAuthStore();

  const [stats,   setStats]   = useState(null);
  const [leads,   setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState('');
  const [minScore,   setMinScore]   = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [responsavel, setResponsavel] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/admin/pipeline/stats'),
      api.get('/admin/leads'),
    ]).then(([statsRes, leadsRes]) => {
      setStats(statsRes.data.data);
      setLeads(leadsRes.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredLeads = useMemo(() => {
    let rows = leads;
    if (filterType) rows = rows.filter(l => l.tipo_negocio === filterType);
    if (minScore !== '') rows = rows.filter(l => (l.score || 0) >= Number(minScore));
    if (dateFrom) rows = rows.filter(l => l.created_at && l.created_at.slice(0, 10) >= dateFrom);
    if (dateTo)   rows = rows.filter(l => l.created_at && l.created_at.slice(0, 10) <= dateTo);
    /* "responsavel" — leads ainda nao sao atribuidos a membros de equipa; o fundador e o unico responsavel actual */
    if (responsavel && responsavel !== (user?.email || '')) rows = [];
    return [...rows].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [leads, filterType, minScore, dateFrom, dateTo, responsavel, user]);

  const hasFilters = filterType || minScore !== '' || dateFrom || dateTo || responsavel;

  const totalActive = stats ? (stats.total - (stats.by_stage?.convertido || 0) - (stats.by_stage?.descartado || 0)) : 0;
  const conversionRate = stats?.total
    ? Math.round(((stats.by_stage?.convertido || 0) / stats.total) * 1000) / 10
    : 0;
  const maxStageCount = stats ? Math.max(1, ...FUNNEL_ORDER.map(s => stats.by_stage?.[s] || 0)) : 1;

  return (
    <div>
      <PageHeader
        title="Pipeline Comercial"
        subtitle="Vista detalhada do funil de conversao de leads em operadores"
        actions={
          <Button variant="secondary" size="sm" icon={Download} onClick={() => exportPipelineCsv(stats, filteredLeads)} disabled={!stats}>
            Exportar relatorio
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiCard icon={Users}      label="Leads no pipeline"       value={stats?.total ?? 0} sub={`${totalActive} activos`} />
            <KpiCard icon={TrendingUp} label="Taxa de conversao geral" value={`${conversionRate}%`} sub="leads -> operadores" />
            <KpiCard icon={Clock}      label="Tempo medio ate demo"    value={stats?.avg_days_per_stage?.contactado != null ? `${stats.avg_days_per_stage.contactado}d` : '—'} sub="em fase 'Contactado'" />
            <KpiCard icon={Flame}      label="Leads com alta prioridade" value={(stats?.top_leads || []).filter(l => l.score > 70).length} sub="score acima de 70" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            {/* Funil de conversao */}
            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Funil de conversao por fase</h3>} padding="px-5 pb-5 pt-3">
              <div className="space-y-3">
                {FUNNEL_ORDER.map(stage => {
                  const count = stats?.by_stage?.[stage] || 0;
                  const conv  = (stats?.conversion_by_stage || []).find(c => c.stage === stage);
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between text-xs font-body mb-1">
                        <span className="font-semibold text-n-700">{STAGE_LABELS[stage]}</span>
                        <span className="text-n-500">{count} leads · <span className="font-mono font-semibold text-ocean-700">{conv?.rate ?? 0}%</span> alcancaram</span>
                      </div>
                      <div className="h-2.5 bg-n-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-ocean-700" style={{ width: `${(count / maxStageCount) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Tempo medio por fase */}
            <Card header={<h3 className="font-display font-semibold text-sm text-n-700">Tempo medio em cada fase</h3>} padding="px-5 pb-5 pt-3">
              <div className="space-y-2">
                {Object.keys(STAGE_LABELS).map(stage => {
                  const days = stats?.avg_days_per_stage?.[stage];
                  return (
                    <div key={stage} className="flex items-center justify-between px-3 py-2 bg-n-50 rounded-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={STAGE_BADGE[stage]}>{STAGE_LABELS[stage]}</Badge>
                        <span className="text-xs font-body text-n-500">{stats?.by_stage?.[stage] ?? 0} leads</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-n-700">{days != null ? `${days}d` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Leads com maior probabilidade de fechar */}
          <Card
            header={<h3 className="font-display font-semibold text-sm text-n-700">Leads com maior probabilidade de fechar</h3>}
            padding="p-0"
          >
            {(stats?.top_leads || []).length === 0 ? (
              <p className="text-xs font-body text-n-400 px-5 py-6 text-center">Sem leads activos no momento.</p>
            ) : (
              <div className="divide-y divide-n-100">
                {stats.top_leads.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate('/admin/leads')}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-n-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-n-900 truncate">{l.nome_negocio || l.nome}</p>
                      <p className="text-xs text-n-400">{TYPE_LABELS[l.tipo_negocio] || l.tipo_negocio} · entrou em {l.created_at?.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={STAGE_BADGE[l.status]}>{STAGE_LABELS[l.status]}</Badge>
                      <span className={`font-display font-bold text-lg ${scoreColor(l.score)}`}>{l.score}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Filtros + relatorio detalhado */}
          <div className="mt-2 mb-3">
            <h2 className="font-display font-bold text-lg text-n-900">Relatorio detalhado</h2>
            <p className="text-sm font-body text-n-500">{filteredLeads.length} leads correspondem aos filtros</p>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-44">
              <option value="">Todos os tipos de negocio</option>
              <option value="activity">Actividade</option>
              <option value="hotel">Hotel</option>
              <option value="rentacar">Rent-a-car</option>
              <option value="restaurant">Restaurante</option>
            </Select>
            <Input type="number" min="0" max="100" placeholder="Score minimo" value={minScore} onChange={e => setMinScore(e.target.value)} className="w-32" />
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
            <Select value={responsavel} onChange={e => setResponsavel(e.target.value)} className="w-48">
              <option value="">Todos os responsaveis</option>
              {user?.email && <option value={user.email}>{user.email} (fundador)</option>}
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterType(''); setMinScore(''); setDateFrom(''); setDateTo(''); setResponsavel(''); }}>
                Limpar filtros
              </Button>
            )}
          </div>

          <Card padding="p-0">
            {filteredLeads.length === 0 ? (
              <p className="text-xs font-body text-n-400 px-5 py-6 text-center">Nenhum lead corresponde aos filtros seleccionados.</p>
            ) : (
              <div className="divide-y divide-n-100">
                {filteredLeads.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate('/admin/leads')}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-n-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-n-900 truncate">{l.nome_negocio || l.nome || l.email}</p>
                      <p className="text-xs text-n-400">{TYPE_LABELS[l.tipo_negocio] || l.tipo_negocio} · entrou em {l.created_at?.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={STAGE_BADGE[l.computed_status]}>{STAGE_LABELS[l.computed_status]}</Badge>
                      <span className={`font-mono text-sm font-bold ${scoreColor(l.score || 0)}`}>{l.score || 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

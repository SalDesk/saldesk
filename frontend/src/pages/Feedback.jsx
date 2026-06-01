import { useState, useEffect, useMemo } from 'react';
import {
  ThumbsUp, Star, Send, RefreshCw, Save,
  BarChart2, Clock, TrendingUp, CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import { listReservations } from '../services/reservationsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input, { Textarea } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/* ── localStorage template ── */
const TPL_KEY = 'saldesk_review_template_v1';
const DEFAULT_TEMPLATE = {
  subject_pt: 'Como correu o seu tour? Deixe a sua avaliacao',
  subject_en: 'How was your tour? Leave your review',
  body_pt:    'Ola {nome_cliente},\n\nEsperamos que tenha gostado do seu tour {nome_tour}!\n\nA sua opiniao e muito importante para nos e para futuros clientes.\nClique no link abaixo para deixar a sua avaliacao:\n\n→ {link_avaliacao}\n\nObrigado pela sua confianca!\n',
  body_en:    'Hello {nome_cliente},\n\nWe hope you enjoyed your {nome_tour} tour!\n\nYour feedback is very important to us and future guests.\nClick the link below to leave your review:\n\n→ {link_avaliacao}\n\nThank you for your trust!\n',
};

function loadTemplate() {
  try { return { ...DEFAULT_TEMPLATE, ...JSON.parse(localStorage.getItem(TPL_KEY) || '{}') }; }
  catch { return DEFAULT_TEMPLATE; }
}
function saveTemplate(t) { localStorage.setItem(TPL_KEY, JSON.stringify(t)); }

const TEMPLATE_VARS = [
  { key: '{nome_cliente}',  desc: 'Nome do cliente'            },
  { key: '{nome_tour}',     desc: 'Nome do tour'               },
  { key: '{link_avaliacao}', desc: 'Link directo para avaliacao' },
];

/* ── Helpers ── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T00:00:00Z' : '')).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StarRating({ value }) {
  const n = Math.round(Number(value) || 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12} strokeWidth={1.75}
          className={i <= n ? 'text-sand-500 fill-sand-400' : 'text-n-300'} />
      ))}
      <span className="text-xs font-mono text-n-600 ml-1">{Number(value).toFixed(1)}</span>
    </div>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Feedback() {
  const [activeTab,   setActiveTab]   = useState('tours');
  const [reservations, setReservations] = useState([]);
  const [reviews,     setReviews]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState({});
  const [template,    setTemplate]    = useState(loadTemplate);
  const [tplSaved,    setTplSaved]    = useState(false);
  const [previewLang, setPreviewLang] = useState('pt');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listReservations({ status: 'checked_out' }).catch(() => []),
      api.get('/reviews').then(r => r.data.data || []).catch(() => []),
    ]).then(([res, rev]) => {
      setReservations(res || []);
      setReviews(rev || []);
    }).finally(() => setLoading(false));
  }, []);

  /* Group reservations by unit */
  const tourStats = useMemo(() => {
    const map = {};
    (reservations || []).forEach(r => {
      const key  = r.unit_id || 'unknown';
      const name = r.units?.name || r.unit_name || 'Servico sem nome';
      if (!map[key]) map[key] = { unit_id: key, unit_name: name, reservations: [], reviews: [] };
      map[key].reservations.push(r);
    });
    (reviews || []).forEach(rv => {
      const res  = reservations.find(r => r.id === rv.reservation_id);
      const key  = res?.unit_id || 'unknown';
      if (map[key]) map[key].reviews.push(rv);
    });
    return Object.values(map).map(t => {
      const total    = t.reservations.length;
      const received = t.reviews.length;
      const avgRating = received > 0
        ? t.reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / received
        : 0;
      const rate = total > 0 ? Math.round((received / total) * 100) : 0;
      return { ...t, total, received, avgRating, rate };
    }).sort((a, b) => b.total - a.total);
  }, [reservations, reviews]);

  /* Reservations without review */
  const pendingReview = useMemo(() => {
    const reviewedIds = new Set((reviews || []).map(r => r.reservation_id));
    return (reservations || [])
      .filter(r => !reviewedIds.has(r.id))
      .sort((a, b) => new Date(b.check_out || 0) - new Date(a.check_out || 0));
  }, [reservations, reviews]);

  async function handleResend(reservationId) {
    setSending(p => ({ ...p, [reservationId]: true }));
    try {
      await api.post('/reviews/request', { reservation_id: reservationId });
    } catch (err) { console.error(err); }
    finally { setSending(p => ({ ...p, [reservationId]: false })); }
  }

  function handleSaveTemplate() {
    saveTemplate(template);
    setTplSaved(true);
    setTimeout(() => setTplSaved(false), 2000);
  }

  /* Global stats */
  const totalCompleted  = reservations.length;
  const totalReviews    = reviews.length;
  const globalRate      = totalCompleted > 0 ? Math.round((totalReviews / totalCompleted) * 100) : 0;
  const globalAvg       = totalReviews > 0
    ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / totalReviews
    : 0;

  const TABS = [
    { key: 'tours',   label: 'Por Tour',  Icon: BarChart2  },
    { key: 'pending', label: `Pendentes (${pendingReview.length})`, Icon: Send },
    { key: 'template', label: 'Template', Icon: ThumbsUp },
  ];

  return (
    <div>
      <PageHeader
        title="Feedback Pos-Tour"
        subtitle="Gestao de avaliacoes e pedidos de feedback"
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm"
            onClick={() => { setLoading(true); window.location.reload(); }}>
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Tours realizados',  value: totalCompleted,               icon: CheckCircle2, color: 'text-n-900'     },
          { label: 'Avaliacoes recebidas', value: totalReviews,              icon: Star,         color: 'text-sand-500'  },
          { label: 'Taxa de resposta',  value: `${globalRate}%`,             icon: TrendingUp,   color: 'text-ocean-700' },
          { label: 'Media geral',       value: globalAvg > 0 ? globalAvg.toFixed(1) + ' / 5' : '—', icon: BarChart2, color: 'text-[#1A7A4A]' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-md border border-n-200 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-ocean-50 flex items-center justify-center shrink-0">
              <m.icon size={16} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div>
              <p className={`font-display font-bold text-xl ${m.color}`}>{m.value}</p>
              <p className="text-xs font-body text-n-500">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-n-200 mb-5">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : activeTab === 'tours' ? (
        <div className="space-y-3">
          {tourStats.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <BarChart2 size={32} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
                <p className="font-body text-n-500">Sem tours com checkout registado.</p>
              </div>
            </Card>
          ) : tourStats.map(t => (
            <Card key={t.unit_id} padding="px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-n-900 truncate">{t.unit_name}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    <span className="text-xs font-body text-n-500">
                      <span className="font-semibold text-n-700">{t.total}</span> tours realizados
                    </span>
                    <span className="text-xs font-body text-n-500">
                      <span className="font-semibold text-n-700">{t.received}</span> avaliacoes
                    </span>
                    {t.received > 0 && <StarRating value={t.avgRating} />}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-display font-bold text-2xl ${t.rate >= 50 ? 'text-[#1A7A4A]' : t.rate >= 25 ? 'text-yellow-700' : 'text-error'}`}>
                    {t.rate}%
                  </p>
                  <p className="text-xs font-body text-n-400">taxa resposta</p>
                </div>
              </div>
              {/* Rate bar */}
              <div className="mt-3 h-1.5 bg-n-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${t.rate}%`,
                    backgroundColor: t.rate >= 50 ? '#1A7A4A' : t.rate >= 25 ? '#D97706' : '#B91C1C',
                  }} />
              </div>
            </Card>
          ))}
        </div>

      ) : activeTab === 'pending' ? (
        <div className="space-y-3">
          {pendingReview.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <CheckCircle2 size={32} strokeWidth={1.25} className="mx-auto mb-3 text-[#1A7A4A]" />
                <p className="font-body text-n-500">Todos os tours tem avaliacao solicitada.</p>
              </div>
            </Card>
          ) : (
            <>
              <p className="text-xs font-body text-n-500">
                {pendingReview.length} reserva(s) sem pedido de avaliacao enviado.
              </p>
              <Card padding="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-n-200">
                        {['Cliente', 'Tour', 'Checkout', 'Dias desde checkout', ''].map(h => (
                          <th key={h} className="text-left py-2.5 px-4 text-xs font-mono uppercase tracking-wider text-n-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-n-100">
                      {pendingReview.slice(0, 50).map(r => {
                        const days = r.check_out
                          ? Math.floor((Date.now() - new Date(r.check_out + 'T00:00:00Z').getTime()) / (1000 * 60 * 60 * 24))
                          : null;
                        const isSending = sending[r.id];
                        return (
                          <tr key={r.id} className="hover:bg-n-50 transition-colors">
                            <td className="py-3 px-4 font-body font-semibold text-n-900 whitespace-nowrap">
                              {r.customers?.first_name || r.customer_name || '—'} {r.customers?.last_name || ''}
                            </td>
                            <td className="py-3 px-4 font-body text-n-600 max-w-[160px] truncate">
                              {r.units?.name || r.unit_name || '—'}
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-n-500 whitespace-nowrap">
                              {fmtDate(r.check_out)}
                            </td>
                            <td className="py-3 px-4">
                              {days != null ? (
                                <span className={`text-xs font-mono font-semibold ${days > 7 ? 'text-error' : days > 3 ? 'text-yellow-700' : 'text-n-600'}`}>
                                  {days}d
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-3 px-4">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={isSending ? RefreshCw : Send}
                                loading={isSending}
                                onClick={() => handleResend(r.id)}
                              >
                                Reenviar pedido
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {pendingReview.length > 50 && (
                    <p className="text-xs font-body text-n-400 text-center py-3">A mostrar 50 de {pendingReview.length}</p>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>

      ) : activeTab === 'template' ? (
        <div className="space-y-5">
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">Template do pedido de avaliacao</h3>

            {/* Variables */}
            <div className="mb-4">
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">Variaveis disponiveis</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARS.map(v => (
                  <button key={v.key} type="button"
                    onClick={() => setTemplate(p => ({ ...p, body_pt: p.body_pt + v.key }))}
                    title={v.desc}
                    className="text-xs font-mono px-2 py-0.5 rounded-xs bg-ocean-50 text-ocean-700 border border-ocean-100 hover:bg-ocean-100 transition-colors">
                    {v.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Input label="Assunto PT" value={template.subject_pt}
                  onChange={e => setTemplate(p => ({ ...p, subject_pt: e.target.value }))} />
                <Textarea label="Corpo PT" value={template.body_pt} rows={8}
                  onChange={e => setTemplate(p => ({ ...p, body_pt: e.target.value }))} />
                <Input label="Assunto EN" value={template.subject_en}
                  onChange={e => setTemplate(p => ({ ...p, subject_en: e.target.value }))} />
                <Textarea label="Corpo EN" value={template.body_en} rows={8}
                  onChange={e => setTemplate(p => ({ ...p, body_en: e.target.value }))} />
                <Button icon={tplSaved ? CheckCircle2 : Save} onClick={handleSaveTemplate}
                  className={tplSaved ? 'bg-[#1A7A4A] hover:bg-[#15623c]' : ''}>
                  {tplSaved ? 'Guardado' : 'Guardar template'}
                </Button>
              </div>

              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">Preview</p>
                <div className="flex gap-1 mb-3">
                  {['pt', 'en'].map(l => (
                    <button key={l} onClick={() => setPreviewLang(l)}
                      className={`text-xs px-2.5 py-1 rounded-xs font-mono transition-colors ${previewLang === l ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'}`}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="border border-n-200 rounded-md overflow-hidden">
                  <div className="bg-ocean-900 px-4 py-2.5">
                    <p className="text-white text-[11px] font-display font-semibold">SalDesk Tours</p>
                    <p className="text-ocean-300 text-[11px] font-mono mt-0.5">
                      Assunto: {previewLang === 'pt' ? template.subject_pt : template.subject_en}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <pre className="text-xs font-body text-n-700 whitespace-pre-wrap leading-relaxed">
                      {(previewLang === 'pt' ? template.body_pt : template.body_en)
                        .replace('{nome_cliente}', 'Maria Santos')
                        .replace('{nome_tour}', 'Kitesurf Lesson')
                        .replace('{link_avaliacao}', 'https://saldesk.cv/review/...')}
                    </pre>
                  </div>
                  <div className="bg-n-50 px-4 py-2 border-t border-n-100">
                    <p className="text-[10px] font-mono text-n-400">Preview com dados de exemplo.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

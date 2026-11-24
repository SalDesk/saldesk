import { useState, useEffect, useMemo } from 'react';
import {
  Star, Send, RefreshCw, Save,
  BarChart2, TrendingUp, CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import { listReservations } from '../services/reservationsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Table from '../components/ui/Table';
import EmptyState from '../components/ui/EmptyState';
import Input, { Textarea } from '../components/ui/Input';
import Toggle from '../components/ui/Toggle';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { formatarData } from '../utils/formatoLingua';
import { formatarNota } from '../utils/formatoNota';

/* Texto enviado ao cliente: fica em portugues e ingles em qualquer lingua do painel (so as etiquetas do
   editor se traduzem). Parecido com o DEFAULT_TEMPLATE do backend (helpers/pedidoAvaliacao.js): texto neutro, serve
   actividades, hoteis, rent-a-car e restaurantes. Esta copia do frontend tem acentos; a do
   backend ainda nao. */
const DEFAULT_TEMPLATE = {
  subject_pt: 'Como correu? Deixe a sua avaliação',
  subject_en: 'How was it? Leave your review',
  body_pt:    'Olá {nome_cliente},\n\nObrigado por ter escolhido {nome_tour}. Esperamos que tenha corrido bem!\n\nA sua opinião ajuda-nos e ajuda outros viajantes a escolher. Demora menos de um minuto:\n\n{link_avaliacao}\n\nObrigado!',
  body_en:    'Hello {nome_cliente},\n\nThank you for choosing {nome_tour}. We hope you had a great time!\n\nYour opinion helps us and helps other travellers choose. It takes less than a minute:\n\n{link_avaliacao}\n\nThank you!',
};

const TEMPLATE_VARS = [
  { key: '{nome_cliente}',   id: 'customerName' },
  { key: '{nome_tour}',      id: 'tourName'     },
  { key: '{link_avaliacao}', id: 'reviewLink'   },
];

/* ── Helpers ── */
function fmtDate(d) {
  if (!d) return '—';
  return formatarData(new Date(d + (d.length === 10 ? 'T00:00:00Z' : '')), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function StarRating({ value }) {
  const n = Math.round(Number(value) || 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12} strokeWidth={1.75}
          className={i <= n ? 'text-sand-500 fill-sand-400' : 'text-n-300'} />
      ))}
      <span className="text-xs font-mono text-n-600 ml-1">{formatarNota(value)}</span>
    </div>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Feedback() {
  const t = useT();
  const [activeTab,   setActiveTab]   = useState('tours');
  const [reservations, setReservations] = useState([]);
  const [reviews,     setReviews]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState({});
  const [template,    setTemplate]    = useState(DEFAULT_TEMPLATE);
  const [tplSaving,   setTplSaving]   = useState(false);
  const [tplSaved,    setTplSaved]    = useState(false);
  const [previewLang, setPreviewLang] = useState('pt');
  /* pedido automatico de avaliacao (ligado por omissao no servidor) */
  const [automatico,  setAutomatico]  = useState(true);
  const [autoErro,    setAutoErro]    = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listReservations({ status: 'checked_out' }).catch(() => []),
      api.get('/reviews').then(r => r.data.data || []).catch(() => []),
      api.get('/reviews/template').then(r => r.data.data).catch(() => DEFAULT_TEMPLATE),
      api.get('/reviews/settings').then(r => r.data.data?.review_auto_request !== false).catch(() => true),
    ]).then(([res, rev, tpl, auto]) => {
      setReservations(res || []);
      setReviews(rev || []);
      setTemplate({ ...DEFAULT_TEMPLATE, ...tpl });
      setAutomatico(auto);
    }).finally(() => setLoading(false));
  }, []);

  /* Group reservations by unit */
  const tourStats = useMemo(() => {
    const map = {};
    (reservations || []).forEach(r => {
      const key  = r.unit_id || 'unknown';
      const name = r.units?.name || r.unit_name || null;
      if (!map[key]) map[key] = { unit_id: key, unit_name: name, reservations: [], reviews: [] };
      map[key].reservations.push(r);
    });
    (reviews || []).forEach(rv => {
      const res  = reservations.find(r => r.id === rv.reservation_id);
      const key  = res?.unit_id || 'unknown';
      if (map[key]) map[key].reviews.push(rv);
    });
    return Object.values(map).map(g => {
      const total    = g.reservations.length;
      const received = g.reviews.length;
      const avgRating = received > 0
        ? g.reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / received
        : 0;
      const rate = total > 0 ? Math.round((received / total) * 100) : 0;
      return { ...g, total, received, avgRating, rate };
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

  async function handleAutomatico(valor) {
    const antes = automatico;
    setAutomatico(valor);
    setAutoErro(false);
    try {
      await api.put('/reviews/settings', { review_auto_request: valor });
    } catch {
      setAutomatico(antes);
      setAutoErro(true);
    }
  }

  async function handleSaveTemplate() {
    setTplSaving(true);
    try {
      await api.put('/reviews/template', template);
      setTplSaved(true);
      setTimeout(() => setTplSaved(false), 2000);
    } finally {
      setTplSaving(false);
    }
  }

  /* Global stats */
  const totalCompleted  = reservations.length;
  const totalReviews    = reviews.length;
  const globalRate      = totalCompleted > 0 ? Math.round((totalReviews / totalCompleted) * 100) : 0;
  const globalAvg       = totalReviews > 0
    ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / totalReviews
    : 0;

  const TABS = [
    { id: 'tours',    label: t('feedbackPage.tabs.byTour') },
    { id: 'pending',  label: t('feedbackPage.tabs.pending', { count: pendingReview.length }) },
    { id: 'template', label: t('feedbackPage.tabs.template') },
  ];

  // Colunas da lista de reservas sem avaliacao
  const pendingColumns = [
    {
      key: 'cliente',
      label: t('feedbackPage.cols.customer'),
      render: (r) => <span className="font-body font-semibold text-n-900 whitespace-nowrap">{r.customers?.name || r.customer_name || '—'}</span>,
    },
    {
      key: 'tour',
      label: t('feedbackPage.cols.tour'),
      render: (r) => <span className="block font-body text-n-600 max-w-[160px] truncate">{r.units?.name || r.unit_name || '—'}</span>,
    },
    {
      key: 'checkout',
      label: t('feedbackPage.cols.checkout'),
      render: (r) => <span className="text-xs font-mono text-n-500 whitespace-nowrap">{fmtDate(r.check_out)}</span>,
    },
    {
      key: 'dias',
      label: t('feedbackPage.cols.daysSince'),
      render: (r) => {
        const days = r.check_out
          ? Math.floor((Date.now() - new Date(r.check_out + 'T00:00:00Z').getTime()) / (1000 * 60 * 60 * 24))
          : null;
        return days != null ? (
          <span className={`text-xs font-mono font-semibold ${days > 7 ? 'text-[var(--error)]' : days > 3 ? 'text-[var(--warning)]' : 'text-n-600'}`}>
            {days}d
          </span>
        ) : '—';
      },
    },
    {
      key: 'acoes',
      label: '',
      render: (r) => {
        const isSending = sending[r.id];
        return (
          <Button
            size="sm"
            variant="secondary"
            icon={isSending ? RefreshCw : Send}
            loading={isSending}
            onClick={() => handleResend(r.id)}
          >
            {t('feedbackPage.resend')}
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('feedbackPage.title')}
        subtitle={t('feedbackPage.subtitle')}
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm"
            onClick={() => { setLoading(true); window.location.reload(); }}>
            {t('feedbackPage.refresh')}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: t('feedbackPage.kpi.toursDone'),  value: totalCompleted,               icon: CheckCircle2, color: 'text-n-900'     },
          { label: t('feedbackPage.kpi.reviewsReceived'), value: totalReviews,              icon: Star,         color: 'text-sand-500'  },
          { label: t('feedbackPage.kpi.responseRate'),  value: `${globalRate}%`,             icon: TrendingUp,   color: 'text-ocean-700' },
          { label: t('feedbackPage.kpi.average'),       value: globalAvg > 0 ? formatarNota(globalAvg) + ' / 5' : '—', icon: BarChart2, color: 'text-[var(--success)]' },
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
      <div className="mb-5">
        <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : activeTab === 'tours' ? (
        <div className="space-y-3">
          {tourStats.length === 0 ? (
            <Card padding="p-0">
              <EmptyState icon={BarChart2} title={t('feedbackPage.noTours')} />
            </Card>
          ) : tourStats.map(tour => (
            <Card key={tour.unit_id} padding="px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-n-900 truncate">{tour.unit_name || t('feedbackPage.unnamedService')}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    <span className="text-xs font-body text-n-500">
                      <span className="font-semibold text-n-700">{tour.total}</span> {t('feedbackPage.toursDoneSuffix')}
                    </span>
                    <span className="text-xs font-body text-n-500">
                      <span className="font-semibold text-n-700">{tour.received}</span> {t('feedbackPage.reviewsSuffix')}
                    </span>
                    {tour.received > 0 && <StarRating value={tour.avgRating} />}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-display font-bold text-2xl ${tour.rate >= 50 ? 'text-[var(--success)]' : tour.rate >= 25 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>
                    {tour.rate}%
                  </p>
                  <p className="text-xs font-body text-n-400">{t('feedbackPage.rateSuffix')}</p>
                </div>
              </div>
              {/* Rate bar */}
              <div className="mt-3 h-1.5 bg-n-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${tour.rate >= 50 ? 'bg-[var(--success)]' : tour.rate >= 25 ? 'bg-[var(--warning)]' : 'bg-[var(--error)]'}`}
                  style={{ width: `${tour.rate}%` }} />
              </div>
            </Card>
          ))}
        </div>

      ) : activeTab === 'pending' ? (
        <div className="space-y-3">
          {pendingReview.length === 0 ? (
            <Card padding="p-0">
              <EmptyState icon={CheckCircle2} title={t('feedbackPage.allRequested')} />
            </Card>
          ) : (
            <>
              <p className="text-xs font-body text-n-500">
                {t('feedbackPage.pendingNote', { count: pendingReview.length })}
              </p>
              <Card padding="p-0">
                <Table columns={pendingColumns} rows={pendingReview.slice(0, 50)} />
                {pendingReview.length > 50 && (
                  <p className="text-xs font-body text-n-400 text-center py-3">{t('feedbackPage.showing', { shown: 50, total: pendingReview.length })}</p>
                )}
              </Card>
            </>
          )}
        </div>

      ) : activeTab === 'template' ? (
        <div className="space-y-5">
          <Card padding="px-5 py-5">
            <Toggle
              checked={automatico}
              onChange={handleAutomatico}
              label={t('feedbackPage.autoLabel')}
              hint={t('feedbackPage.autoHint')}
            />
            {autoErro && <p className="text-xs font-body text-red-600 mt-2" role="alert">{t('feedbackPage.autoError')}</p>}
          </Card>
          <Card padding="px-5 py-5">
            <h3 className="font-display font-semibold text-sm text-n-700 mb-4">{t('feedbackPage.templateTitle')}</h3>

            {/* Variables */}
            <div className="mb-4">
              <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500 mb-2">{t('feedbackPage.varsTitle')}</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARS.map(v => (
                  <button key={v.key} type="button"
                    onClick={() => setTemplate(p => ({ ...p, body_pt: p.body_pt + v.key }))}
                    title={t(`feedbackPage.vars.${v.id}`)}
                    className="text-xs font-mono px-2 py-0.5 rounded-xs bg-ocean-50 text-ocean-700 border border-ocean-100 hover:bg-ocean-100 transition-colors">
                    {v.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Input label={t('feedbackPage.subjectPt')} value={template.subject_pt}
                  onChange={e => setTemplate(p => ({ ...p, subject_pt: e.target.value }))} />
                <Textarea label={t('feedbackPage.bodyPt')} value={template.body_pt} rows={8}
                  onChange={e => setTemplate(p => ({ ...p, body_pt: e.target.value }))} />
                <Input label={t('feedbackPage.subjectEn')} value={template.subject_en}
                  onChange={e => setTemplate(p => ({ ...p, subject_en: e.target.value }))} />
                <Textarea label={t('feedbackPage.bodyEn')} value={template.body_en} rows={8}
                  onChange={e => setTemplate(p => ({ ...p, body_en: e.target.value }))} />
                <Button icon={tplSaved ? CheckCircle2 : Save} onClick={handleSaveTemplate} loading={tplSaving}
                  className={tplSaved ? '!bg-[var(--success)] !text-white' : ''}>
                  {tplSaved ? t('feedbackPage.saved') : t('feedbackPage.saveTemplate')}
                </Button>
              </div>

              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">{t('feedbackPage.preview')}</p>
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
                      {t('feedbackPage.previewSubject')} {previewLang === 'pt' ? template.subject_pt : template.subject_en}
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
                    <p className="text-[10px] font-mono text-n-400">{t('feedbackPage.sampleNote')}</p>
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

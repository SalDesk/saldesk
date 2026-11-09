import { useState, useEffect, useCallback } from 'react';
import PlanGuard from '../components/PlanGuard';
import { QrCode, Code2, UserPlus, BarChart2 } from 'lucide-react';
import { getBookingLink, getMarketingStats, getWidgetCode, getReferrals } from '../services/marketingService';
import { listUnits } from '../services/unitsService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import { loadPosts, savePosts } from './marketing/shared';
import QrCodeTab from './marketing/QrCodeTab';
import WidgetTab from './marketing/WidgetTab';
import ReferralsTab from './marketing/ReferralsTab';
import StatsTab from './marketing/StatsTab';
import SocialPlanner from './marketing/SocialPlanner';
import PostModal from './marketing/PostModal';

/* "Planeador" escondido por agora (2026-08-21) -- so guarda posts em
   localStorage, nunca publica nada nem persiste no servidor; publicar a
   serio exige integracao OAuth com cada rede social, fora do ambito de um
   fix rapido. Codigo mantido, so a entrada de navegacao removida --
   reactivar quando houver essa integracao real. */
const MKTG_TABS = [
  { key: 'qrcode',     label: 'QR Code',       Icon: QrCode    },
  { key: 'widget',     label: 'Widget',        Icon: Code2     },
  { key: 'referrals',  label: 'Indicacoes',    Icon: UserPlus  },
  { key: 'stats',      label: 'Estatisticas',  Icon: BarChart2 },
];

/* ─────────────────────── Main ─────────────────────── */
export default function Marketing() {
  const { operator } = useAuthStore();
  const slug = operator?.slug;

  const [activeTab,   setActiveTab]   = useState('qrcode');
  const [bookingLink, setBookingLink] = useState('');
  const [widgetCode,  setWidgetCode]  = useState('');
  const [units,       setUnits]       = useState([]);
  const [stats,       setStats]       = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [referrals,   setReferrals]   = useState(null);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [posts,       setPosts]       = useState(loadPosts);
  const [postModal,   setPostModal]   = useState(null);

  useEffect(() => {
    getBookingLink()
      .then(d => setBookingLink(d?.url || d || ''))
      .catch(() => setBookingLink(slug ? `https://saldesk.cv/book/${slug}` : ''));

    getWidgetCode()
      .then(d => setWidgetCode(d?.html || d || ''))
      .catch(() => {});

    getMarketingStats()
      .then(setStats)
      .catch(() => setStats({ profile_views: 0, bookings_direct: 0, conversion_rate: 0, clicks: 0 }))
      .finally(() => setStatsLoading(false));

    listUnits()
      .then(d => setUnits(d || []))
      .catch(() => {});

    getReferrals()
      .then(setReferrals)
      .catch(() => setReferrals({ referral_link: slug ? `https://saldesk.cv/operadores.html?ref=${slug}` : '', referred: [], total: 0, convertidos: 0 }))
      .finally(() => setReferralsLoading(false));
  }, []);

  const savePersist = useCallback(next => {
    setPosts(next);
    savePosts(typeof next === 'function' ? next([]) : next);
  }, []);

  function handleSavePost(p) {
    setPosts(prev => {
      const next = prev.find(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, p];
      savePosts(next);
      return next;
    });
    setPostModal(null);
  }
  function handleAddPost(scheduledAt) {
    setPostModal({ _new: true, scheduled_at: scheduledAt ? `${scheduledAt}T09:00` : '' });
  }

  return (
    <div>
      <PageHeader title="Marketing" subtitle="Ferramentas de divulgacao e planeador de conteudos" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-n-200 mb-6">
        {MKTG_TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key ? 'border-ocean-700 text-ocean-700' : 'border-transparent text-n-500 hover:text-n-700'
            }`}>
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'planeador' && (
        <SocialPlanner
          posts={posts}
          onAdd={handleAddPost}
          onEdit={p => setPostModal(p)}
          onDelete={id => { setPosts(prev => { const n = prev.filter(p => p.id !== id); savePosts(n); return n; }); }}
          onMarkPublished={id => { setPosts(prev => { const n = prev.map(p => p.id === id ? { ...p, status: 'publicado' } : p); savePosts(n); return n; }); }}
        />
      )}

      {activeTab === 'qrcode' && <QrCodeTab slug={slug} units={units} />}

      {activeTab === 'widget' && <WidgetTab widgetCode={widgetCode} slug={slug} />}

      {activeTab === 'referrals' && <ReferralsTab referrals={referrals} loading={referralsLoading} />}

      {activeTab === 'stats' && (
        <StatsTab stats={stats} statsLoading={statsLoading} posts={posts} bookingLink={bookingLink} />
      )}

      {postModal && (
        <PostModal
          post={postModal}
          onSave={handleSavePost}
          onClose={() => setPostModal(null)}
          operatorName={operator?.name}
        />
      )}
    </div>
  );
}

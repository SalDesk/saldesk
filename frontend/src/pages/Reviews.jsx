import { useState, useEffect, useMemo } from 'react';
import { Star, MessageCircle, Send, Filter, ChevronDown, Search } from 'lucide-react';
import api from '../services/api';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input, { Select, Textarea } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const PAGE_SIZE = 10;

/* ── helpers ── */
function StarRow({ rating, max = 5, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} strokeWidth={1.75}
          className={i < rating ? 'text-sand-500 fill-sand-500' : 'text-n-200 fill-n-200'} />
      ))}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Star breakdown bar ── */
function StarBreakdown({ distribution, total }) {
  const dist = [5, 4, 3, 2, 1].map(r => {
    const found = (distribution || []).find(d => Number(d.rating) === r);
    return { rating: r, count: found ? Number(found.count) : 0 };
  });

  return (
    <div className="space-y-2">
      {dist.map(({ rating, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={rating} className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 shrink-0 w-20">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={10} strokeWidth={1.75}
                  className={i < rating ? 'text-sand-500 fill-sand-500' : 'text-n-200 fill-n-200'} />
              ))}
            </div>
            <div className="flex-1 h-2 bg-n-100 rounded-full overflow-hidden">
              <div className="h-full bg-sand-500 rounded-full transition-all"
                style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono text-n-500 w-8 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Review card ── */
function ReviewCard({ review, onReply }) {
  const unitName = review.reservations?.units?.name || review.units?.name;
  const customer = [review.customers?.first_name, review.customers?.last_name].filter(Boolean).join(' ');
  const country  = review.customers?.country_code;

  return (
    <div className="bg-white rounded-md border border-n-200 shadow-sm p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StarRow rating={review.rating} />
            <span className="text-xs font-mono text-n-400">{fmtDate(review.created_at)}</span>
            {review.is_public
              ? <Badge variant="confirmed">Publica</Badge>
              : <Badge variant="default">Privada</Badge>}
            {unitName && (
              <span className="text-xs font-body text-ocean-700 bg-ocean-50 px-2 py-0.5 rounded">
                {unitName}
              </span>
            )}
          </div>

          {/* Comment */}
          {review.comment ? (
            <p className="text-sm font-body text-n-800 leading-relaxed mb-2">{review.comment}</p>
          ) : (
            <p className="text-sm font-body text-n-400 italic mb-2">Sem comentario</p>
          )}

          {/* Customer */}
          <p className="text-xs font-body text-n-500">
            {customer || 'Cliente anonimo'}
            {country && ` · ${country}`}
          </p>

          {/* Existing reply */}
          {review.reply_text && (
            <div className="mt-3 bg-ocean-50 border border-ocean-100 rounded px-3 py-2.5">
              <p className="text-xs font-body font-bold text-ocean-700 mb-1">Resposta do operador</p>
              <p className="text-sm font-body text-n-700 leading-relaxed">{review.reply_text}</p>
              {review.replied_at && (
                <p className="text-xs font-mono text-ocean-400 mt-1">{fmtDate(review.replied_at)}</p>
              )}
            </div>
          )}
        </div>

        {/* Reply button */}
        {!review.reply_text && review.is_public && (
          <Button variant="ghost" size="sm" icon={MessageCircle}
            onClick={() => onReply(review)}
            className="shrink-0">
            Responder
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Main ── */
export default function Reviews() {
  const [reviews,    setReviews]    = useState([]);
  const [stats,      setStats]      = useState(null);
  const [units,      setUnits]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);

  /* filters */
  const [filterStar,    setFilterStar]    = useState(0);    /* 0 = todas */
  const [filterUnit,    setFilterUnit]    = useState('');
  const [filterReply,   setFilterReply]   = useState('all'); /* all | pending | replied */
  const [filterSort,    setFilterSort]    = useState('recent');
  const [search,        setSearch]        = useState('');

  /* reply modal */
  const [replyModal,  setReplyModal]  = useState(null);
  const [replyText,   setReplyText]   = useState('');
  const [replying,    setReplying]    = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/reviews').then(r => r.data.data || []),
      api.get('/reviews/stats').then(r => r.data.data),
      api.get('/units').then(r => r.data.data || []).catch(() => []),
    ])
      .then(([r, s, u]) => { setReviews(r); setStats(s); setUnits(u); })
      .finally(() => setLoading(false));
  }, []);

  async function handleReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      const { data } = await api.put(`/reviews/${replyModal.id}/reply`, { reply_text: replyText });
      setReviews(prev => prev.map(r => r.id === data.data.id ? data.data : r));
      setReplyModal(null);
      setReplyText('');
    } finally { setReplying(false); }
  }

  /* filtering + sorting */
  const filtered = useMemo(() => {
    let list = [...reviews];

    if (filterStar > 0)          list = list.filter(r => r.rating === filterStar);
    if (filterUnit)               list = list.filter(r => (r.reservations?.units?.id || r.unit_id) === filterUnit);
    if (filterReply === 'pending') list = list.filter(r => !r.reply_text && r.is_public);
    if (filterReply === 'replied') list = list.filter(r => !!r.reply_text);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.comment || '').toLowerCase().includes(q) ||
        (`${r.customers?.first_name || ''} ${r.customers?.last_name || ''}`).toLowerCase().includes(q)
      );
    }

    switch (filterSort) {
      case 'recent':   list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
      case 'oldest':   list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      case 'best':     list.sort((a, b) => b.rating - a.rating); break;
      case 'worst':    list.sort((a, b) => a.rating - b.rating); break;
    }

    return list;
  }, [reviews, filterStar, filterUnit, filterReply, filterSort, search]);

  const paginated    = filtered.slice(0, page * PAGE_SIZE);
  const hasMore      = filtered.length > page * PAGE_SIZE;
  const pendingReply = reviews.filter(r => !r.reply_text && r.is_public && r.comment).length;

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div>
      <PageHeader
        title="Avaliacoes"
        subtitle={`${reviews.length} no total · ${pendingReply} sem resposta`}
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Average */}
          <Card>
            <div className="flex items-center gap-5">
              <div className="text-center shrink-0">
                <p className="font-display font-bold text-4xl text-ocean-700 leading-none">
                  {Number(stats.average || 0).toFixed(1)}
                </p>
                <StarRow rating={Math.round(stats.average || 0)} size={16} />
                <p className="text-xs font-body text-n-400 mt-1">{stats.total} avaliacoes</p>
              </div>
              <div className="flex-1">
                <StarBreakdown distribution={stats.distribution} total={stats.total} />
              </div>
            </div>
          </Card>

          {/* Quick stats */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-body text-n-600">Respondidas</span>
                <span className="font-display font-bold text-n-900">
                  {reviews.filter(r => r.reply_text).length}
                  <span className="text-xs font-body text-n-400 ml-1">/ {reviews.length}</span>
                </span>
              </div>
              <div className="h-1.5 bg-n-100 rounded-full overflow-hidden">
                <div className="h-full bg-ocean-700 rounded-full"
                  style={{ width: reviews.length ? `${(reviews.filter(r => r.reply_text).length / reviews.length) * 100}%` : '0%' }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-body text-n-600">Publicas</span>
                <span className="font-display font-bold text-n-900">
                  {reviews.filter(r => r.is_public).length}
                </span>
              </div>
            </div>
          </Card>

          {/* Pending */}
          <Card>
            <div className="flex flex-col items-center justify-center h-full py-2 text-center gap-2">
              {pendingReply > 0 ? (
                <>
                  <p className="font-display font-bold text-3xl text-sand-500">{pendingReply}</p>
                  <p className="text-sm font-body text-n-600">sem resposta</p>
                  <button
                    onClick={() => { setFilterReply('pending'); setPage(1); }}
                    className="text-xs font-body text-ocean-700 hover:underline mt-1">
                    Ver agora
                  </button>
                </>
              ) : (
                <>
                  <Star size={28} strokeWidth={1.25} className="text-sand-500 fill-sand-500" />
                  <p className="text-sm font-body text-n-600">Todas respondidas</p>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {/* Search */}
        <div className="relative">
          <Search size={13} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-n-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Pesquisar..."
            className="h-8 pl-8 pr-3 text-sm font-body border border-n-200 rounded bg-white placeholder:text-n-400 focus:outline-none focus:border-ocean-700 w-44" />
        </div>

        {/* Star filter */}
        <div className="flex gap-0.5 bg-n-100 rounded p-0.5">
          {[0, 5, 4, 3, 2, 1].map(s => (
            <button key={s} onClick={() => { setFilterStar(s); setPage(1); }}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors ${filterStar === s ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}>
              {s === 0 ? 'Todas' : `${s}★`}
            </button>
          ))}
        </div>

        {/* Unit filter */}
        {units.length > 0 && (
          <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setPage(1); }}
            className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white text-n-700 focus:outline-none">
            <option value="">Todos os servicos</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}

        {/* Reply filter */}
        <select value={filterReply} onChange={e => { setFilterReply(e.target.value); setPage(1); }}
          className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white text-n-700 focus:outline-none">
          <option value="all">Todas</option>
          <option value="pending">Sem resposta</option>
          <option value="replied">Respondidas</option>
        </select>

        {/* Sort */}
        <select value={filterSort} onChange={e => setFilterSort(e.target.value)}
          className="h-8 px-2 text-xs font-body border border-n-200 rounded bg-white text-n-700 focus:outline-none ml-auto">
          <option value="recent">Mais recentes</option>
          <option value="oldest">Mais antigas</option>
          <option value="best">Melhor nota</option>
          <option value="worst">Pior nota</option>
        </select>

        <span className="text-xs font-body text-n-400">{filtered.length} resultado(s)</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-n-200 rounded-md flex flex-col items-center py-14 text-n-400">
          <Star size={36} strokeWidth={1.25} className="mb-3" />
          <p className="font-body text-sm">Nenhuma avaliacao encontrada</p>
          {(filterStar > 0 || filterUnit || filterReply !== 'all' || search) && (
            <button onClick={() => { setFilterStar(0); setFilterUnit(''); setFilterReply('all'); setSearch(''); setPage(1); }}
              className="text-xs font-body text-ocean-700 hover:underline mt-2">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map(r => (
            <ReviewCard key={r.id} review={r}
              onReply={rev => { setReplyText(''); setReplyModal(rev); }} />
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={() => setPage(p => p + 1)}>
                Carregar mais ({filtered.length - paginated.length} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Reply modal */}
      <Modal open={!!replyModal} onClose={() => setReplyModal(null)} title="Responder avaliacao" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplyModal(null)}>Cancelar</Button>
            <Button form="reply-form" type="submit" loading={replying} icon={Send}>Publicar resposta</Button>
          </>
        }>
        <div className="space-y-4">
          {/* Original review */}
          <div className="bg-n-50 border border-n-200 rounded p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <StarRow rating={replyModal?.rating || 5} size={13} />
              <span className="text-xs font-mono text-n-400">{fmtDate(replyModal?.created_at)}</span>
            </div>
            <p className="text-sm font-body text-n-700">{replyModal?.comment}</p>
            {replyModal?.reservations?.units?.name && (
              <p className="text-xs font-body text-ocean-700">{replyModal.reservations.units.name}</p>
            )}
          </div>
          <form id="reply-form" onSubmit={handleReply}>
            <Textarea
              label="A sua resposta (sera publicada)"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              required rows={4}
              placeholder="Obrigado pela sua visita e pelo seu comentario..." />
          </form>
        </div>
      </Modal>
    </div>
  );
}

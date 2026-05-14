import { useState, useEffect } from 'react';
import { Star, MessageCircle, Send } from 'lucide-react';
import api from '../services/api';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Textarea } from '../components/ui/Input';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function StarRating({ rating, max = 5, size = 16 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} strokeWidth={1.75}
          className={i < rating ? 'text-sand-500 fill-sand-500' : 'text-n-300'} />
      ))}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Reviews() {
  const t = useT();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/reviews').then(r => r.data.data),
      api.get('/reviews/stats').then(r => r.data.data),
    ]).then(([r, s]) => { setReviews(r); setStats(s); }).finally(() => setLoading(false));
  }, []);

  async function handleReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      const { data } = await api.put(`/reviews/${replyModal.id}/reply`, { reply_text: replyText });
      setReviews(reviews.map(r => r.id === data.data.id ? data.data : r));
      setReplyModal(null);
      setReplyText('');
    } finally { setReplying(false); }
  }

  async function handleRequest(reservationId) {
    try {
      await api.post('/reviews/request', { reservation_id: reservationId });
      alert('Pedido de avaliacao enviado por email');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro');
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32}/></div>;

  return (
    <div>
      <PageHeader title="Avaliacoes" subtitle={`${reviews.length} avaliacao(oes) recebida(s)`} />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="text-center">
              <p className="font-display font-bold text-3xl text-ocean-700">{stats.average || '—'}</p>
              <StarRating rating={Math.round(stats.average)} size={14}/>
              <p className="text-xs font-body text-n-500 mt-1">{stats.total} avaliacoes</p>
            </div>
          </Card>
          {(stats.distribution || []).slice(0, 3).map((d) => (
            <Card key={d.rating}>
              <div className="text-center">
                <p className="font-display font-bold text-2xl text-n-900">{d.count}</p>
                <StarRating rating={d.rating} size={12}/>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Lista */}
      {reviews.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10 text-n-400">
            <Star size={36} strokeWidth={1.25} className="mb-3"/>
            <p className="font-body text-sm">Sem avaliacoes ainda</p>
            <p className="font-body text-xs mt-1">As avaliacoes aparecem aqui apos o checkout</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <StarRating rating={r.rating}/>
                    <span className="text-xs font-body text-n-400">{formatDate(r.created_at)}</span>
                    <Badge variant={r.is_public ? 'confirmed' : 'default'}>{r.is_public ? 'Publica' : 'Privada'}</Badge>
                  </div>
                  <p className="text-sm font-body text-n-800 mb-1">{r.comment || <span className="text-n-400 italic">Sem comentario</span>}</p>
                  <p className="text-xs font-body text-n-500">
                    {r.customers?.first_name} {r.customers?.country_code ? `· ${r.customers.country_code}` : ''}
                    {r.reservations?.units?.name ? ` · ${r.reservations.units.name}` : ''}
                  </p>

                  {r.reply_text && (
                    <div className="mt-3 bg-ocean-50 rounded-sm px-3 py-2">
                      <p className="text-xs font-body font-bold text-ocean-700 mb-1">Resposta do operador</p>
                      <p className="text-sm font-body text-n-700">{r.reply_text}</p>
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {!r.reply_text && r.comment && (
                    <Button variant="ghost" size="sm" icon={MessageCircle}
                      onClick={() => { setReplyText(''); setReplyModal(r); }}>
                      Responder
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal resposta */}
      <Modal open={!!replyModal} onClose={() => setReplyModal(null)} title="Responder avaliacao" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setReplyModal(null)}>Cancelar</Button>
          <Button form="reply-form" type="submit" loading={replying} icon={Send}>Publicar</Button>
        </>}>
        <div className="space-y-3">
          <div className="bg-n-50 rounded-sm p-3">
            <StarRating rating={replyModal?.rating || 5} size={12}/>
            <p className="text-sm font-body text-n-700 mt-1">{replyModal?.comment}</p>
          </div>
          <form id="reply-form" onSubmit={handleReply}>
            <Textarea label="A sua resposta" value={replyText} onChange={(e) => setReplyText(e.target.value)} required rows={3} placeholder="Obrigado pela sua visita..." />
          </form>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Radio, Mail, Rocket,
  Search, ChevronDown, RefreshCw, Users, Check, CheckCheck,
  Clock, Circle, AlertCircle, Filter, Eye,
} from 'lucide-react';
import { io } from 'socket.io-client';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

/* ─── Shared styles ─────────────────────────────────────────── */
const ICON = { strokeWidth: 1.75, size: 20 };
const TAB_BASE = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap';
const TAB_ACTIVE = `${TAB_BASE} border-ocean-700 text-ocean-700`;
const TAB_IDLE   = `${TAB_BASE} border-transparent text-n-500 hover:text-n-900`;

const BTN_PRIMARY = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-700 text-white text-sm font-medium hover:bg-ocean-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_GHOST   = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-n-200 text-sm text-n-700 hover:bg-n-50 transition-colors';
const INPUT_CLS   = 'w-full rounded-lg border border-n-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500';
const LABEL_CLS   = 'block text-xs font-medium text-n-500 mb-1';

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-n-200 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.key} className={active === t.key ? TAB_ACTIVE : TAB_IDLE} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Tab 1: Chat directo ────────────────────────────────────── */
function ChatTab({ socket }) {
  const token = useAuthStore(s => s.token);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/communications/conversations');
      setConversations(data.data || []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!socket) return;
    const handleOnline  = ({ operatorId }) => setConversations(c => c.map(o => o.id === operatorId ? { ...o, online: true }  : o));
    const handleOffline = ({ operatorId }) => setConversations(c => c.map(o => o.id === operatorId ? { ...o, online: false } : o));
    const handleMsg     = (msg) => {
      if (msg.operator_id === selected?.id) {
        setMessages(m => [...m, msg]);
      }
      setConversations(c => c.map(o => o.id === msg.operator_id
        ? { ...o, last_message: msg, unread_count: msg.sender_type === 'operator' && o.id !== selected?.id ? (o.unread_count || 0) + 1 : 0 }
        : o
      ));
    };
    socket.on('admin:operator:online',  handleOnline);
    socket.on('admin:operator:offline', handleOffline);
    socket.on('admin:message:new',      handleMsg);
    return () => {
      socket.off('admin:operator:online',  handleOnline);
      socket.off('admin:operator:offline', handleOffline);
      socket.off('admin:message:new',      handleMsg);
    };
  }, [socket, selected]);

  const openConversation = async (op) => {
    setSelected(op);
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/communications/conversations/${op.id}`);
      setMessages(data.data || []);
      setConversations(c => c.map(o => o.id === op.id ? { ...o, unread_count: 0 } : o));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMsg = async () => {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/admin/communications/conversations/${selected.id}`, { content: text.trim() });
      setMessages(m => [...m, data.data]);
      setText('');
    } finally { setSending(false); }
  };

  const filtered = conversations.filter(o =>
    !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.email?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] rounded-xl border border-n-200 overflow-hidden">
      {/* Lista de conversas */}
      <div className="w-72 flex-shrink-0 border-r border-n-200 flex flex-col bg-white">
        <div className="p-3 border-b border-n-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400" {...ICON} size={16} />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-n-200 focus:outline-none focus:ring-2 focus:ring-ocean-500"
              placeholder="Pesquisar operador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-n-400 py-8">Sem conversas</p>
          )}
          {filtered.map(op => (
            <button
              key={op.id}
              className={`w-full text-left px-4 py-3 hover:bg-n-50 border-b border-n-100 transition-colors ${selected?.id === op.id ? 'bg-ocean-50' : ''}`}
              onClick={() => openConversation(op)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-700 font-medium text-sm">
                      {(op.name || op.email || '?')[0].toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${op.online ? 'bg-success' : 'bg-n-300'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-n-900 truncate">{op.name || op.email}</p>
                    <p className="text-xs text-n-400 truncate">{op.last_message?.content || 'Sem mensagens'}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-n-400">{fmt(op.last_message?.created_at)}</span>
                  {op.unread_count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-ocean-700 text-white text-xs flex items-center justify-center font-medium">
                      {op.unread_count > 9 ? '9+' : op.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Painel de conversa */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-n-50">
          <div className="px-4 py-3 bg-white border-b border-n-200 flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-700 font-medium text-sm">
                {(selected.name || selected.email || '?')[0].toUpperCase()}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${selected.online ? 'bg-success' : 'bg-n-300'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-n-900">{selected.name || selected.email}</p>
              <p className="text-xs text-n-400">{selected.online ? 'Online' : 'Offline'} · {selected.plan} · {selected.operator_type}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && <p className="text-center text-sm text-n-400">A carregar...</p>}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                  msg.sender_type === 'admin'
                    ? 'bg-ocean-700 text-white rounded-br-sm'
                    : 'bg-white border border-n-200 text-n-900 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.sender_type === 'admin' ? 'text-ocean-200' : 'text-n-400'}`}>
                    {fmt(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 bg-white border-t border-n-200">
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 rounded-xl border border-n-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ocean-500"
                rows={2}
                placeholder="Escreva uma mensagem..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              />
              <button className={BTN_PRIMARY} onClick={sendMsg} disabled={!text.trim() || sending}>
                <Send {...ICON} size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-n-50">
          <div className="text-center">
            <MessageSquare className="mx-auto text-n-300 mb-3" {...ICON} size={40} />
            <p className="text-n-500 text-sm">Seleccione uma conversa</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab 2: Broadcasts ──────────────────────────────────────── */
function BroadcastsTab() {
  const [form, setForm]     = useState({ title: '', content: '', target: 'all', segment_plan: '', segment_type: '' });
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [msg, setMsg]         = useState('');

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/communications/broadcasts');
      setHistory((data.data || []).filter(b => b.channel === 'app'));
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSending(true); setMsg('');
    try {
      const payload = { title: form.title, content: form.content, target: form.target };
      if (form.segment_plan) payload.segment_plan = form.segment_plan;
      if (form.segment_type) payload.segment_type = form.segment_type;
      const { data } = await api.post('/admin/communications/broadcast', payload);
      setMsg(data.message || 'Broadcast enviado');
      setForm({ title: '', content: '', target: 'all', segment_plan: '', segment_type: '' });
      loadHistory();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erro ao enviar');
    } finally { setSending(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Composer */}
      <div className="bg-white rounded-xl border border-n-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-n-900 flex items-center gap-2">
          <Radio {...ICON} size={16} className="text-ocean-700" />
          Novo broadcast in-app
        </h3>

        <div>
          <label className={LABEL_CLS}>Titulo *</label>
          <input className={INPUT_CLS} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titulo da mensagem" />
        </div>
        <div>
          <label className={LABEL_CLS}>Mensagem *</label>
          <textarea className={INPUT_CLS} rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Conteudo da mensagem..." />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLS}>Audiencia</label>
            <select className={INPUT_CLS} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}>
              <option value="all">Todos</option>
              <option value="trial">Trial</option>
              <option value="paying">Pagantes</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Plano</label>
            <select className={INPUT_CLS} value={form.segment_plan} onChange={e => setForm(f => ({ ...f, segment_plan: e.target.value }))}>
              <option value="">Todos</option>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Tipo</label>
            <select className={INPUT_CLS} value={form.segment_type} onChange={e => setForm(f => ({ ...f, segment_type: e.target.value }))}>
              <option value="">Todos</option>
              <option value="hotel">Hotel</option>
              <option value="activity">Actividade</option>
              <option value="rentacar">Rent-a-car</option>
              <option value="restaurant">Restaurante</option>
            </select>
          </div>
        </div>

        {msg && <p className={`text-sm ${msg.startsWith('Erro') ? 'text-error' : 'text-success'}`}>{msg}</p>}

        <button className={BTN_PRIMARY} onClick={send} disabled={sending || !form.title.trim() || !form.content.trim()}>
          <Radio {...ICON} size={16} />
          {sending ? 'A enviar...' : 'Enviar broadcast'}
        </button>
      </div>

      {/* Historico */}
      <div className="bg-white rounded-xl border border-n-200 p-5">
        <h3 className="text-sm font-semibold text-n-900 mb-4">Historico</h3>
        {history.length === 0 && <p className="text-sm text-n-400 text-center py-8">Sem broadcasts enviados</p>}
        <div className="space-y-3">
          {history.map(b => (
            <div key={b.id} className="p-3 rounded-lg bg-n-50 border border-n-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-n-900 truncate">{b.title}</p>
                  <p className="text-xs text-n-400 mt-0.5 line-clamp-2">{b.content}</p>
                </div>
                <span className="flex-shrink-0 text-xs font-medium text-ocean-700 bg-ocean-50 px-2 py-0.5 rounded-full">
                  {b.sent_count} enviados
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-n-400 capitalize">{b.target}</span>
                {b.segment_plan && <span className="text-xs text-n-400">{b.segment_plan}</span>}
                <span className="text-xs text-n-300 ml-auto">
                  {b.sent_at ? new Date(b.sent_at).toLocaleDateString('pt-PT') : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 3: Email marketing ─────────────────────────────────── */
const EMAIL_VARS = ['{nome}', '{plano}', '{dias_trial}'];

function EmailMarketingTab() {
  const [form, setForm]       = useState({ subject: '', body: '', target: 'all', segment_plan: '', segment_type: '' });
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [msg, setMsg]         = useState('');
  const [preview, setPreview] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/communications/broadcasts');
      setHistory((data.data || []).filter(b => b.channel === 'email' && b.target !== 'waitlist'));
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    if (!form.subject.trim() || !form.body.trim()) return;
    setSending(true); setMsg('');
    try {
      const payload = { subject: form.subject, body: form.body, target: form.target };
      if (form.segment_plan) payload.segment_plan = form.segment_plan;
      if (form.segment_type) payload.segment_type = form.segment_type;
      const { data } = await api.post('/admin/communications/email', payload);
      setMsg(data.message || 'Email enviado');
      setForm({ subject: '', body: '', target: 'all', segment_plan: '', segment_type: '' });
      loadHistory();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erro ao enviar');
    } finally { setSending(false); }
  };

  const previewHtml = form.body
    .replace(/\{nome\}/g, 'Maria Silva')
    .replace(/\{plano\}/g, 'business')
    .replace(/\{dias_trial\}/g, '14')
    .replace(/\n/g, '<br/>');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Composer */}
      <div className="bg-white rounded-xl border border-n-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-n-900 flex items-center gap-2">
          <Mail {...ICON} size={16} className="text-ocean-700" />
          Email marketing
        </h3>

        <div>
          <label className={LABEL_CLS}>Assunto *</label>
          <input className={INPUT_CLS} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Assunto do email" />
        </div>

        <div>
          <label className={LABEL_CLS}>Corpo *</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {EMAIL_VARS.map(v => (
              <button key={v} className={BTN_GHOST}
                onClick={() => setForm(f => ({ ...f, body: f.body + v }))}>
                {v}
              </button>
            ))}
          </div>
          <textarea className={INPUT_CLS} rows={8} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Corpo do email. Use {nome}, {plano}, {dias_trial} para personalizar..." />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLS}>Audiencia</label>
            <select className={INPUT_CLS} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}>
              <option value="all">Todos</option>
              <option value="trial">Trial</option>
              <option value="paying">Pagantes</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Plano</label>
            <select className={INPUT_CLS} value={form.segment_plan} onChange={e => setForm(f => ({ ...f, segment_plan: e.target.value }))}>
              <option value="">Todos</option>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Tipo</label>
            <select className={INPUT_CLS} value={form.segment_type} onChange={e => setForm(f => ({ ...f, segment_type: e.target.value }))}>
              <option value="">Todos</option>
              <option value="hotel">Hotel</option>
              <option value="activity">Actividade</option>
              <option value="rentacar">Rent-a-car</option>
              <option value="restaurant">Restaurante</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className={BTN_GHOST} onClick={() => setPreview(p => !p)}>
            <Eye {...ICON} size={16} />
            {preview ? 'Fechar preview' : 'Preview'}
          </button>
          <button className={BTN_PRIMARY} onClick={send} disabled={sending || !form.subject.trim() || !form.body.trim()}>
            <Mail {...ICON} size={16} />
            {sending ? 'A enviar...' : 'Enviar email'}
          </button>
        </div>
        {msg && <p className={`text-sm ${msg.startsWith('Erro') ? 'text-error' : 'text-success'}`}>{msg}</p>}
      </div>

      {/* Preview + historico */}
      <div className="space-y-4">
        {preview && (
          <div className="bg-white rounded-xl border border-n-200 p-5">
            <p className="text-xs font-medium text-n-500 uppercase tracking-wide mb-3">Preview (exemplo: Maria Silva, business, 14 dias)</p>
            <p className="text-sm font-semibold text-n-900 mb-3">{form.subject || '(sem assunto)'}</p>
            <div className="text-sm text-n-700 leading-relaxed border-t border-n-100 pt-3"
              dangerouslySetInnerHTML={{ __html: previewHtml || '<span class="text-n-400">Sem conteudo</span>' }} />
          </div>
        )}

        <div className="bg-white rounded-xl border border-n-200 p-5">
          <h3 className="text-sm font-semibold text-n-900 mb-4">Historico de emails</h3>
          {history.length === 0 && <p className="text-sm text-n-400 text-center py-6">Sem emails enviados</p>}
          <div className="space-y-3">
            {history.map(b => (
              <div key={b.id} className="p-3 rounded-lg bg-n-50 border border-n-100">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-n-900 truncate">{b.title}</p>
                  <span className="flex-shrink-0 text-xs font-medium text-ocean-700 bg-ocean-50 px-2 py-0.5 rounded-full">
                    {b.sent_count} enviados
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-n-400 capitalize">{b.target}</span>
                  <span className="text-xs text-n-300 ml-auto">
                    {b.sent_at ? new Date(b.sent_at).toLocaleDateString('pt-PT') : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 4: Email de lançamento ─────────────────────────────── */
function LaunchEmailTab() {
  const [form, setForm]   = useState({ subject: '', body: '' });
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [err, setErr]       = useState('');
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/communications/broadcasts');
      setHistory((data.data || []).filter(b => b.target === 'waitlist'));
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    setSending(true); setErr(''); setResult(null);
    try {
      const { data } = await api.post('/admin/communications/launch-email', {
        subject: form.subject || undefined,
        body:    form.body    || undefined,
      });
      setResult(data.data);
      loadHistory();
    } catch (e) {
      setErr(e.response?.data?.error || 'Erro ao enviar');
    } finally { setSending(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-n-200 p-5 space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-sand-50 border border-sand-300">
          <AlertCircle className="text-sand-500 flex-shrink-0 mt-0.5" {...ICON} size={16} />
          <p className="text-sm text-n-700">Este email sera enviado para <strong>todos os subscritores da waitlist</strong>. Use com cuidado.</p>
        </div>

        <h3 className="text-sm font-semibold text-n-900 flex items-center gap-2">
          <Rocket {...ICON} size={16} className="text-ocean-700" />
          Email de lancamento
        </h3>

        <div>
          <label className={LABEL_CLS}>Assunto (opcional)</label>
          <input className={INPUT_CLS} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="A SalDesk acabou de ser lancada!" />
          <p className="text-xs text-n-400 mt-1">Deixe vazio para usar o assunto predefinido</p>
        </div>

        <div>
          <label className={LABEL_CLS}>Corpo (opcional)</label>
          <textarea className={INPUT_CLS} rows={7} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Deixe vazio para usar o texto predefinido. Use {nome} para personalizar." />
        </div>

        {result && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/30">
            <p className="text-sm font-medium text-success">Enviado com sucesso</p>
            <p className="text-sm text-n-700 mt-1">{result.sent} de {result.total} subscritores receberam o email</p>
          </div>
        )}
        {err && <p className="text-sm text-error">{err}</p>}

        <button className={BTN_PRIMARY} onClick={send} disabled={sending}>
          <Rocket {...ICON} size={16} />
          {sending ? 'A enviar para waitlist...' : 'Enviar email de lancamento'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-n-200 p-5">
        <h3 className="text-sm font-semibold text-n-900 mb-4">Historico de lançamentos</h3>
        {history.length === 0 && <p className="text-sm text-n-400 text-center py-8">Nenhum email de lancamento enviado</p>}
        <div className="space-y-3">
          {history.map(b => (
            <div key={b.id} className="p-3 rounded-lg bg-n-50 border border-n-100">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-n-900 truncate">{b.title}</p>
                <span className="flex-shrink-0 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                  {b.sent_count} enviados
                </span>
              </div>
              <p className="text-xs text-n-300 mt-1">
                {b.sent_at ? new Date(b.sent_at).toLocaleString('pt-PT') : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
const TABS = [
  { key: 'chat',      label: 'Chat directo'   },
  { key: 'broadcast', label: 'Broadcasts'     },
  { key: 'email',     label: 'Email marketing'},
  { key: 'launch',    label: 'Lancamento'     },
];

export default function AdminCommunications() {
  const [tab, setTab]     = useState('chat');
  const [socket, setSocket] = useState(null);
  const token = useAuthStore(s => s.token);

  useEffect(() => {
    if (!token) return;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const wsUrl  = apiUrl.replace('/api', '').replace(/\/$/, '');
    const s = io(wsUrl, {
      auth:           { role: 'FUNDADOR', token },
      transports:     ['websocket'],
      reconnection:   true,
    });
    setSocket(s);
    return () => { s.disconnect(); };
  }, [token]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-n-900">Comunicacao</h1>
        <p className="text-sm text-n-500 mt-1">Chat directo, broadcasts e email marketing para operadores</p>
      </div>

      <div className="bg-white rounded-xl border border-n-200 overflow-hidden">
        <div className="px-4 pt-4">
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
        </div>
        <div className="p-4">
          {tab === 'chat'      && <ChatTab socket={socket} />}
          {tab === 'broadcast' && <BroadcastsTab />}
          {tab === 'email'     && <EmailMarketingTab />}
          {tab === 'launch'    && <LaunchEmailTab />}
        </div>
      </div>
    </div>
  );
}

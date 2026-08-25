import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Users, User, ChevronRight, ChevronLeft, Send } from 'lucide-react';
import { io } from 'socket.io-client';
import { listStaff } from '../../services/staffService';
import { listGroups, listMessages, sendMessage } from '../../services/messageService';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from './LoadingSpinner';

const AVATAR_BG = ['bg-turquoise-100 text-turquoise-700', 'bg-sand-100 text-sand-600', 'bg-ocean-100 text-ocean-700'];

/* Chat de equipa em tempo real -- partilhado entre StaffPortal.jsx (staff
   geral) e BeachSeller.jsx (vendedores de praia). Mesma equipa, mesmos
   grupos/colegas (listStaff/listGroups nao distinguem staff_role), por
   isso nao ha nada a adaptar por tipo de conta -- so o "height" varia
   consoante o chrome de cada pagina host. */
export default function StaffChat({ staffId, height = 'calc(100vh - 13rem)' }) {
  const { token } = useAuthStore();
  const [view,            setView]      = useState('list'); // 'list' | 'conversation'
  const [selectedContact, setSelected]  = useState(null);  // { id, name, type:'group'|'dm', ... }
  const [groups,      setGroups]     = useState([]);
  const [colleagues,  setColleagues] = useState([]);
  const [messages,    setMessages]   = useState([]);
  const [text,        setText]       = useState('');
  const [loading,     setLoading]    = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const socketRef    = useRef(null);
  const bottomRef    = useRef(null);
  const selectedRef  = useRef(null);

  useEffect(() => { selectedRef.current = selectedContact; }, [selectedContact]);

  /* Carregar grupos + colegas ao montar */
  useEffect(() => {
    Promise.all([listGroups(), listStaff({ status: 'active' })])
      .then(([g, s]) => {
        setGroups(g || []);
        setColleagues((s || []).filter(m => m.id !== staffId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [staffId]);

  /* WebSocket — ligado enquanto a aba Chat estiver aberta */
  useEffect(() => {
    if (!token) return;
    const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;
    socket.on('message:new', (msg) => {
      const cur = selectedRef.current;
      if (!cur) return;
      const isRelevant =
        (cur.type === 'group' && msg.group_id === cur.id) ||
        (cur.type === 'dm' && !msg.group_id && (
          msg.sender_id === cur.id ||
          (msg.sender_id === staffId && msg.recipient_id === cur.id)
        ));
      if (isRelevant) {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    });
    return () => socket.disconnect();
  }, [token, staffId]);

  async function openConversation(contact) {
    setSelected(contact);
    selectedRef.current = contact;
    setView('conversation');
    setMessages([]);
    setLoadingMsgs(true);
    try {
      const params = contact.type === 'group'
        ? { group_id: contact.id }
        : { recipient_id: contact.id };
      const result = await listMessages(params);
      setMessages(result?.data || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function handleSend() {
    const content = text.trim();
    if (!content || !selectedContact) return;
    setText('');
    const payload = selectedContact.type === 'group'
      ? { content, group_id: selectedContact.id, message_type: 'group', recipient_type: 'group' }
      : { content, recipient_id: selectedContact.id, recipient_type: 'staff', message_type: 'direct' };
    try {
      const msg = await sendMessage(payload);
      /* O servidor tambem reenvia esta mensagem ao proprio remetente via
         socket ("message:new") -- sem este dedup, ficava duplicada no ecra
         de quem envia (o handler do socket ja tem a mesma protecao). */
      if (msg) {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {
      setText(content);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size={28}/></div>;

  /* === Vista: lista de contactos === */
  if (view === 'list') {
    const hasAnything = groups.length > 0 || colleagues.length > 0;
    return (
      <div className="px-4 py-4 space-y-5">
        {!hasAnything && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle size={40} strokeWidth={1} className="text-n-300 mb-3"/>
            <p className="font-display font-bold text-n-700">Sem conversas</p>
            <p className="text-sm font-body text-n-400 mt-2">Ainda nao existem grupos nem colaboradores associados.</p>
          </div>
        )}

        {groups.length > 0 && (
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-3">Grupos</p>
            {groups.map(g => (
              <button key={g.id}
                onClick={() => openConversation({ id: g.id, name: g.name, type: 'group', memberCount: (g.members || []).length })}
                className="w-full bg-white rounded-2xl border border-n-200 shadow-sm px-4 py-3 mb-2 flex items-center gap-3 text-left hover:border-turquoise-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-sand-100 flex items-center justify-center shrink-0">
                  <Users size={16} strokeWidth={1.75} className="text-sand-600"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm text-n-900">{g.name}</p>
                  <p className="text-xs font-body text-n-400 mt-0.5">{(g.members || []).length} membros</p>
                </div>
                <ChevronRight size={16} strokeWidth={1.75} className="text-n-300 shrink-0"/>
              </button>
            ))}
          </div>
        )}

        {colleagues.length > 0 && (
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wide text-n-500 mb-3">Equipa</p>
            {colleagues.map((c, i) => (
              <button key={c.id}
                onClick={() => openConversation({ id: c.id, name: c.name, type: 'dm', role: c.role })}
                className="w-full bg-white rounded-2xl border border-n-200 shadow-sm px-4 py-3 mb-2 flex items-center gap-3 text-left hover:border-turquoise-300 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${AVATAR_BG[i % AVATAR_BG.length]}`}>
                  <User size={16} strokeWidth={1.75}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm text-n-900">{c.name}</p>
                  {c.role && <p className="text-xs font-body text-n-400 mt-0.5">{c.role}</p>}
                </div>
                <ChevronRight size={16} strokeWidth={1.75} className="text-n-300 shrink-0"/>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* === Vista: conversa activa === */
  return (
    <div className="flex flex-col" style={{ height }}>
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b border-n-200 flex items-center gap-3 bg-white">
        <button onClick={() => { setView('list'); setSelected(null); selectedRef.current = null; }}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-n-500 hover:bg-n-100 transition-colors shrink-0">
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedContact.type === 'group' ? 'bg-sand-100' : 'bg-turquoise-100'}`}>
          {selectedContact.type === 'group'
            ? <Users size={16} strokeWidth={1.75} className="text-sand-600"/>
            : <User  size={16} strokeWidth={1.75} className="text-turquoise-700"/>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-sm text-n-900 truncate">{selectedContact.name}</p>
          <p className="text-xs font-body text-n-400">
            {selectedContact.type === 'group'
              ? `${selectedContact.memberCount} membros`
              : selectedContact.role || 'Colaborador'}
          </p>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loadingMsgs ? (
          <div className="flex justify-center py-8"><LoadingSpinner size={24}/></div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <p className="text-xs font-body text-n-400">Sem mensagens ainda. Comece a conversa.</p>
          </div>
        ) : messages.map((msg, i) => {
          const isOwn = msg.sender_type === 'staff' && msg.sender_id === staffId;
          return (
            <div key={msg.id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm font-body ${
                isOwn
                  ? 'bg-ocean-700 text-white rounded-br-sm'
                  : 'bg-white border border-n-200 text-n-800 rounded-bl-sm'
              }`}>
                {!isOwn && selectedContact.type === 'group' && (
                  <p className="text-[10px] font-mono text-n-400 mb-0.5">
                    {msg.sender_name || (msg.sender_type === 'manager' ? 'Gestor' : 'Equipa')}
                  </p>
                )}
                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-n-200 flex items-center gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Escreva uma mensagem..."
          className="flex-1 bg-n-50 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:ring-2 focus:ring-turquoise-300 transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-10 h-10 bg-ocean-700 hover:bg-ocean-500 rounded-xl flex items-center justify-center text-white disabled:opacity-40 active:scale-95 transition-all"
        >
          <Send size={16} strokeWidth={1.75}/>
        </button>
      </div>
    </div>
  );
}

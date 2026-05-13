import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Users, MessageCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { listMessages, sendMessage, markRead, listGroups, createGroup } from '../services/messageService';
import { listStaff } from '../services/staffService';
import useAuthStore from '../store/authStore';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function Messages() {
  const t = useT();
  const { token, operator } = useAuthStore();
  const [staff, setStaff] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', members: [] });
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    Promise.all([listStaff({ status: 'active' }), listGroups()]).then(([s, g]) => {
      setStaff(s); setGroups(g);
    });
  }, []);

  /* Socket.io */
  useEffect(() => {
    if (!token || !operator) return;
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3001', {
      auth: { operatorId: operator.id, userId: operator.user_id, role: 'manager' },
    });
    socketRef.current = socket;
    socket.on('message:new', (msg) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => socket.disconnect();
  }, [token, operator]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages(contact) {
    setSelectedContact(contact);
    setLoadingMsgs(true);
    try {
      const params = contact.type === 'group'
        ? { group_id: contact.id }
        : { recipient_id: contact.id };
      const result = await listMessages(params);
      setMessages(result.data || []);
    } finally { setLoadingMsgs(false); }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !selectedContact) return;
    setSending(true);
    try {
      const payload = selectedContact.type === 'group'
        ? { content: text, group_id: selectedContact.id, message_type: 'group', recipient_type: 'group' }
        : { content: text, recipient_id: selectedContact.id, recipient_type: 'staff', message_type: 'direct' };
      const msg = await sendMessage(payload);
      setMessages((prev) => [...prev, msg]);
      setText('');
    } finally { setSending(false); }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    const g = await createGroup(groupForm);
    setGroups([...groups, g]);
    setGroupModal(false);
    setGroupForm({ name: '', members: [] });
  }

  const contacts = [
    ...staff.map((s) => ({ ...s, type: 'staff', label: s.name, sublabel: s.role })),
    ...groups.map((g) => ({ ...g, type: 'group', label: g.name, sublabel: `Grupo · ${(g.members || []).length} membros` })),
  ];

  return (
    <div>
      <PageHeader title="Mensagens"
        actions={<Button variant="secondary" icon={Plus} onClick={() => setGroupModal(true)}>Novo grupo</Button>}
      />
      <div className="grid grid-cols-[280px_1fr] gap-0 bg-white rounded-md border border-n-200 shadow-sm overflow-hidden" style={{ height: '600px' }}>
        {/* Lista de contactos */}
        <div className="border-r border-n-200 flex flex-col">
          <div className="px-3 py-3 border-b border-n-100">
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-500">Conversas</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <p className="p-4 text-xs font-body text-n-400 text-center">Sem colaboradores ou grupos</p>
            ) : contacts.map((c) => (
              <button key={c.id} onClick={() => loadMessages(c)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-n-50 transition-colors border-b border-n-100 ${selectedContact?.id === c.id ? 'bg-ocean-50' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-display font-bold text-sm shrink-0 ${c.type === 'group' ? 'bg-sand-500' : 'bg-ocean-700'}`}>
                  {c.type === 'group' ? <Users size={16} strokeWidth={1.75}/> : c.label[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-body font-semibold text-n-900 truncate">{c.label}</p>
                  <p className="text-xs font-body text-n-400 truncate">{c.sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Janela de chat */}
        <div className="flex flex-col">
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center text-n-400">
              <div className="text-center">
                <MessageCircle size={36} strokeWidth={1.25} className="mx-auto mb-2"/>
                <p className="text-sm font-body">Seleccione uma conversa</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-n-200 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${selectedContact.type === 'group' ? 'bg-sand-500' : 'bg-ocean-700'}`}>
                  {selectedContact.type === 'group' ? <Users size={14} strokeWidth={1.75}/> : selectedContact.label[0]}
                </div>
                <div>
                  <p className="font-display font-semibold text-sm text-n-900">{selectedContact.label}</p>
                  <p className="text-xs font-body text-n-400">{selectedContact.sublabel}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8"><LoadingSpinner /></div>
                ) : messages.map((msg) => {
                  const isMe = msg.sender_type === 'manager';
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-md text-sm font-body ${isMe ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-800'}`}>
                        {!isMe && <p className="text-xs font-semibold mb-1 opacity-70">{msg.sender_type}</p>}
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={`text-xs mt-1 text-right ${isMe ? 'opacity-60' : 'text-n-400'}`}>{formatTime(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              <form onSubmit={handleSend} className="px-4 py-3 border-t border-n-200 flex gap-3">
                <input
                  className="flex-1 h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
                  value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Escrever mensagem..."
                />
                <Button type="submit" loading={sending} icon={Send} disabled={!text.trim()}>Enviar</Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Modal criar grupo */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="Novo grupo" size="sm"
        footer={<><Button variant="secondary" onClick={() => setGroupModal(false)}>Cancelar</Button><Button form="group-form" type="submit">Criar</Button></>}>
        <form id="group-form" onSubmit={handleCreateGroup} className="space-y-4">
          <Input label="Nome do grupo" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} required placeholder="Ex: Equipa Kitesurf" />
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2">Membros</p>
            <div className="space-y-1.5">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded"
                    checked={groupForm.members.includes(s.id)}
                    onChange={(e) => {
                      const members = e.target.checked
                        ? [...groupForm.members, s.id]
                        : groupForm.members.filter((id) => id !== s.id);
                      setGroupForm({ ...groupForm, members });
                    }}
                  />
                  <span className="text-sm font-body text-n-700">{s.name} <span className="text-n-400">· {s.role}</span></span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, Bell,
  Calendar, XCircle, Star, MessageCircle,
  User, LogOut,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import LanguageToggle from '../shared/LanguageToggle';
import Logo from '../shared/Logo';
import api from '../../services/api';

const TYPE_ICON = {
  new_booking:    { Icon: Calendar,       color: 'text-ocean-700' },
  cancellation:   { Icon: XCircle,        color: 'text-error'     },
  new_review:     { Icon: Star,           color: 'text-sand-500'  },
  new_message:    { Icon: MessageCircle,  color: 'text-ocean-500' },
};

const TYPE_LABEL = {
  new_booking:  'Nova reserva',
  cancellation: 'Cancelamento',
  new_review:   'Nova avaliacao',
  new_message:  'Nova mensagem',
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Topbar() {
  const { operator, logout } = useAuthStore();
  const navigate             = useNavigate();

  const [open,        setOpen]        = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifs,      setNotifs]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const panelRef    = useRef(null);
  const profileRef  = useRef(null);

  const unread = notifs.filter((n) => !n.is_read).length;

  async function fetchNotifs() {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifs(res.data.data || []);
    } catch {
      // silent — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function markRead(notif) {
    if (notif.is_read) return;
    try {
      await api.put(`/notifications/${notif.id}/read`);
      setNotifs((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    } catch {
      // silent
    }
  }

  function handleBellClick() {
    setOpen((v) => !v);
  }

  function handleViewAll() {
    setOpen(false);
    navigate('/mensagens');
  }

  const initials = operator?.name
    ? operator.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  return (
    <header className="h-16 bg-white border-b border-n-200 shadow-sm flex items-center justify-between px-6 shrink-0">
      <Logo size="sm" /><div className="flex-1" />

      <div className="flex items-center gap-3">
        <LanguageToggle />

        {/* Notification bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={handleBellClick}
            className="relative p-2 rounded-md text-n-500 hover:text-ocean-700 hover:bg-ocean-50 transition-colors"
            aria-label="Notificacoes"
          >
            <Bell size={20} strokeWidth={1.75} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-error text-white text-[10px] font-mono font-medium flex items-center justify-center leading-none">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-n-200 rounded-md shadow-lg z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-n-100">
                <span className="text-sm font-display font-semibold text-n-900">Notificacoes</span>
                {unread > 0 && (
                  <span className="text-xs font-mono text-n-500">{unread} nao lida{unread !== 1 ? 's' : ''}</span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-n-100">
                {loading && notifs.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-n-400 font-body">A carregar...</div>
                )}
                {!loading && notifs.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-n-400 font-body">Sem notificacoes</div>
                )}
                {notifs.map((n) => {
                  const type  = TYPE_ICON[n.notification_type] || TYPE_ICON.new_message;
                  const label = TYPE_LABEL[n.notification_type] || 'Notificacao';
                  return (
                    <button
                      key={n.id}
                      onClick={() => markRead(n)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-n-50 transition-colors ${
                        !n.is_read ? 'bg-ocean-50' : ''
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${type.color}`}>
                        <type.Icon size={16} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono uppercase tracking-wide text-n-500 mb-0.5">{label}</p>
                        <p className="text-sm font-body text-n-800 leading-snug truncate">{n.content}</p>
                      </div>
                      <span className="text-[11px] font-mono text-n-400 shrink-0 mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-ocean-500 shrink-0 mt-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="px-4 py-2.5 border-t border-n-100">
                <button
                  onClick={handleViewAll}
                  className="w-full text-center text-sm font-body font-medium text-ocean-700 hover:text-ocean-900 transition-colors py-1"
                >
                  Ver todas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User avatar + dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 cursor-pointer group px-2 py-1.5 -mr-2 rounded-md hover:bg-ocean-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-ocean-700 flex items-center justify-center text-white text-xs font-display font-bold">
              {initials}
            </div>
            <span className="text-sm font-display font-semibold text-n-800 hidden sm:block">{operator?.name}</span>
            <ChevronDown size={14} strokeWidth={1.75} className={`text-n-400 group-hover:text-ocean-600 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-n-200 rounded-md shadow-lg z-50 py-1 overflow-hidden">
              <button
                onClick={() => { navigate('/perfil'); setProfileOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-body text-n-700 hover:bg-ocean-50 hover:text-ocean-700 transition-colors"
              >
                <User size={14} strokeWidth={1.75} />
                Ver perfil
              </button>
              <div className="border-t border-n-100 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-body text-error hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} strokeWidth={1.75} />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

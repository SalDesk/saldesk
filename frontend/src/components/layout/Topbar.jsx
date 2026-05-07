import { Menu, ChevronDown } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import LanguageToggle from '../shared/LanguageToggle';

export default function Topbar({ onMenuClick }) {
  const { operator } = useAuthStore();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const initials = operator?.name
    ? operator.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  return (
    <header className="h-14 bg-white border-b border-n-200 flex items-center justify-between px-4 shrink-0">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-sm text-n-500 hover:text-n-700 hover:bg-n-100 transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <LanguageToggle />
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-ocean-700 flex items-center justify-center text-white text-xs font-display font-bold">
            {initials}
          </div>
          <span className="text-sm font-body text-n-700 hidden sm:block">
            {operator?.name}
          </span>
          <ChevronDown size={14} strokeWidth={1.75} className="text-n-400 group-hover:text-n-600" />
        </div>
      </div>
    </header>
  );
}

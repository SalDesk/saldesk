import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ToastContainer } from '../ui/Toast';
import useUiStore from '../../store/uiStore';

export default function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen bg-n-50 overflow-hidden">
      {/* Overlay mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-ocean-900/40 z-20 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — sempre visivel em desktop, drawer em mobile */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-30 transition-transform duration-200',
          'md:relative md:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          sidebarOpen ? 'md:w-64' : 'md:w-0 md:overflow-hidden',
        ].join(' ')}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Area principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-5 md:p-8">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

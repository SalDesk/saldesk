import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import MoreDrawer from './MoreDrawer';
import { ToastContainer } from '../ui/Toast';
import useUiStore from '../../store/uiStore';

export default function Layout() {
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen bg-n-50 overflow-hidden">
      {/* Sidebar — so em desktop, navegacao mobile passa pela bottom nav */}
      <div
        className={[
          'hidden md:relative md:block',
          sidebarOpen ? 'md:w-64' : 'md:w-0 md:overflow-hidden',
        ].join(' ')}
      >
        <Sidebar />
      </div>

      {/* Area principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-5 pb-20 md:p-8">
          <Outlet />
        </main>
      </div>

      <BottomNav onOpenMore={() => setMoreDrawerOpen(true)} />
      <MoreDrawer open={moreDrawerOpen} onClose={() => setMoreDrawerOpen(false)} />

      <ToastContainer />
    </div>
  );
}

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastContainer } from '../ui/Toast';

export default function Layout() {
  const [sidebarAberta, setSidebarAberta] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Overlay mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 md:relative md:translate-x-0 transition-transform duration-200
        ${sidebarAberta ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarAberta(false)} />
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarAberta(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <span className="font-bold text-primary-500">SalDesk</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

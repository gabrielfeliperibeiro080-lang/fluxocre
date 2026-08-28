import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Wallet, Calendar, Settings, MessageSquare } from 'lucide-react';
import { Toaster } from "@/components/ui/toaster";

export function DashboardLayout() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Clientes', path: '/clientes', icon: <Users size={20} /> },
    { name: 'Operações', path: '/operacoes', icon: <CreditCard size={20} /> },
    { name: 'Fluxo de Caixa', path: '/fluxo-caixa', icon: <Wallet size={20} /> },
    { name: 'Agenda', path: '/agenda', icon: <Calendar size={20} /> },
    { name: 'Histórico WhatsApp', path: '/historico-whatsapp', icon: <MessageSquare size={20} /> },
    { name: 'Configurações', path: '/configuracoes', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-xl font-bold tracking-tight text-primary">FLUXOCRED</span>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/');
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-6xl">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { ConfiguracoesWhatsApp } from './pages/ConfiguracoesWhatsApp';
import { Clientes } from './pages/Clientes';
import { Operacoes } from './pages/Operacoes';
import { FluxoCaixa } from './pages/FluxoCaixa';
import { HistoricoWhatsApp } from './pages/HistoricoWhatsApp';
import { Login } from './pages/Login';
import { Agenda } from './pages/Agenda';
import { useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// Rota Privada
const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="operacoes" element={<Operacoes />} />
          <Route path="fluxo-caixa" element={<FluxoCaixa />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="historico-whatsapp" element={<HistoricoWhatsApp />} />
          
          {/* Aba de Configurações do WhatsApp */}
          <Route path="configuracoes" element={<ConfiguracoesWhatsApp />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

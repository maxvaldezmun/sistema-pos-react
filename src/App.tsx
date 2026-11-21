import { useState } from 'react';
import { AlertCircle, Loader2, LogOut } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { LoginScreen } from './components/LoginScreen';
import { Navbar, type ActiveTab } from './components/Navbar';
import { PosView } from './components/PosView';
import { HistoryCutView } from './components/HistoryCutView';
import { PricesView } from './components/PricesView';
import { TicketModal } from './components/TicketModal';
import { resetDemoData } from './services/localPosService';
import type { TicketData } from './types/pos';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    session,
    profile,
    warehouses,
    activeWarehouse,
    selectWarehouse,
    loading,
    authError,
    signIn,
    signInDemo,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [demoResetKey, setDemoResetKey] = useState(0);

  const handleResetDemo = () => {
    if (
      !window.confirm(
        '¿Restaurar los datos iniciales del Demo? Se reiniciarán los precios, existencias, carrito, ventas y cortes locales.'
      )
    ) {
      return;
    }
    resetDemoData();
    setTicket(null);
    setDemoResetKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Cargando Sistema de Ventas...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onSignIn={signIn}
        onSignInDemo={signInDemo}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (authError || !profile || !activeWarehouse) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Acceso restringido a sucursales POS
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {authError ||
              'Tu usuario no tiene una sucursal habilitada para ventas. Contacta al administrador.'}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white text-sm font-semibold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        profile={profile}
        warehouses={warehouses}
        activeWarehouse={activeWarehouse}
        onSelectWarehouse={selectWarehouse}
        theme={theme}
        onToggleTheme={toggleTheme}
        onResetDemo={handleResetDemo}
        onSignOut={signOut}
      />

      <main className="pb-10 no-print" key={demoResetKey}>
        {activeTab === 'pos' && (
          <PosView
            warehouse={activeWarehouse}
            profile={profile}
            onSaleComplete={(t) => setTicket(t)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryCutView
            warehouse={activeWarehouse}
            profile={profile}
            onReprintTicket={(t) => setTicket(t)}
          />
        )}

        {activeTab === 'prices' && <PricesView />}
      </main>

      <TicketModal ticket={ticket} onClose={() => setTicket(null)} />
    </div>
  );
}

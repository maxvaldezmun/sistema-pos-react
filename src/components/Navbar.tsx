import {
  Building2,
  ClipboardList,
  LogOut,
  Moon,
  RotateCcw,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  User,
} from 'lucide-react';
import { isAdminOrTi, type Profile, type Warehouse } from '../types/pos';

export type ActiveTab = 'pos' | 'history' | 'prices';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  profile: Profile;
  warehouses: Warehouse[];
  activeWarehouse: Warehouse | null;
  onSelectWarehouse: (id: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onResetDemo: () => void;
  onSignOut: () => void;
}

export function Navbar({
  activeTab,
  onSelectTab,
  profile,
  warehouses,
  activeWarehouse,
  onSelectWarehouse,
  theme,
  onToggleTheme,
  onResetDemo,
  onSignOut,
}: NavbarProps) {
  const isAdmin = isAdminOrTi(profile.role);

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 no-print">
      <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Marca + Navegación */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-bold text-sm tracking-wide text-zinc-900 dark:text-zinc-100">
                VENTAS
              </div>
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Punto de Venta
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => onSelectTab('pos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Caja</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden md:inline">Historial y Corte</span>
              <span className="md:hidden">Corte</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('prices')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'prices'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Precios</span>
            </button>
          </nav>
        </div>

        {/* Bodega + Usuario + Tema + Salir */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <select
                value={activeWarehouse?.id ?? ''}
                onChange={(e) => onSelectWarehouse(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[200px]"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} className="bg-white dark:bg-zinc-900">
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-medium">
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-[200px]">
                {activeWarehouse?.name ?? 'Sin sucursal'}
              </span>
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <div className="text-xs leading-tight">
              <div className="font-medium text-zinc-800 dark:text-zinc-200 max-w-[140px] truncate">
                {profile.full_name || profile.email}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {profile.role}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetDemo}
            className="px-2.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Restaurar productos, precios, existencias y cortes iniciales del demo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Restaurar Demo</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-red-600 hover:border-red-400 transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

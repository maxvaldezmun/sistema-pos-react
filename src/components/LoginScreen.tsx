import { useState, type FormEvent } from 'react';
import {
  Lock,
  Mail,
  Moon,
  Sun,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Store,
} from 'lucide-react';
import { DEMO_ACCOUNTS } from '../data/mockProducts';

interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignInDemo: (profileId: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function LoginScreen({
  onSignIn,
  onSignInDemo,
  theme,
  onToggleTheme,
}: LoginScreenProps) {
  const [email, setEmail] = useState('admin@demo.pos');
  const [password, setPassword] = useState('demo123');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSignIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-100 dark:bg-zinc-950 transition-colors">
      <button
        type="button"
        onClick={onToggleTheme}
        className="fixed top-4 right-4 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-emerald-500 transition-colors cursor-pointer"
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 mb-3">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            VENTAS
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Punto de Venta · Modo Demo Local
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@demo.pos"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="demo123"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ingresando...
              </>
            ) : (
              'Entrar al POS'
            )}
          </button>
        </form>

        {/* Acceso rápido 1 clic para demo / portafolio */}
        <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Acceso rápido de demostración</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.profile.id}
                type="button"
                onClick={() => onSignInDemo(acc.profile.id)}
                className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                  {acc.profile.role === 'admin' ? 'Admin Demo' : acc.label}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">{acc.profile.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

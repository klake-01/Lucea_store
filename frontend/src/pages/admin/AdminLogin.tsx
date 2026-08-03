import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Seo } from '../../components/Seo';

export const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = (location.state as { from?: string } | null)?.from || '/admin';

  // Redirect from an effect rather than during render, which is what the
  // router warns about when navigate() runs in the render body.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, isAuthenticated, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(username.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Identifiants incorrects ou compte verrouille.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ecru flex items-center justify-center p-4">
      <Seo
        title="Connexion administration | LUCEA Maroc"
        description="Acces reserve au personnel LUCEA."
        path="/admin/login"
        noindex
      />

      <div className="max-w-md w-full bg-white border border-pierre-line rounded-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-ambre-soft text-terracotta-deep rounded-xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink">Administration LUCEA</h1>
          <p className="text-xs text-pierre-deep">Acces reserve au personnel autorise.</p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-alerte-soft border border-alerte/30 text-alerte p-3 rounded-xl text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="text-xs font-semibold text-ink block mb-1.5">
              Nom d utilisateur ou email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-pierre-deep absolute left-3 top-3.5" aria-hidden="true" />
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-ecru border border-pierre-line rounded-xl py-3 pl-9 pr-3 text-sm text-ink focus:outline-none focus:border-terracotta"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-semibold text-ink block mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-pierre-deep absolute left-3 top-3.5" aria-hidden="true" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ecru border border-pierre-line rounded-xl py-3 pl-9 pr-3 text-sm text-ink focus:outline-none focus:border-terracotta"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ambre hover:bg-ambre-deep hover:text-white disabled:opacity-50 text-ink font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Connexion en cours
              </>
            ) : (
              <>
                Se connecter
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-pierre-deep text-center">
          Apres cinq tentatives echouees, le compte se verrouille 15 minutes.
        </p>

        <div className="text-center pt-2 border-t border-pierre-line">
          <Link to="/" className="text-xs text-terracotta-deep hover:text-terracotta font-semibold">
            Retour a la boutique
          </Link>
        </div>
      </div>
    </div>
  );
};

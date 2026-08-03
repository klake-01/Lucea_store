import React from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, FileText, ScrollText, LogOut, Loader2,
  ExternalLink, Ticket, Users, Star
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Seo } from '../../components/Seo';

const NAV_ITEMS = [
  { name: 'Tableau de bord', path: '/admin', icon: LayoutDashboard, end: true },
  { name: 'Commandes', path: '/admin/orders', icon: ShoppingBag },
  { name: 'Produits et stocks', path: '/admin/products', icon: Package },
  { name: 'Clients', path: '/admin/customers', icon: Users },
  { name: 'Avis clients', path: '/admin/reviews', icon: Star },
  { name: 'Codes promo', path: '/admin/coupons', icon: Ticket },
  { name: 'Guides', path: '/admin/articles', icon: FileText },
  { name: 'Journal d audit', path: '/admin/audit-log', icon: ScrollText, adminOnly: true },
];

export const AdminLayout: React.FC = () => {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // While the stored token is exchanged for a profile we must not redirect,
  // otherwise a signed in admin is bounced back to the login screen on reload.
  if (loading) {
    return (
      <div className="min-h-screen bg-ecru flex items-center justify-center">
        <div className="flex items-center gap-3 text-pierre-deep text-sm">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          Verification de votre session
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="min-h-screen bg-ecru text-ink-soft flex flex-col lg:flex-row">
      <Seo
        title="Administration | LUCEA Maroc"
        description="Espace d administration LUCEA."
        path={location.pathname}
        noindex
      />

      <aside className="lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-pierre-line flex lg:flex-col justify-between p-4 gap-4">
        <div className="flex-1 lg:space-y-6 flex lg:block items-center gap-4">
          <div className="flex items-center gap-2 px-1 flex-shrink-0">
            <span className="text-xl font-serif font-bold text-ink">LUCEA</span>
            <span className="text-[10px] bg-ambre-soft text-terracotta-deep px-1.5 py-0.5 rounded font-semibold tracking-wider">
              ADMIN
            </span>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto" aria-label="Navigation administration">
            {NAV_ITEMS.map((item) => {
              if (item.adminOnly && user?.role_name !== 'admin') return null;
              const Icon = item.icon;
              const active = item.end
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-ambre-soft text-terracotta-deep font-semibold'
                      : 'text-ink-soft hover:bg-ecru'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="lg:pt-4 lg:border-t border-pierre-line flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:block">
            <span className="font-semibold text-ink text-xs block">{user?.username}</span>
            <span className="text-[10px] text-pierre-deep uppercase tracking-wide">
              {user?.role_name}
            </span>
          </div>

          <Link
            to="/"
            className="p-2 text-pierre-deep hover:text-terracotta-deep transition-colors"
            title="Voir la boutique"
            aria-label="Ouvrir la boutique"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>

          <button
            onClick={logout}
            className="p-2 text-pierre-deep hover:text-alerte transition-colors"
            title="Se deconnecter"
            aria-label="Se deconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

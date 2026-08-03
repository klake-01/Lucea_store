import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { ScrollToTop } from './components/ScrollToTop';

// The landing routes ship in the main bundle so the first paint is immediate.
import { Home } from './pages/Home';
import { HubPage } from './pages/HubPage';
import { MoneyPage } from './pages/MoneyPage';
import { ProductDetailPage } from './pages/ProductDetailPage';

// Everything below is split out: content, checkout and the whole admin are
// not needed to render a landing page, so they are fetched on demand.
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })));
const GuidesPage = lazy(() => import('./pages/GuidesPage').then((m) => ({ default: m.GuidesPage })));
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage').then((m) => ({ default: m.ArticleDetailPage })));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage').then((m) => ({ default: m.OrderTrackingPage })));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage').then((m) => ({ default: m.ReviewsPage })));
const ReviewSubmitPage = lazy(() => import('./pages/ReviewSubmitPage').then((m) => ({ default: m.ReviewSubmitPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const AboutPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.AboutPage })));
const FaqPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.FaqPage })));
const DeliveryPaymentPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.DeliveryPaymentPage })));
const ContactPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.ContactPage })));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders })));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts').then((m) => ({ default: m.AdminProducts })));
const AdminArticles = lazy(() => import('./pages/admin/AdminArticles').then((m) => ({ default: m.AdminArticles })));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews').then((m) => ({ default: m.AdminReviews })));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons').then((m) => ({ default: m.AdminCoupons })));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers').then((m) => ({ default: m.AdminCustomers })));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog').then((m) => ({ default: m.AdminAuditLog })));

import { CLUSTERS } from './lib/seoStrategy';

/** Reserves viewport height while a split route loads, so nothing jumps. */
const RouteFallback = () => (
  <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
    <span className="sr-only">Chargement de la page</span>
    <span className="w-8 h-8 rounded-full border-2 border-pierre-line border-t-terracotta animate-spin" aria-hidden="true" />
  </div>
);

import { WhatsAppButton } from './components/WhatsAppButton';

/** Public shell: header, footer and the cart drawer shared by every page. */
function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ecru text-ink-soft flex flex-col font-sans">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-400 focus:top-3 focus:left-3 focus:bg-white focus:text-ink focus:px-5 focus:py-3 focus:rounded-xl focus:border focus:border-ambre focus:font-semibold focus:text-sm"
      >
        Aller au contenu principal
      </a>
      <Navbar />
      <main id="contenu" className="flex-1">
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Admin, outside the storefront shell */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="coupons" element={<AdminCoupons />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="articles" element={<AdminArticles />} />
                <Route path="audit-log" element={<AdminAuditLog />} />
              </Route>

              {/* Storefront */}
              <Route
                path="*"
                element={
                  <StorefrontLayout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/lampes" element={<HubPage />} />

                      {CLUSTERS.map((cluster) => (
                        <Route
                          key={cluster.id}
                          path={cluster.moneyPageUrl}
                          element={<MoneyPage />}
                        />
                      ))}

                      <Route path="/a-propos" element={<AboutPage />} />
                      <Route path="/faq" element={<FaqPage />} />
                      <Route path="/livraison-paiement" element={<DeliveryPaymentPage />} />
                      <Route path="/contact" element={<ContactPage />} />

                      <Route path="/guides" element={<GuidesPage />} />
                      <Route path="/guides/:slug" element={<ArticleDetailPage />} />

                      <Route path="/products/:slug" element={<ProductDetailPage />} />

                      <Route path="/checkout" element={<CheckoutPage />} />
                      <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
                      <Route path="/suivi-commande" element={<OrderTrackingPage />} />
                      <Route path="/avis" element={<ReviewsPage />} />
                      <Route path="/avis/nouveau" element={<ReviewSubmitPage />} />

                      {/* Unknown URLs get a real 404 page, not a silent catalogue */}
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </StorefrontLayout>
                }
              />
            </Routes>
          </Suspense>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;

import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import Home from "./pages/Home";
import { ScrollToTop } from "./components/ScrollToTop";

import { AdminAuthProvider } from "./context/AdminAuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdBanner } from "./components/AdBanner";

// Lazy-loaded Customer Pages
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Payment = lazy(() => import("./pages/Payment"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const PriceList = lazy(() => import("./pages/PriceList"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const WarrantyPolicy = lazy(() => import("./pages/WarrantyPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-loaded Admin Layout & Pages
const AdminGuard = lazy(() => import("./components/admin/AdminGuard").then(m => ({ default: m.AdminGuard })));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminVouchers = lazy(() => import("./pages/admin/AdminVouchers"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));

/**
 * Minimalist, high-performance PageLoader fallback
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] py-16" aria-label="Memuat halaman...">
      <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-blue rounded-full animate-spin" />
    </div>
  );
}

/**
 * Public Layout with Store Navbar & Footer
 */
function PublicLayout() {
  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <AdBanner />
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AdminAuthProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Admin Login Route (Standalone) */}
            <Route
              path="/admin/login"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminLogin />
                </Suspense>
              }
            />
            {/* Quick Alias / Redirect for /login to Admin Login */}
            <Route path="/login" element={<Navigate to="/admin/login" replace />} />

            {/* Protected Admin Routes under AdminGuard & AdminLayout */}
            <Route
              path="/admin"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminGuard />
                </Suspense>
              }
            >
              <Route
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AdminLayout />
                  </Suspense>
                }
              >
                <Route
                  index
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminDashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminOrders />
                    </Suspense>
                  }
                />
                <Route
                  path="products"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminProducts />
                    </Suspense>
                  }
                />
                <Route
                  path="vouchers"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminVouchers />
                    </Suspense>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminAnalytics />
                    </Suspense>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminProfile />
                    </Suspense>
                  }
                />
              </Route>
            </Route>

            {/* Public Customer Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout/:id" element={<Checkout />} />
              <Route path="/payment/:orderId" element={<Payment />} />
              <Route path="/orders" element={<MyOrders />} />
              <Route path="/invoice/:id" element={<InvoiceDetail />} />
              <Route path="/daftar-harga" element={<PriceList />} />
              <Route path="/price-list" element={<PriceList />} />
              <Route path="/syarat-ketentuan" element={<TermsAndConditions />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/kebijakan-garansi" element={<WarrantyPolicy />} />
              <Route path="/garansi" element={<WarrantyPolicy />} />
              <Route path="/warranty" element={<WarrantyPolicy />} />
              {/* 404 Catch-All Route */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </AdminAuthProvider>
    </ErrorBoundary>
  );
}

export default App;

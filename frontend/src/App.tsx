import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import MyOrders from "./pages/MyOrders";
import InvoiceDetail from "./pages/InvoiceDetail";
import PriceList from "./pages/PriceList";
import TermsAndConditions from "./pages/TermsAndConditions";
import WarrantyPolicy from "./pages/WarrantyPolicy";
import NotFound from "./pages/NotFound";
import { ScrollToTop } from "./components/ScrollToTop";

import { AdminAuthProvider } from "./context/AdminAuthContext";
import { AdminGuard } from "./components/admin/AdminGuard";
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminProfile from "./pages/admin/AdminProfile";

/**
 * Public Layout with Store Navbar & Footer
 */
function PublicLayout() {
  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AdminAuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Admin Login Route (Standalone) */}
          <Route path="/admin/login" element={<AdminLogin />} />
          {/* Quick Alias / Redirect for /login to Admin Login */}
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />

          {/* Protected Admin Routes under AdminGuard & AdminLayout */}
          <Route path="/admin" element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="profile" element={<AdminProfile />} />
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
  );
}

export default App;

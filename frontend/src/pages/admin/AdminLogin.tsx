import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, ShieldAlert, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAdmin, session } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Clear any leftover lockout data from previous sessions
  useEffect(() => {
    try {
      sessionStorage.removeItem("admin_lockout_until");
      sessionStorage.removeItem("admin_fail_count");
    } catch {}
  }, []);

  // If already authenticated as admin, redirect to target or /admin
  const from = (location.state as any)?.from?.pathname || "/admin";
  useEffect(() => {
    if (session && isAdmin) {
      navigate(from, { replace: true });
    }
  }, [session, isAdmin, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg("Harap masukkan email dan kata sandi.");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await login(trimmedEmail, password);
      setSubmitting(false);

      if (res.success) {
        navigate(from, { replace: true });
      } else {
        setErrorMsg(
          res.error === "Invalid login credentials"
            ? "Email atau kata sandi yang Anda masukkan salah. Periksa kembali data login Anda."
            : res.error || "Gagal masuk. Periksa email dan kata sandi Anda."
        );
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || "Terjadi kesalahan koneksi server.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#0E1016] text-black dark:text-gray-100 flex flex-col justify-center items-center p-4 sm:p-6">
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-6"
      >
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-black" />
            <span>PORTAL KEAMANAN ADMINISTRATOR</span>
          </div>

          <div className="flex justify-center items-center gap-3">
            <img 
              src="/nara-logov2.png" 
              alt="Nara Logo" 
              className="w-12 h-12 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] object-contain bg-white shrink-0" 
            />
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-none">
                Nara <span className="text-brand-blue">Premium</span>
              </h1>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mt-1">
                Admin Control Center
              </p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-6 sm:p-8 rounded-2xl space-y-6">
          
          <div className="border-b-2 border-black dark:border-gray-700 pb-4">
            <h2 className="text-lg sm:text-xl font-black text-black dark:text-white uppercase tracking-wide">
              Masuk Dashboard
            </h2>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
              Akses khusus pengelola toko. Masukkan email dan kata sandi terdaftar.
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-red-100 dark:bg-red-950/60 border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl flex items-start gap-2.5"
            >
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs font-extrabold text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label 
                htmlFor="admin-login-email" 
                className="block text-xs font-black uppercase text-gray-800 dark:text-gray-200 tracking-wider cursor-pointer"
              >
                Email Administrator
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  id="admin-login-email"
                  type="email"
                  value={email}
                  disabled={submitting}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan email admin..."
                  required
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-black dark:text-white font-medium text-sm rounded-xl focus:outline-none focus:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label 
                htmlFor="admin-login-password" 
                className="block text-xs font-black uppercase text-gray-800 dark:text-gray-200 tracking-wider cursor-pointer"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  id="admin-login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  disabled={submitting}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-black dark:text-white font-medium text-sm rounded-xl focus:outline-none focus:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black dark:hover:text-white p-1.5 cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-brand-blue outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 bg-brand-blue hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] neo-btn rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-400 outline-none"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <span>MASUK SEBAGAI ADMIN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Back to store link */}
        <div className="text-center">
          <Link
            to="/"
            className="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-blue rounded outline-none"
          >
            ← Kembali ke Katalog Nara Store
          </Link>
        </div>

      </motion.div>
    </div>
  );
}

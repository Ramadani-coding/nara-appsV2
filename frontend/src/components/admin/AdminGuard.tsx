import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { Loader2 } from "lucide-react";

export const AdminGuard: React.FC = () => {
  const { session, isAdmin, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#0E1016] flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 bg-brand-yellow border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
            <Loader2 className="w-6 h-6 text-black animate-spin" />
          </div>
          <h2 className="text-lg font-black text-black dark:text-white uppercase tracking-wider">
            Memeriksa Kredensial Admin...
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            Menghubungkan ke otentikasi Supabase & verifikasi hak akses RBAC.
          </p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface AdminProfile {
  id: string;
  email: string;
  role: string;
  fullName?: string;
}

interface AdminAuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  adminProfile: AdminProfile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setAdminProfile: React.Dispatch<React.SetStateAction<AdminProfile | null>>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper untuk mengecek role admin dari database public.users atau app_metadata
  const checkAdminRole = async (currentUser: User): Promise<boolean> => {
    try {
      // 1. Cek database tabel public.users (sumber kebenaran aplikasi)
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, full_name")
        .eq("id", currentUser.id)
        .single();

      if (!error && data && data.role === "admin") {
        setIsAdmin(true);
        setAdminProfile({
          id: data.id,
          email: data.email,
          role: data.role,
          fullName: data.full_name || "Administrator",
        });
        return true;
      }

      // 2. Cek app_metadata role dari Supabase JWT
      if (currentUser.app_metadata?.role === "admin") {
        setIsAdmin(true);
        setAdminProfile({
          id: currentUser.id,
          email: currentUser.email || "",
          role: "admin",
          fullName: (currentUser.user_metadata?.full_name as string) || "Administrator",
        });
        return true;
      }

      // Jika bukan role admin, tolak akses secara tegas tanpa pengecualian
      setIsAdmin(false);
      setAdminProfile(null);
      return false;
    } catch (err) {
      console.error("Error verifying admin role:", err);
      setIsAdmin(false);
      setAdminProfile(null);
      return false;
    }
  };

  const refreshProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        await checkAdminRole(currentUser);
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  useEffect(() => {
    // 1. Ambil session saat ini
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await checkAdminRole(initialSession.user);
        } else {
          setIsAdmin(false);
          setAdminProfile(null);
        }
      } catch (err) {
        console.error("Init auth error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // 2. Subscribe ke perubahan auth state (Context7 pattern)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await checkAdminRole(newSession.user);
        } else {
          setIsAdmin(false);
          setAdminProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        setIsLoading(false);
        return { success: false, error: "Gagal memverifikasi pengguna." };
      }

      const validAdmin = await checkAdminRole(data.user);
      if (!validAdmin) {
        // Sign out segera jika bukan role admin
        await supabase.auth.signOut();
        setIsLoading(false);
        return {
          success: false,
          error: "Akses ditolak: Akun Anda tidak memiliki hak akses Administrator ke sistem ini.",
        };
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || "Terjadi kesalahan saat masuk." };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setAdminProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        adminProfile,
        isLoading,
        login,
        logout,
        refreshProfile,
        setAdminProfile,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};

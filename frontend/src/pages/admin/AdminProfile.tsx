import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  User, 
  Mail, 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Loader2, 
  Save, 
  LogOut,
  Info,
  Clock,
  Sparkles
} from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { adminFetch } from "../../lib/api";

export default function AdminProfile() {
  const { user, adminProfile, refreshProfile, logout } = useAdminAuth();

  // Profile Form States
  const [fullName, setFullName] = useState(adminProfile?.fullName || "");
  const [email, setEmail] = useState(adminProfile?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state when adminProfile changes
  useEffect(() => {
    if (adminProfile) {
      setFullName(adminProfile.fullName || "");
      setEmail(adminProfile.email || "");
    }
  }, [adminProfile]);

  // Password Strength Calculation
  const calculateStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (pass.length >= 12) score += 15;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 25;
    if (/\d/.test(pass)) score += 20;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass)) score += 15;
    return Math.min(100, score);
  };

  const passStrength = calculateStrength(newPassword);

  const getStrengthLabel = (score: number) => {
    if (score === 0) return { label: "Belum diisi", color: "bg-gray-200 text-gray-500" };
    if (score < 40) return { label: "Lemah", color: "bg-red-500 text-white" };
    if (score < 75) return { label: "Sedang", color: "bg-amber-500 text-black" };
    return { label: "Sangat Kuat", color: "bg-emerald-500 text-white" };
  };

  const strengthInfo = getStrengthLabel(passStrength);

  // Handle Save Profile Info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (!trimmedEmail) {
      setProfileMsg({ type: "error", text: "Alamat email tidak boleh kosong." });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await adminFetch("/admin/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: trimmedName,
          email: trimmedEmail,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setProfileMsg({ 
          type: "success", 
          text: "Informasi profil dan email administrator berhasil diperbarui!" 
        });
        await refreshProfile();
      } else {
        setProfileMsg({ 
          type: "error", 
          text: json.message || "Gagal memperbarui profil." 
        });
      }
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message || "Terjadi kesalahan jaringan." });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentPassword) {
      setPasswordMsg({ type: "error", text: "Harap masukkan kata sandi saat ini untuk verifikasi." });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Kata sandi baru minimal harus 8 karakter." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Konfirmasi kata sandi baru tidak cocok." });
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordMsg({ type: "error", text: "Kata sandi baru tidak boleh sama dengan kata sandi saat ini." });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await adminFetch("/admin/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setPasswordMsg({ 
          type: "success", 
          text: "Kata sandi berhasil diubah! Kredensial baru Anda kini telah aktif." 
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg({ 
          type: "error", 
          text: json.message || "Gagal mengubah kata sandi." 
        });
      }
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Terjadi kesalahan server." });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* ========================================================
          PAGE HEADER
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider mb-2">
            <KeyRound className="w-3.5 h-3.5 text-black" />
            <span>AKUN & KEAMANAN</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-tight">
            Profil & Kredensial Admin
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
            Kelola identitas, ubah email login, dan perbarui kata sandi rahasia administrator Anda.
          </p>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-300 font-black text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Sesi</span>
        </button>
      </div>

      {/* Grid: 2 Columns on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ========================================================
            COLUMN 1: PROFIL & EMAIL (7 Cols)
           ======================================================== */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card: Informasi Profil */}
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl p-5 sm:p-6 space-y-5 text-black dark:text-white">
            
            <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-yellow border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                  <User className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black uppercase">Informasi Administrator</h2>
                  <p className="text-xs text-gray-500 font-bold">Identitas nama dan alamat email login</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-2 border-black dark:border-gray-700 rounded-lg text-[11px] font-black uppercase">
                Aktif
              </span>
            </div>

            {/* Profile Feedback Toast */}
            {profileMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 rounded-xl border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] flex items-start gap-2 text-xs font-black ${
                  profileMsg.type === "success"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200"
                    : "bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-200"
                }`}
              >
                {profileMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{profileMsg.text}</span>
              </motion.div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              {/* Nama Lengkap */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Nama Lengkap Admin
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nama Pengelola"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-sm font-bold rounded-xl focus:outline-none focus:border-brand-blue"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Alamat Email (Username Login)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@narapremium.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-sm font-bold font-mono rounded-xl focus:outline-none focus:border-brand-blue"
                  />
                </div>
                <p className="text-[11px] text-gray-500 font-medium">
                  ⚠️ <strong>Penting:</strong> Jika Anda mengubah email ini, gunakan email baru tersebut untuk login di kesempatan berikutnya.
                </p>
              </div>

              {/* Role & ID (Read-only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-gray-50 dark:bg-[#12141C] border border-gray-200 dark:border-gray-800 rounded-xl space-y-1">
                  <div className="text-[10px] font-black uppercase text-gray-500">HAK AKSES / PERAN</div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-yellow text-black border border-black rounded font-black text-xs uppercase">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ADMINISTRATOR</span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#12141C] border border-gray-200 dark:border-gray-800 rounded-xl space-y-1">
                  <div className="text-[10px] font-black uppercase text-gray-500">ID IDENTITAS (UUID)</div>
                  <div className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400 truncate">
                    {user?.id || "-"}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full sm:w-auto px-6 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Perubahan Profil</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>

          {/* Tips Keamanan Neo-Brutalist */}
          <div className="p-4 bg-brand-blue-soft dark:bg-[#1E293B] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-black dark:text-gray-200">
              <div className="font-black uppercase tracking-wider">
                STANDAR KEAMANAN AKUN NARA APPS:
              </div>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                Sistem tidak lagi menampilkan kredensial demo secara publik. Hanya Anda sebagai administrator yang mengetahui kata sandi dan email ini. Simpan kredensial Anda di tempat yang aman (seperti password manager).
              </p>
            </div>
          </div>

        </div>

        {/* ========================================================
            COLUMN 2: GANTI KATA SANDI (5 Cols)
           ======================================================== */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl p-5 sm:p-6 space-y-5 text-black dark:text-white">
            
            <div className="flex items-center gap-2.5 border-b-2 border-black dark:border-gray-700 pb-3.5">
              <div className="w-9 h-9 rounded-xl bg-brand-pink text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black uppercase">Ganti Kata Sandi</h2>
                <p className="text-xs text-gray-500 font-bold">Wajib verifikasi kata sandi lama</p>
              </div>
            </div>

            {/* Password Feedback Toast */}
            {passwordMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 rounded-xl border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] flex items-start gap-2 text-xs font-black ${
                  passwordMsg.type === "success"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200"
                    : "bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-200"
                }`}
              >
                {passwordMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{passwordMsg.text}</span>
              </motion.div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Kata Sandi Saat Ini
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan sandi aktif"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-sm font-medium rounded-xl focus:outline-none focus:border-brand-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black dark:hover:text-white p-1 cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Kata Sandi Baru (Min. 8 Karakter)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Sandi baru minimal 8 digit"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-sm font-medium rounded-xl focus:outline-none focus:border-brand-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black dark:hover:text-white p-1 cursor-pointer"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="pt-1.5 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span className="text-gray-500">Kekuatan Sandi:</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${strengthInfo.color}`}>
                        {strengthInfo.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden border border-black/30 dark:border-gray-700">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          passStrength < 40 
                            ? "bg-red-500" 
                            : passStrength < 75 
                            ? "bg-amber-500" 
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${passStrength}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Konfirmasi Kata Sandi Baru
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-sm font-medium rounded-xl focus:outline-none focus:border-brand-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black dark:hover:text-white p-1 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {confirmPassword && (
                  <div className="text-[11px] font-bold">
                    {newPassword === confirmPassword ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Kata sandi cocok</span>
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Kata sandi tidak cocok</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Change Password Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPassword || (newPassword !== confirmPassword && confirmPassword.length > 0)}
                  className="w-full py-3 bg-brand-pink hover:bg-pink-600 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi & Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Perbarui Kata Sandi</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>

          {/* Last Login Info */}
          <div className="p-4 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-2 font-black uppercase text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Sesi Aktif Saat Ini</span>
            </div>
            <div className="text-gray-600 dark:text-gray-300 font-medium">
              Login terakhir: <span className="font-mono font-bold text-black dark:text-white">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("id-ID") : "Sesi ini"}</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

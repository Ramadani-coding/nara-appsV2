export const COLORS = {
  primary: 0x3b82f6, // Blue
  accent: 0xec4899,  // Pink
  success: 0x10b981, // Emerald Green
  warning: 0xf59e0b, // Amber Yellow
  danger: 0xef4444,  // Red
  neutral: 0x64748b, // Slate Gray
};

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "-";
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date) + " WIB";
}

export interface StatusBadge {
  label: string;
  emoji: string;
  color: number;
}

export function formatStatusBadge(status: string): StatusBadge {
  switch (status?.toLowerCase()) {
    case "waiting_payment":
      return { label: "Menunggu Pembayaran", emoji: "🟡", color: COLORS.warning };
    case "paid":
      return { label: "Pembayaran Lunas", emoji: "🟢", color: COLORS.success };
    case "processing":
      return { label: "Sedang Diproses", emoji: "🔵", color: COLORS.primary };
    case "completed":
      return { label: "Selesai", emoji: "🎉", color: COLORS.success };
    case "failed":
    case "cancelled":
    case "cancel":
      return { label: "Gagal / Dibatalkan", emoji: "❌", color: COLORS.danger };
    case "expire":
    case "expired":
      return { label: "Kadaluarsa", emoji: "⏱️", color: COLORS.neutral };
    default:
      return { label: status || "Tidak Diketahui", emoji: "⚪", color: COLORS.neutral };
  }
}

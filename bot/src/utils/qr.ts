import QRCode from "qrcode";

/**
 * Menghasilkan buffer gambar PNG dari string QRIS (EMVCo) untuk di-attach ke embed Discord
 */
export async function generateQrBuffer(qrString: string): Promise<Buffer> {
  return QRCode.toBuffer(qrString, {
    type: "png",
    margin: 2,
    width: 400,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}

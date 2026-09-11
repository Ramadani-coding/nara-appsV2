import { orderService } from "../services/order.service.js";

async function run() {
  console.log("🚀 Testing Order Creation with Midtrans QRIS...");

  try {
    const result = await orderService.createOrderWithQris({
      productName: "CapCut Pro 1 Bulan (Test)",
      price: 15000,
      quantity: 1,
      customerPhone: "081234567890",
      customerEmail: "test@narastore.id",
    });

    console.log("✅ Order Created Successfully!");
    console.log("Order Number:", result.orderNumber);
    console.log("Total Amount:", result.totalAmount);
    console.log("QR Code URL:", result.payment.qrCodeUrl);
    console.log("Transaction ID:", result.payment.transactionId);
    console.log("Status:", result.status);

    console.log("\n🔍 Testing Sync Status with Midtrans...");
    const synced = await orderService.syncOrderStatusWithMidtrans(result.orderNumber);
    console.log("Synced Order Status:", synced?.status);
    console.log("Payment Status:", synced?.payments?.[0]?.status);

    console.log("\n🎉 Backend Order & Midtrans QRIS integration test passed!");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

run();

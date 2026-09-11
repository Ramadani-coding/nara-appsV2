import { orderService } from "../services/order.service.js";

async function run() {
  const orderNumber = "ORD-9183676819";
  console.log(`🚀 Testing Payment Settlement for ${orderNumber}...`);

  try {
    const result = await orderService.handlePaymentSettlement(orderNumber, {
      simulated: true,
      transaction_status: "settlement",
    });

    console.log("✅ Settlement Result Status:", result.order?.status);
    console.log("Paid At:", result.order?.paidAt);
    console.log("Deliveries count:", result.order?.deliveries?.length);
    if (result.order?.deliveries?.[0]) {
      console.log("Delivery Content:\n", result.order?.deliveries[0].content);
    }

    console.log("\nTesting Idempotency (settling again)...");
    const duplicate = await orderService.handlePaymentSettlement(orderNumber);
    console.log("Already processed flag:", duplicate.alreadyProcessed);

    console.log("\n🎉 Settlement & idempotency test passed!");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Settlement test failed:", err);
    process.exit(1);
  }
}

run();

import { db } from "../db/index.js";
import { orders } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { orderService } from "../services/order.service.js";

async function main() {
  const orderNumber = "ORD-3719157067";
  console.log("Calling syncOrderStatusWithMidtrans for:", orderNumber);
  const updatedOrder = await orderService.syncOrderStatusWithMidtrans(orderNumber);
  console.log("Updated order status:", updatedOrder?.status);
  console.log("Updated order deliveries:", JSON.stringify(updatedOrder?.deliveries, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { db } from "../db/index.js";
import { orders } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { premiumkuService } from "../services/premiumku.service.js";

async function main() {
  const orderNumber = "ORD-3719157067";
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true, payments: true, deliveries: true },
  });

  console.log("ORDER:", JSON.stringify(order, null, 2));

  if (order?.deliveries && order.deliveries.length > 0) {
    for (const d of order.deliveries) {
      console.log("DELIVERY CONTENT:", d.content);
      const match = d.content.match(/API-[0-9a-zA-Z-]+/);
      if (match) {
        console.log("Checking status for Premku invoice:", match[0]);
        const status = await premiumkuService.checkOrderStatus(match[0]);
        console.log("PREMKU STATUS RESULT:", JSON.stringify(status, null, 2));
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { db } from "../db/index.js";
import { orders, deliveries } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { premiumkuService } from "../services/premiumku.service.js";

async function run() {
  const target = "ORD-3602722497";
  console.log("Fixing delivery for order:", target);

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, target),
    with: { deliveries: true },
  });

  if (!order || !order.deliveries || order.deliveries.length === 0) {
    console.error("Order or deliveries not found");
    process.exit(1);
  }

  const del = order.deliveries[0];
  console.log("Current delivery content:", del.content);

  const match = del.content.match(/API-[0-9a-zA-Z-]+/);
  if (!match) {
    console.error("Invoice number not found in delivery content");
    process.exit(1);
  }

  const invoice = match[0];
  console.log("Found invoice:", invoice);

  const premkuStatus = await premiumkuService.checkOrderStatus(invoice);
  console.log("Premku Status:", JSON.stringify(premkuStatus, null, 2));

  if (premkuStatus.success && premkuStatus.accounts && premkuStatus.accounts.length > 0) {
    const newContent = JSON.stringify({
      invoice,
      accounts: premkuStatus.accounts,
    });

    await db
      .update(deliveries)
      .set({ content: newContent })
      .where(eq(deliveries.id, del.id));

    console.log("✅ Delivery content updated to real Premku accounts JSON!");
  } else {
    console.warn("No accounts returned from Premku");
  }

  process.exit(0);
}

run();

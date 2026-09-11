import { db } from "../db/index.js";
import { orders } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function run() {
  const target = "ORD-3602722497";
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, target),
    with: {
      items: true,
      payments: true,
      deliveries: true,
    },
  });

  console.log("Found order:", JSON.stringify(order, null, 2));
  process.exit(0);
}

run();

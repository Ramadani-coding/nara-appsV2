import { sqlClient } from "../db/index.js";

async function run() {
  console.log("Applying GoPay columns migration to database...");
  await sqlClient`ALTER TABLE orders ADD COLUMN IF NOT EXISTS unique_code integer NOT NULL DEFAULT 0;`;
  await sqlClient`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway varchar(50) NOT NULL DEFAULT 'gopay';`;
  await sqlClient`CREATE INDEX IF NOT EXISTS orders_payment_gateway_idx ON orders(payment_gateway);`;
  await sqlClient`ALTER TABLE payments ADD COLUMN IF NOT EXISTS qr_string text;`;
  console.log("✅ GoPay schema migration applied successfully!");
  await sqlClient.end();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});

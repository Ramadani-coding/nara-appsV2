import postgres from "postgres";

async function test() {
  const url = "postgresql://postgres.eakaptprmmpabiufgtwc:4hlwsC9tvzqZluCI@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";
  console.log("Connecting to pooler URL...");
  const sql = postgres(url, {
    prepare: false, // Required for transaction pooler
    connect_timeout: 10,
  });

  try {
    const result = await sql`SELECT NOW() as current_time, current_database(), current_user`;
    console.log("✅ POOLER SUCCESS! Connected to database:", result);
  } catch (err: any) {
    console.error("❌ Pooler connection failed:", err.message);
  } finally {
    await sql.end();
  }
}

test();

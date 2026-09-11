import "dotenv/config";

async function test() {
  const apiKey = process.env.PREMIUMKU_API_KEY;
  const baseUrl = (process.env.PREMIUMKU_BASE_URL || "https://premku.com/api").replace(/\/$/, "");
  const inv = "API-20260911074302-f21b";

  console.log("Checking invoice:", inv, "at baseUrl:", baseUrl);
  
  try {
    const res = await fetch(`${baseUrl}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "NaraStore/1.0",
      },
      body: JSON.stringify({
        api_key: apiKey,
        invoice: inv,
      }),
    });

    console.log("HTTP status:", res.status);
    const json = await res.json();
    console.log("Response JSON:\n", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

test();

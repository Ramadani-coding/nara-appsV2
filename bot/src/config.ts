import dotenv from "dotenv";
dotenv.config();

export interface BotConfig {
  discordToken: string;
  clientId: string;
  guildId?: string;
  backendUrl: string;
  botPort: number;
  storeName: string;
  adminPhone: string;
  storeUrl: string;
  isProduction: boolean;
}

export const config: BotConfig = {
  discordToken: process.env.DISCORD_BOT_TOKEN || "",
  clientId: process.env.DISCORD_CLIENT_ID || "",
  guildId: process.env.DISCORD_GUILD_ID || undefined,
  backendUrl: (process.env.BACKEND_URL || "http://localhost:5001/api").replace(/\/$/, ""),
  botPort: parseInt(process.env.BOT_PORT || "5002", 10),
  storeName: process.env.STORE_NAME || "Nara Digital Store",
  adminPhone: process.env.ADMIN_WHATSAPP_PHONE || "085750231336",
  storeUrl: process.env.STORE_WEBSITE_URL || "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
};

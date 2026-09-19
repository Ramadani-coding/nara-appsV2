import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { data as produkData } from "./commands/produk.js";
import { data as pesananSayaData } from "./commands/pesanan-saya.js";
import { data as bantuanData } from "./commands/bantuan.js";

const commands = [
  produkData.toJSON(),
  pesananSayaData.toJSON(),
  bantuanData.toJSON(),
];

if (!config.discordToken || !config.clientId) {
  console.error("❌ Error: DISCORD_BOT_TOKEN dan DISCORD_CLIENT_ID harus diisi di file .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(config.discordToken);

export async function deployCommands() {
  try {
    console.log(`⏳ Memulai registrasi ${commands.length} slash commands ke Discord API...`);

    if (config.guildId) {
      console.log(`📍 Mendaftarkan commands ke Server/Guild ID: ${config.guildId} (Instan)...`);
      const data: any = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`✅ Berhasil mendaftarkan ${data.length} slash commands pada guild ${config.guildId}!`);
    } else {
      console.log("🌐 Mendaftarkan commands secara Global ke seluruh server...");
      const data: any = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`✅ Berhasil mendaftarkan ${data.length} slash commands secara Global!`);
    }
  } catch (error) {
    console.error("❌ Gagal mendaftarkan slash commands:", error);
    throw error;
  }
}

deployCommands().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

import * as fs from "fs";
import * as dotenv from "dotenv";

// Load env BEFORE importing ens.ts (which reads process.env at module level)
dotenv.config({ path: ".env.local" });

async function main() {
  // Dynamic import so env vars are available
  const { createSubnameWithProfile, toProfileRecords } = await import("../lib/ens");

  const players = JSON.parse(fs.readFileSync("data/players.json", "utf-8"));

  for (const [, p] of Object.entries(players) as [string, any][]) {
    if (!p.username) continue;
    console.log(`Re-syncing ${p.username}.raidbattle.eth (encrypted)...`);
    const records = toProfileRecords(p);
    await createSubnameWithProfile(p.username, records);
    console.log(`  done!`);
  }
  console.log("\nAll players re-synced with encryption!");
}

main();

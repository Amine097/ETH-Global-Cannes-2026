import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { writePlayerIndex, readPlayerIndex, readProfile } = await import("../lib/ens");

  // Known subnames (add new ones here as needed)
  const { createPublicClient, http, namehash, parseAbi } = await import("viem");
  const { sepolia } = await import("viem/chains");

  const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL!) });
  const resAbi = parseAbi(["function text(bytes32,string) view returns (string)"]);
  const RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as const;

  const names = ["amine", "salah", "kalala", "aminenouira"];
  const index: Record<string, string> = {};

  console.log("Building player index from ENS subnames...");
  for (const name of names) {
    const node = namehash(`${name}.raidbattle.eth`);
    try {
      const pk = await client.readContract({ address: RESOLVER, abi: resAbi, functionName: "text", args: [node, "publicKey"] });
      if (pk) {
        index[pk.toLowerCase()] = name;
        console.log(`  ${name}: ${pk.slice(0, 20)}...`);
      }
    } catch { /* skip */ }
  }

  console.log(`\nWriting index to ENS (${Object.keys(index).length} players)...`);
  await writePlayerIndex(index);
  console.log("Done!");

  // Verify
  const readBack = await readPlayerIndex();
  console.log("\nVerification — read back:", readBack);
}

main().catch(console.error);

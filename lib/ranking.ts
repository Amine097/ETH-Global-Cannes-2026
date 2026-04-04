import { getAllProfiles } from "./store";
import { writeRankingToEns } from "./ens";

/**
 * Recomputes the full global ranking from the local JSON store
 * and persists it encrypted on raidbattle.eth (fire-and-forget safe).
 *
 * Sorted by: level DESC, then XP DESC.
 * Stored as: { _total: N, "0xpk...": position, ... } encrypted on ENS.
 */
export async function computeAndSyncRanking(): Promise<void> {
  const players = getAllProfiles();
  if (players.length === 0) return;

  const sorted = [...players].sort((a, b) =>
    b.level !== a.level ? b.level - a.level : b.xp - a.xp
  );

  const positions: Record<string, number> = {};
  sorted.forEach((p, i) => {
    positions[p.publicKey.toLowerCase()] = i + 1;
  });

  await writeRankingToEns(positions, players.length);
}

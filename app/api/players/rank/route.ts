import { NextRequest, NextResponse } from "next/server";
import { getAllProfiles } from "@/lib/store";
import { readRankingFromEns, readPlayerIndex, readProfile } from "@/lib/ens";

export async function GET(req: NextRequest) {
  const pk = req.nextUrl.searchParams.get("pk");
  if (!pk) return NextResponse.json({ error: "Missing pk" }, { status: 400 });

  const pkLower = pk.toLowerCase();

  // ── Try local JSON first (fast) ──
  const all = getAllProfiles();
  if (all.length > 0) {
    const sorted = [...all].sort((a, b) =>
      b.level !== a.level ? b.level - a.level : b.xp - a.xp
    );
    const position =
      sorted.findIndex((p) => p.publicKey.toLowerCase() === pkLower) + 1;
    if (position > 0) {
      return NextResponse.json({ position, total: all.length });
    }
  }

  // ── Fallback: read encrypted ranking from ENS ──
  try {
    const ensRanking = await readRankingFromEns();
    if (ensRanking) {
      const position = ensRanking.positions[pkLower] ?? null;
      return NextResponse.json({ position, total: ensRanking.total });
    }
  } catch (err) {
    console.error("[Ranking] ENS ranking fallback failed:", err);
  }

  // ── Last resort: build ranking from ENS player index + profiles ──
  try {
    const index = await readPlayerIndex();
    if (index) {
      const entries: { pk: string; level: number; xp: number }[] = [];
      for (const [key, username] of Object.entries(index)) {
        try {
          const profile = await readProfile(username);
          if (profile) {
            entries.push({
              pk: key,
              level: parseInt(profile.level) || 1,
              xp: parseInt(profile.xp) || 0,
            });
          }
        } catch { /* skip */ }
      }
      entries.sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);
      const position = entries.findIndex((e) => e.pk === pkLower) + 1;
      return NextResponse.json({ position: position || null, total: entries.length });
    }
  } catch (err) {
    console.error("[Ranking] ENS index fallback failed:", err);
  }

  return NextResponse.json({ position: null, total: 0 });
}

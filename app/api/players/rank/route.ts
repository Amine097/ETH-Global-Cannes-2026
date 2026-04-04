import { NextRequest, NextResponse } from "next/server";
import { getProfile, getAllProfiles } from "@/lib/store";
import { readRankingFromEns } from "@/lib/ens";

export async function GET(req: NextRequest) {
  const pk = req.nextUrl.searchParams.get("pk");
  if (!pk) return NextResponse.json({ error: "Missing pk" }, { status: 400 });

  const player = getProfile(pk);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // ── Fast path: compute from local JSON store ──
  const all = getAllProfiles();
  if (all.length > 0) {
    const sorted = [...all].sort((a, b) =>
      b.level !== a.level ? b.level - a.level : b.xp - a.xp
    );
    const position =
      sorted.findIndex((p) => p.publicKey.toLowerCase() === pk.toLowerCase()) + 1;
    return NextResponse.json({ position, total: all.length });
  }

  // ── Fallback: read encrypted ranking from ENS ──
  try {
    const ensRanking = await readRankingFromEns();
    if (ensRanking) {
      const position = ensRanking.positions[pk.toLowerCase()] ?? null;
      return NextResponse.json({ position, total: ensRanking.total });
    }
  } catch (err) {
    console.error("[Ranking] ENS fallback failed:", err);
  }

  return NextResponse.json({ position: null, total: 0 });
}

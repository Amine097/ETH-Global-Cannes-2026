import { NextRequest, NextResponse } from "next/server";
import { getAllProfiles } from "@/lib/store";
import { readPlayerIndex, readProfile } from "@/lib/ens";

const ADMIN_PK = "046bae40b1f4fed8ef310b3d526f99d84ee2cf4bfeb999cc2bceb35c49ad42f1911c854d9b41706ba3630e82ffcc1bccc2fb14255bcf6193b872cea9163ffd62ff";

export async function GET(req: NextRequest) {
  const pk = req.nextUrl.searchParams.get("pk");
  if (!pk || pk.toLowerCase() !== ADMIN_PK.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // ── Try local JSON first ──
  const local = getAllProfiles();
  if (local.length > 0) {
    const sorted = [...local].sort((a, b) =>
      b.level !== a.level ? b.level - a.level : b.xp - a.xp
    );
    return NextResponse.json({
      leaderboard: sorted.map((p, i) => ({
        position: i + 1,
        username: p.username,
        level: p.level,
        xp: p.xp,
        rank: p.rank,
        skinIndex: p.skinIndex,
        publicKey: p.publicKey.slice(0, 10) + "...",
      })),
    });
  }

  // ── Fallback: build from ENS ──
  try {
    const index = await readPlayerIndex();
    if (!index) return NextResponse.json({ leaderboard: [] });

    const entries: { username: string; level: number; xp: number; rank: string; skinIndex: number; pk: string }[] = [];
    for (const [key, username] of Object.entries(index)) {
      try {
        const profile = await readProfile(username);
        if (profile) {
          entries.push({
            username,
            level: parseInt(profile.level) || 1,
            xp: parseInt(profile.xp) || 0,
            rank: profile.rank || "bronze",
            skinIndex: parseInt(profile.skinIndex) || 1,
            pk: key.slice(0, 10) + "...",
          });
        }
      } catch { /* skip */ }
    }

    entries.sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);

    return NextResponse.json({
      leaderboard: entries.map((e, i) => ({
        position: i + 1,
        username: e.username,
        level: e.level,
        xp: e.xp,
        rank: e.rank,
        skinIndex: e.skinIndex,
        publicKey: e.pk,
      })),
    });
  } catch (err) {
    console.error("[Leaderboard] Failed:", err);
    return NextResponse.json({ leaderboard: [] });
  }
}

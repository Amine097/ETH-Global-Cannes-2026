import { NextRequest, NextResponse } from "next/server";
import { isRegistered, getProfileFromEns, getProfile, saveBinding } from "@/lib/store";

export async function GET(req: NextRequest) {
  const pk = req.nextUrl.searchParams.get("pk");
  if (!pk) {
    return NextResponse.json({ error: "Missing pk" }, { status: 400 });
  }

  // Check registration via JSON + ENS index
  const check = await isRegistered(pk);
  if (!check.registered) {
    return NextResponse.json({ registered: false });
  }

  // Read full profile from ENS (falls back to JSON)
  const profile = await getProfileFromEns(pk);

  // ── Hydrate local cache so future requests (battle, etc.) find the player instantly ──
  if (profile && profile.username && !getProfile(pk)) {
    saveBinding({
      playerId: profile.publicKey,
      publicKey: profile.publicKey,
      etherAddress: profile.etherAddress,
      username: profile.username,
      linkedAt: new Date(profile.linkedAt || Date.now()),
    });
  }

  return NextResponse.json({
    registered: true,
    player: {
      publicKey: profile?.publicKey ?? pk.toLowerCase(),
      etherAddress: profile?.etherAddress ?? "",
      username: profile?.username ?? check.username ?? null,
      xp: profile?.xp ?? 0,
      level: profile?.level ?? 1,
      rank: profile?.rank ?? "bronze",
      skinIndex: profile?.skinIndex ?? 1,
      walletAddress: profile?.walletAddress ?? "",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getBindingByPublicKey, getProfileFromEns } from "@/lib/store";

export async function GET(req: NextRequest) {
  const pk = req.nextUrl.searchParams.get("pk");
  if (!pk) {
    return NextResponse.json({ error: "Missing pk" }, { status: 400 });
  }

  const binding = getBindingByPublicKey(pk);
  if (!binding) {
    return NextResponse.json({ registered: false });
  }

  // Read profile data from ENS (falls back to JSON)
  const profile = await getProfileFromEns(pk);

  return NextResponse.json({
    registered: true,
    player: {
      publicKey: binding.publicKey,
      etherAddress: binding.etherAddress,
      username: binding.username ?? null,
      xp: profile?.xp ?? 0,
      level: profile?.level ?? 1,
      rank: profile?.rank ?? "bronze",
      skinIndex: profile?.skinIndex ?? 1,
      walletAddress: profile?.walletAddress ?? "",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { updateProfile, getProfile, getProfileFromEns, saveBindingLocal } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { publicKey, walletAddress } = (await req.json()) as {
    publicKey?: string;
    walletAddress?: string;
  };

  if (!publicKey || !walletAddress) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Try local JSON first, then ENS
  let profile = getProfile(publicKey);
  if (!profile) {
    profile = await getProfileFromEns(publicKey);
  }

  if (!profile) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Ensure player exists in local JSON (hydrate from ENS if needed)
  if (!getProfile(publicKey)) {
    saveBindingLocal({
      playerId: profile.publicKey,
      publicKey: profile.publicKey,
      etherAddress: profile.etherAddress,
      username: profile.username,
      linkedAt: new Date(profile.linkedAt),
    });
  }

  updateProfile(publicKey, { walletAddress: walletAddress.toLowerCase() });

  return NextResponse.json({ success: true, walletAddress: walletAddress.toLowerCase() });
}

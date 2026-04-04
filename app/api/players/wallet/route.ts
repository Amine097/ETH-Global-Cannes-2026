import { NextRequest, NextResponse } from "next/server";
import { updateProfile, getProfile } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { publicKey, walletAddress } = (await req.json()) as {
    publicKey?: string;
    walletAddress?: string;
  };

  if (!publicKey || !walletAddress) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const profile = getProfile(publicKey);
  if (!profile) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  updateProfile(publicKey, { walletAddress: walletAddress.toLowerCase() });

  return NextResponse.json({ success: true, walletAddress: walletAddress.toLowerCase() });
}

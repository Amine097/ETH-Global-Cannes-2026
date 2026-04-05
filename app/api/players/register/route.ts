import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  getBindingByPublicKey,
  getBindingByUsername,
  saveBinding,
  isRegistered,
} from "@/lib/store";
import { subnameExists } from "@/lib/ens";

export async function POST(req: NextRequest) {
  const { challenge, signature, publicKey, etherAddress, username } = (await req.json()) as {
    challenge?: string;
    signature?: string;
    publicKey?: string;
    etherAddress?: string;
    username?: string;
  };

  if (!challenge || !signature || !publicKey || !etherAddress) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!/^[0-9a-f]{64}$/.test(challenge)) {
    return NextResponse.json({ error: "Invalid challenge format" }, { status: 400 });
  }

  try {
    const digest = ethers.getBytes("0x" + challenge);
    const recovered = ethers.recoverAddress(digest, signature);
    if (recovered.toLowerCase() !== etherAddress.toLowerCase()) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  // Check if already registered — local JSON + ENS index
  const existing = getBindingByPublicKey(publicKey);
  if (existing?.username) {
    return NextResponse.json({ success: true, player: existing, alreadyRegistered: true });
  }
  // Also check ENS (Vercel cold start: JSON may be empty)
  const ensCheck = await isRegistered(publicKey);
  if (ensCheck.registered && ensCheck.username) {
    return NextResponse.json({
      success: true,
      player: { publicKey: publicKey.toLowerCase(), username: ensCheck.username },
      alreadyRegistered: true,
    });
  }

  // Validate username
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }
  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return NextResponse.json({ error: "Username must be 2-20 characters" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return NextResponse.json({ error: "Only letters, numbers, _ and -" }, { status: 400 });
  }

  // Check username uniqueness — local JSON + ENS
  const takenLocal = getBindingByUsername(trimmed);
  if (takenLocal) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }
  try {
    const takenEns = await subnameExists(trimmed);
    if (takenEns) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  } catch { /* ENS check failed, proceed — worst case duplicate gets a tx revert */ }

  // Create the player
  const binding = {
    playerId: publicKey.toLowerCase(),
    publicKey: publicKey.toLowerCase(),
    etherAddress: etherAddress.toLowerCase(),
    username: trimmed,
    linkedAt: new Date(),
  };
  saveBinding(binding);
  // Note: saveBinding triggers syncToEns which creates the subname + updates the index
  // No separate updateProfile needed — worldId is set in syncToEns records

  return NextResponse.json({ success: true, player: binding, isNew: true }, { status: 201 });
}

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

  // ── STRICT CHECK: is this publicKey already registered? ──
  // Check 1: local JSON cache
  const existingLocal = getBindingByPublicKey(publicKey);
  if (existingLocal?.username) {
    return NextResponse.json({ success: true, player: existingLocal, alreadyRegistered: true });
  }
  // Check 2: ENS player index (authoritative)
  try {
    const ensCheck = await isRegistered(publicKey);
    if (ensCheck.registered && ensCheck.username) {
      return NextResponse.json({
        success: true,
        player: { publicKey: publicKey.toLowerCase(), username: ensCheck.username },
        alreadyRegistered: true,
      });
    }
  } catch (err) {
    // ENS check failed — REFUSE registration to be safe (prevent duplicates)
    console.error("[Register] ENS check failed, refusing registration:", err);
    return NextResponse.json(
      { error: "Could not verify identity. Please try again." },
      { status: 503 }
    );
  }

  // ── Validate username ──
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return NextResponse.json({ error: "Username must be 2-20 characters" }, { status: 400 });
  }
  if (!/^[a-z0-9_-]+$/.test(trimmed)) {
    return NextResponse.json({ error: "Only lowercase letters, numbers, _ and -" }, { status: 400 });
  }

  // ── STRICT CHECK: is this username already taken? ──
  const takenLocal = getBindingByUsername(trimmed);
  if (takenLocal) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }
  try {
    const takenEns = await subnameExists(trimmed);
    if (takenEns) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  } catch (err) {
    // ENS check failed — REFUSE to be safe
    console.error("[Register] ENS username check failed:", err);
    return NextResponse.json(
      { error: "Could not verify username. Please try again." },
      { status: 503 }
    );
  }

  // ── Create the player ──
  const binding = {
    playerId: publicKey.toLowerCase(),
    publicKey: publicKey.toLowerCase(),
    etherAddress: etherAddress.toLowerCase(),
    username: trimmed,
    linkedAt: new Date(),
  };
  saveBinding(binding);
  // saveBinding triggers syncToEns → creates subname + updates player index

  return NextResponse.json({ success: true, player: binding, isNew: true }, { status: 201 });
}

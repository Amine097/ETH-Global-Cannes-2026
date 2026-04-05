import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getBindingByPublicKey, getBindingByUsername, saveBindingLocal, isRegistered } from "@/lib/store";
import { subnameExists, createSubnameWithProfile, writePlayerIndex, readPlayerIndex, toProfileRecords } from "@/lib/ens";

// ── ENS INTEGRATION — Registration writes player profile + index on-chain ──

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

  // Verify bracelet signature
  try {
    const digest = ethers.getBytes("0x" + challenge);
    const recovered = ethers.recoverAddress(digest, signature);
    if (recovered.toLowerCase() !== etherAddress.toLowerCase()) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  // ── CHECK 1: is this publicKey already registered? (ENS is authoritative) ──
  const existingLocal = getBindingByPublicKey(publicKey);
  if (existingLocal?.username) {
    return NextResponse.json({ success: true, player: existingLocal, alreadyRegistered: true });
  }
  try {
    const ensCheck = await isRegistered(publicKey);
    if (ensCheck.registered && ensCheck.username) {
      return NextResponse.json({
        success: true,
        player: { publicKey: publicKey.toLowerCase(), username: ensCheck.username },
        alreadyRegistered: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify identity. Please try again." }, { status: 503 });
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

  // ── CHECK 2: is this username already taken? (ENS is authoritative) ──
  const takenLocal = getBindingByUsername(trimmed);
  if (takenLocal) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }
  try {
    const takenEns = await subnameExists(trimmed);
    if (takenEns) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify username. Please try again." }, { status: 503 });
  }

  // ── WRITE TO ENS (synchronous — wait for confirmation) ──
  const pk = publicKey.toLowerCase();
  const addr = etherAddress.toLowerCase();
  const now = new Date().toISOString();

  try {
    // 1. Create subname + text records on ENS
    const records = toProfileRecords({
      publicKey: pk,
      etherAddress: addr,
      xp: 0,
      level: 1,
      rank: "bronze",
      skinIndex: 1,
      linkedAt: now,
    });
    await createSubnameWithProfile(trimmed, records);

    // 2. Update player index on ENS
    const index = (await readPlayerIndex()) ?? {};
    index[pk] = trimmed;
    await writePlayerIndex(index);
  } catch (err) {
    console.error("[Register] ENS write failed:", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }

  // ── Save to local cache (for this serverless instance) ──
  saveBindingLocal({
    playerId: pk,
    publicKey: pk,
    etherAddress: addr,
    username: trimmed,
    linkedAt: new Date(),
  });

  return NextResponse.json({
    success: true,
    player: { publicKey: pk, etherAddress: addr, username: trimmed },
    isNew: true,
  }, { status: 201 });
}

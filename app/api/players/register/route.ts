import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { consumeChallenge, getBindingByPublicKey, getBindingByUsername, saveBinding, updateProfile } from "@/lib/store";

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

  // Check if already registered
  const existing = getBindingByPublicKey(publicKey);
  if (existing) {
    // If re-registering with a username, update it
    if (username && !existing.username) {
      existing.username = username.trim();
      saveBinding(existing);
    }
    return NextResponse.json({ success: true, player: existing, alreadyRegistered: true });
  }

  // Validate username if provided
  let trimmedUsername: string | undefined;
  if (username) {
    trimmedUsername = username.trim();
    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      return NextResponse.json({ error: "Username must be 2-20 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json({ error: "Only letters, numbers, _ and -" }, { status: 400 });
    }
    const taken = getBindingByUsername(trimmedUsername);
    if (taken) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  }

  const binding = {
    playerId: publicKey.toLowerCase(),
    publicKey: publicKey.toLowerCase(),
    etherAddress: etherAddress.toLowerCase(),
    username: trimmedUsername,
    linkedAt: new Date(),
  };
  saveBinding(binding);

  // User went through World ID verification before reaching registration
  updateProfile(publicKey, { worldId: "verified" });

  return NextResponse.json({ success: true, player: binding, isNew: true }, { status: 201 });
}

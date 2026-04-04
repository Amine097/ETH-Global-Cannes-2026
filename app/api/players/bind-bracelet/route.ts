import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  consumeChallenge,
  getBindingByPublicKey,
  getBindingByPlayer,
  saveBinding,
} from "@/lib/store";

interface BindBody {
  playerId: string;
  challenge: string;
  signature: string;
  publicKey: string;
  etherAddress: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<BindBody>;
  const { playerId, challenge, signature, publicKey, etherAddress } = body;

  if (!playerId || !challenge || !signature || !publicKey || !etherAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!/^[0-9a-f]{64}$/.test(challenge)) {
    return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!/^04[0-9a-fA-F]{128}$/.test(publicKey)) {
    return NextResponse.json({ error: "Invalid publicKey" }, { status: 400 });
  }

  if (!consumeChallenge(challenge)) {
    return NextResponse.json({ error: "Challenge invalid or expired" }, { status: 400 });
  }

  if (!verifyHaloSignature(challenge, signature, etherAddress)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const existingByKey = getBindingByPublicKey(publicKey);
  if (existingByKey) {
    if (existingByKey.playerId === playerId) {
      return NextResponse.json({ success: true, binding: existingByKey, alreadyLinked: true });
    }
    return NextResponse.json({ error: "Bracelet already linked to another player" }, { status: 409 });
  }

  const existingByPlayer = getBindingByPlayer(playerId);
  if (existingByPlayer) {
    return NextResponse.json({ error: "Player already has a bracelet" }, { status: 409 });
  }

  const binding = {
    playerId,
    publicKey: publicKey.toLowerCase(),
    etherAddress: etherAddress.toLowerCase(),
    linkedAt: new Date(),
  };
  saveBinding(binding);

  return NextResponse.json({ success: true, binding }, { status: 201 });
}

function verifyHaloSignature(challengeHex: string, signature: string, expectedAddress: string): boolean {
  try {
    const digest = ethers.getBytes("0x" + challengeHex);
    const recovered = ethers.recoverAddress(digest, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

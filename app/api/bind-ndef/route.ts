import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  getBindingByPublicKey,
  getBindingByPlayer,
  saveBinding,
} from "@/lib/store";

interface NdefBindBody {
  playerId: string;
  pk1: string;
  rnd: string;
  rndsig: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<NdefBindBody>;
  const { playerId, pk1, rnd, rndsig } = body;

  if (!playerId || !pk1 || !rnd || !rndsig) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Derive ether address from public key
  const etherAddress = ethers.computeAddress("0x" + pk1);

  // Verify the NDEF signature: rndsig is ECDSA over sha256(rnd)
  try {
    const rndBytes = ethers.getBytes("0x" + rnd);
    const digest = ethers.sha256(rndBytes);
    const recovered = ethers.recoverAddress(digest, "0x" + rndsig);
    if (recovered.toLowerCase() !== etherAddress.toLowerCase()) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  // Check existing bindings
  const existingByKey = getBindingByPublicKey(pk1);
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
    publicKey: pk1.toLowerCase(),
    etherAddress: etherAddress.toLowerCase(),
    linkedAt: new Date(),
  };
  saveBinding(binding);

  return NextResponse.json({ success: true, binding }, { status: 201 });
}

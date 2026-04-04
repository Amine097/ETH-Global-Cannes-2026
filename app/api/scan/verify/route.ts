import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { consumeChallenge, getBindingByPublicKey, generateBindingCode } from "@/lib/store";

interface ScanBody {
  challenge: string;
  signature: string;
  publicKey: string;
  etherAddress: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<ScanBody>;
  const { challenge, signature, publicKey, etherAddress } = body;

  if (!challenge || !signature || !publicKey || !etherAddress) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!consumeChallenge(challenge)) {
    return NextResponse.json({ error: "Challenge invalid or expired" }, { status: 400 });
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

  const existing = getBindingByPublicKey(publicKey);
  if (existing) {
    return NextResponse.json({ error: "Bracelet already bound", alreadyBound: true }, { status: 409 });
  }

  const code = generateBindingCode(publicKey, etherAddress);
  return NextResponse.json({ code, etherAddress });
}

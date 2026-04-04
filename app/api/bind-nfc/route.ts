import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { generateBindingCode, getBindingByPublicKey } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { pk1, rnd, rndsig } = (await req.json()) as {
    pk1?: string;
    rnd?: string;
    rndsig?: string;
  };

  if (!pk1 || !rnd || !rndsig) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const etherAddress = ethers.computeAddress("0x" + pk1);

  try {
    const digest = ethers.getBytes("0x" + rnd);
    const recovered = ethers.recoverAddress(digest, "0x" + rndsig);
    if (recovered.toLowerCase() !== etherAddress.toLowerCase()) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const existing = getBindingByPublicKey(pk1);
  if (existing) {
    return NextResponse.json({ error: "Bracelet already bound", alreadyBound: true }, { status: 409 });
  }

  const code = generateBindingCode(pk1, etherAddress);
  return NextResponse.json({ code, etherAddress });
}

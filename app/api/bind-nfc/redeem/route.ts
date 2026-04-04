import { NextRequest, NextResponse } from "next/server";
import {
  consumeBindingCode,
  getBindingByPlayer,
  getBindingByPublicKey,
  saveBinding,
} from "@/lib/store";

export async function POST(req: NextRequest) {
  const { code, playerId } = (await req.json()) as {
    code?: string;
    playerId?: string;
  };

  if (!code || !playerId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const bracelet = consumeBindingCode(code);
  if (!bracelet) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  if (getBindingByPublicKey(bracelet.publicKey)) {
    return NextResponse.json({ error: "Bracelet already linked" }, { status: 409 });
  }
  if (getBindingByPlayer(playerId)) {
    return NextResponse.json({ error: "Player already has a bracelet" }, { status: 409 });
  }

  const binding = {
    playerId,
    publicKey: bracelet.publicKey.toLowerCase(),
    etherAddress: bracelet.etherAddress.toLowerCase(),
    linkedAt: new Date(),
  };
  saveBinding(binding);

  return NextResponse.json({ success: true, binding }, { status: 201 });
}

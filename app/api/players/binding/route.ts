import { NextRequest, NextResponse } from "next/server";
import { getBindingByPlayer } from "@/lib/store";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
  }
  const binding = getBindingByPlayer(playerId);
  if (!binding) {
    return NextResponse.json({ bound: false }, { status: 200 });
  }
  return NextResponse.json({
    bound: true,
    etherAddress: binding.etherAddress,
    publicKey: binding.publicKey,
    linkedAt: binding.linkedAt,
  });
}

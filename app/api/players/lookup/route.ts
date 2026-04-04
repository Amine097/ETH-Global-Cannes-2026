import { NextRequest, NextResponse } from "next/server";
import { getBindingByPublicKey } from "@/lib/store";

export async function GET(req: NextRequest) {
  const pk = req.nextUrl.searchParams.get("pk");
  if (!pk) {
    return NextResponse.json({ error: "Missing pk" }, { status: 400 });
  }

  const binding = getBindingByPublicKey(pk);
  if (!binding) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    playerId: binding.playerId,
    etherAddress: binding.etherAddress,
  });
}

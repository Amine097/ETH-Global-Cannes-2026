import { NextRequest, NextResponse } from "next/server";
import { setUsername, getBindingByUsername } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { publicKey, username } = (await req.json()) as {
    publicKey?: string;
    username?: string;
  };

  if (!publicKey || !username) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return NextResponse.json({ error: "Username must be 2-20 characters" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return NextResponse.json({ error: "Only letters, numbers, _ and -" }, { status: 400 });
  }

  const existing = getBindingByUsername(trimmed);
  if (existing && existing.publicKey !== publicKey.toLowerCase()) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const updated = setUsername(publicKey, trimmed);
  if (!updated) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    player: {
      publicKey: updated.publicKey,
      etherAddress: updated.etherAddress,
      username: updated.username,
      ensName: `${trimmed.toLowerCase()}.eth`,
    },
  });
}

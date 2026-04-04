import { signRequest } from "@worldcoin/idkit/signing";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { action } = (await req.json()) as { action?: string };

  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const rpId = process.env.WLD_RP_ID;
  const signingKey = process.env.WLD_SIGNING_KEY;

  if (!rpId || !signingKey) {
    console.error("Missing WLD_RP_ID or WLD_SIGNING_KEY in env");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey, 300);

    return NextResponse.json({
      rp_context: {
        rp_id: rpId,
        nonce,
        created_at: createdAt,
        expires_at: expiresAt,
        signature: sig,
      },
    });
  } catch (err) {
    console.error("signRequest failed:", err);
    return NextResponse.json({ error: "Failed to sign request" }, { status: 500 });
  }
}

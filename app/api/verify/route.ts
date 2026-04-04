import { NextRequest, NextResponse } from "next/server";

const RP_ID = process.env.WLD_RP_ID ?? "";

export async function POST(req: NextRequest) {
  const proof = await req.json();

  const res = await fetch(
    `https://developer.world.org/api/v4/verify/${RP_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proof),
    }
  );

  const result = await res.json();

  if (res.ok) {
    return NextResponse.json({ success: true, result }, { status: 200 });
  } else {
    console.error("World ID verify failed:", result);
    return NextResponse.json({ success: false, result }, { status: 400 });
  }
}

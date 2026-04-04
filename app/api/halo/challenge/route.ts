import { NextResponse } from "next/server";
import { generateChallenge } from "@/lib/store";

export async function POST() {
  const challenge = generateChallenge();
  return NextResponse.json({ challenge });
}

import { NextRequest, NextResponse } from "next/server";
import {
  createBattle,
  getPendingBattle,
  getBattle,
  respondBattle,
  resolveBattle,
} from "@/lib/battle";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body as { action: string };

  // ── Initiate a battle ──
  if (action === "initiate") {
    const { attackerPk, defenderPk } = body;
    if (!attackerPk || !defenderPk) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const result = createBattle(attackerPk, defenderPk);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ battle: result });
  }

  // ── Poll for incoming battle invite ──
  if (action === "poll-invite") {
    const { playerPk } = body;
    if (!playerPk) {
      return NextResponse.json({ error: "Missing playerPk" }, { status: 400 });
    }
    const battle = getPendingBattle(playerPk);
    return NextResponse.json({ battle: battle ?? null });
  }

  // ── Accept or decline ──
  if (action === "respond") {
    const { battleId, accept } = body;
    if (!battleId || accept === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const battle = respondBattle(battleId, accept);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found or already responded" }, { status: 404 });
    }
    return NextResponse.json({ battle });
  }

  // ── Resolve battle (called after countdown) ��─
  if (action === "resolve") {
    const { battleId } = body;
    if (!battleId) {
      return NextResponse.json({ error: "Missing battleId" }, { status: 400 });
    }
    const battle = resolveBattle(battleId);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found or not accepted" }, { status: 404 });
    }
    return NextResponse.json({ battle });
  }

  // ── Poll battle status ──
  if (action === "poll-status") {
    const { battleId } = body;
    if (!battleId) {
      return NextResponse.json({ error: "Missing battleId" }, { status: 400 });
    }
    const battle = getBattle(battleId);
    return NextResponse.json({ battle: battle ?? null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

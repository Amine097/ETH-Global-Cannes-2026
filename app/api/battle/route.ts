import { NextRequest, NextResponse } from "next/server";
import {
  createBattle,
  getPendingBattle,
  getBattle,
  respondBattle,
  submitTaps,
  submitReactions,
  resolveBattle,
} from "@/lib/battle";
import { computeAndSyncRanking } from "@/lib/ranking";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body as { action: string };

  // ── Initiate a battle ──
  if (action === "initiate") {
    const { attackerPk, defenderPk, mode, wagerAmount } = body;
    if (!attackerPk || !defenderPk) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const result = createBattle(attackerPk, defenderPk, mode ?? "free", wagerAmount);
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
    return NextResponse.json({ battle, serverTime: Date.now() });
  }

  // ── Submit tap count (taps minigame) ──
  if (action === "submit-taps") {
    const { battleId, role, taps } = body;
    if (!battleId || !role || taps === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const battle = submitTaps(battleId, role, taps);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }
    return NextResponse.json({ battle, serverTime: Date.now() });
  }

  // ── Submit reaction times (reaction minigame) ──
  if (action === "submit-reactions") {
    const { battleId, role, reactions } = body;
    if (!battleId || !role || !Array.isArray(reactions)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const battle = submitReactions(battleId, role, reactions);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }
    return NextResponse.json({ battle, serverTime: Date.now() });
  }

  // ── Resolve battle ──
  if (action === "resolve") {
    const { battleId } = body;
    if (!battleId) {
      return NextResponse.json({ error: "Missing battleId" }, { status: 400 });
    }
    const battle = resolveBattle(battleId);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found or not accepted" }, { status: 404 });
    }
    computeAndSyncRanking().catch((err) =>
      console.error("[Ranking] Failed to sync to ENS:", err)
    );
    return NextResponse.json({ battle });
  }

  // ── Poll battle status ──
  if (action === "poll-status") {
    const { battleId } = body;
    if (!battleId) {
      return NextResponse.json({ error: "Missing battleId" }, { status: 400 });
    }
    const battle = getBattle(battleId);
    return NextResponse.json({ battle: battle ?? null, serverTime: Date.now() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

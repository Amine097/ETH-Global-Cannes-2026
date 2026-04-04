import { NextRequest, NextResponse } from "next/server";
import { getEscrowAddress, sendPayout, getEscrowBalance } from "@/lib/escrow";
import { getBattle } from "@/lib/battle";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body as { action: string };

  // ── Get escrow address (for players to send deposits) ──
  if (action === "get-address") {
    return NextResponse.json({
      escrowAddress: getEscrowAddress(),
      network: "sepolia",
    });
  }

  // ── Confirm deposit was sent (player reports their tx hash) ──
  if (action === "confirm-deposit") {
    const { battleId, playerPk, txHash } = body;
    if (!battleId || !playerPk || !txHash) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Store deposit confirmation in battle state
    const battle = getBattle(battleId);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    // Track deposits in a global map
    const g = globalThis as unknown as { __deposits?: Map<string, Set<string>> };
    if (!g.__deposits) g.__deposits = new Map();
    if (!g.__deposits.has(battleId)) g.__deposits.set(battleId, new Set());
    g.__deposits.get(battleId)!.add(playerPk.toLowerCase());

    const deposits = g.__deposits.get(battleId)!;
    const bothDeposited = deposits.has(battle.attacker.publicKey.toLowerCase())
      && deposits.has(battle.defender.publicKey.toLowerCase());

    return NextResponse.json({
      confirmed: true,
      txHash,
      bothDeposited,
    });
  }

  // ── Check if both players deposited ──
  if (action === "check-deposits") {
    const { battleId } = body;
    if (!battleId) {
      return NextResponse.json({ error: "Missing battleId" }, { status: 400 });
    }

    const battle = getBattle(battleId);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    const g = globalThis as unknown as { __deposits?: Map<string, Set<string>> };
    const deposits = g.__deposits?.get(battleId);

    const attackerDeposited = deposits?.has(battle.attacker.publicKey.toLowerCase()) ?? false;
    const defenderDeposited = deposits?.has(battle.defender.publicKey.toLowerCase()) ?? false;

    return NextResponse.json({
      attackerDeposited,
      defenderDeposited,
      bothDeposited: attackerDeposited && defenderDeposited,
    });
  }

  // ── Send payout to winner (called after battle resolves) ──
  if (action === "payout") {
    const { battleId } = body;
    if (!battleId) {
      return NextResponse.json({ error: "Missing battleId" }, { status: 400 });
    }

    const battle = getBattle(battleId);
    if (!battle || battle.status !== "resolved" || !battle.winner || battle.mode !== "wager") {
      return NextResponse.json({ error: "Battle not eligible for payout" }, { status: 400 });
    }

    if (battle.payoutTx) {
      return NextResponse.json({ alreadyPaid: true, txHash: battle.payoutTx });
    }

    const winner = battle.winner === "attacker" ? battle.attacker : battle.defender;
    if (!winner.walletAddress) {
      return NextResponse.json({ error: "Winner has no wallet" }, { status: 400 });
    }

    // Total pot = 2x wager
    const wager = parseFloat(battle.wagerAmount ?? "0");
    const totalPot = (wager * 2).toString();

    try {
      const { txHash } = await sendPayout(winner.walletAddress, totalPot);
      battle.payoutTx = txHash;
      return NextResponse.json({ success: true, txHash, amount: totalPot });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payout failed";
      console.error("[Escrow] Payout failed:", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Get escrow balance ──
  if (action === "balance") {
    const balance = await getEscrowBalance();
    return NextResponse.json({ balance, network: "sepolia" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

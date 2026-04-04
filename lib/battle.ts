import crypto from "crypto";
import { getProfile, updateProfile } from "./store";

// ── Types ──

export type BattleStatus = "pending" | "accepted" | "declined" | "resolved" | "expired";

export interface BattleFighter {
  publicKey: string;
  username: string;
  level: number;
  skinIndex: number;
  rank: string;
}

export interface Battle {
  id: string;
  attacker: BattleFighter;
  defender: BattleFighter;
  status: BattleStatus;
  createdAt: number;
  winner?: "attacker" | "defender";
  attackerXpDelta?: number;
  defenderXpDelta?: number;
  attackerNewLevel?: number;
  defenderNewLevel?: number;
  attackerNewRank?: string;
  defenderNewRank?: string;
}

// ── In-memory battle state (use globalThis to survive HMR) ──

const g = globalThis as unknown as {
  __battles?: Map<string, Battle>;
  __pendingByDefender?: Map<string, string>;
};
if (!g.__battles) g.__battles = new Map();
if (!g.__pendingByDefender) g.__pendingByDefender = new Map();

const battles = g.__battles;
const pendingByDefender = g.__pendingByDefender;

// ── XP / Level / Rank math ──

// Level N requires xpForLevel(N) total XP
// 1→0, 2→100, 3→300, 4→600, 5→1000 ...
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return level * (level - 1) * 50;
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function rankFromLevel(level: number): string {
  if (level >= 20) return "diamond";
  if (level >= 15) return "platinum";
  if (level >= 10) return "gold";
  if (level >= 5) return "silver";
  return "bronze";
}

// ── Battle logic ──

export function createBattle(attackerPk: string, defenderPk: string): Battle | { error: string } {
  const attacker = getProfile(attackerPk);
  const defender = getProfile(defenderPk);

  if (!attacker || !attacker.username) return { error: "Attacker not found" };
  if (!defender || !defender.username) return { error: "Opponent not found" };
  if (attackerPk.toLowerCase() === defenderPk.toLowerCase()) return { error: "Cannot battle yourself" };

  // Check if defender already has a pending battle
  const existing = pendingByDefender.get(defenderPk.toLowerCase());
  if (existing) {
    const b = battles.get(existing);
    if (b && b.status === "pending" && Date.now() - b.createdAt < 60_000) {
      return { error: "Opponent already has a pending battle" };
    }
    // Clean up stale
    pendingByDefender.delete(defenderPk.toLowerCase());
  }

  const id = crypto.randomBytes(8).toString("hex");

  const battle: Battle = {
    id,
    attacker: {
      publicKey: attacker.publicKey,
      username: attacker.username,
      level: levelFromXp(attacker.xp),
      skinIndex: attacker.skinIndex,
      rank: rankFromLevel(levelFromXp(attacker.xp)),
    },
    defender: {
      publicKey: defender.publicKey,
      username: defender.username,
      level: levelFromXp(defender.xp),
      skinIndex: defender.skinIndex,
      rank: rankFromLevel(levelFromXp(defender.xp)),
    },
    status: "pending",
    createdAt: Date.now(),
  };

  battles.set(id, battle);
  pendingByDefender.set(defenderPk.toLowerCase(), id);

  return battle;
}

export function getPendingBattle(playerPk: string): Battle | null {
  const id = pendingByDefender.get(playerPk.toLowerCase());
  if (!id) return null;
  const b = battles.get(id);
  if (!b || b.status !== "pending") {
    pendingByDefender.delete(playerPk.toLowerCase());
    return null;
  }
  // Expire after 60s
  if (Date.now() - b.createdAt > 60_000) {
    b.status = "expired";
    pendingByDefender.delete(playerPk.toLowerCase());
    return null;
  }
  return b;
}

export function getBattle(battleId: string): Battle | null {
  return battles.get(battleId) ?? null;
}

export function respondBattle(battleId: string, accept: boolean): Battle | null {
  const b = battles.get(battleId);
  if (!b || b.status !== "pending") return null;

  b.status = accept ? "accepted" : "declined";
  pendingByDefender.delete(b.defender.publicKey.toLowerCase());

  return b;
}

export function resolveBattle(battleId: string): Battle | null {
  const b = battles.get(battleId);
  if (!b || b.status !== "accepted") return null;

  const aLevel = b.attacker.level;
  const dLevel = b.defender.level;
  const levelDiff = aLevel - dLevel;

  // Win probability: 50% base, ±5% per level diff, clamped [15%, 85%]
  const winChance = Math.min(0.85, Math.max(0.15, 0.5 + levelDiff * 0.05));
  const attackerWins = Math.random() < winChance;

  b.winner = attackerWins ? "attacker" : "defender";

  // XP calculation
  const baseXp = 50;
  const gap = Math.abs(levelDiff);

  let winnerGain: number;
  let loserLoss: number;

  if (attackerWins) {
    // Attacker won — bonus if defender was higher level
    winnerGain = Math.max(10, baseXp + (dLevel > aLevel ? gap * 20 : -gap * 10));
    loserLoss = Math.floor(winnerGain * 0.5);
    b.attackerXpDelta = winnerGain;
    b.defenderXpDelta = -loserLoss;
  } else {
    // Defender won — bonus if attacker was higher level
    winnerGain = Math.max(10, baseXp + (aLevel > dLevel ? gap * 20 : -gap * 10));
    loserLoss = Math.floor(winnerGain * 0.5);
    b.defenderXpDelta = winnerGain;
    b.attackerXpDelta = -loserLoss;
  }

  // Apply XP to profiles
  const aProfile = getProfile(b.attacker.publicKey);
  const dProfile = getProfile(b.defender.publicKey);

  if (aProfile) {
    aProfile.xp = Math.max(0, aProfile.xp + b.attackerXpDelta);
    aProfile.level = levelFromXp(aProfile.xp);
    aProfile.rank = rankFromLevel(aProfile.level);
    updateProfile(aProfile.publicKey, { xp: aProfile.xp, level: aProfile.level, rank: aProfile.rank });
    b.attackerNewLevel = aProfile.level;
    b.attackerNewRank = aProfile.rank;
  }

  if (dProfile) {
    dProfile.xp = Math.max(0, dProfile.xp + b.defenderXpDelta);
    dProfile.level = levelFromXp(dProfile.xp);
    dProfile.rank = rankFromLevel(dProfile.level);
    updateProfile(dProfile.publicKey, { xp: dProfile.xp, level: dProfile.level, rank: dProfile.rank });
    b.defenderNewLevel = dProfile.level;
    b.defenderNewRank = dProfile.rank;
  }

  b.status = "resolved";
  return b;
}

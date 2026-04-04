import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createSubnameWithProfile, updateTextRecords, readProfile as ensReadProfile, toProfileRecords } from "./ens";

// ── Player profile (ENS-ready: each field maps to a text record) ──

export interface PlayerProfile {
  // Identity
  publicKey: string;
  etherAddress: string;
  username: string;
  worldId: "verified" | "";

  // Game
  xp: number;
  level: number;
  rank: string; // bronze, silver, gold, platinum, diamond
  skinIndex: number; // 1–6

  // Wallet (for betting via Dynamic)
  walletAddress: string;

  // Meta
  linkedAt: string; // ISO date
}

// ── JSON file persistence ──
// Use /tmp on Vercel (serverless, writable), data/ locally

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const PLAYERS_FILE = path.join(DATA_DIR, "players.json");

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch { /* read-only fs, ignore */ }
}

function loadPlayers(): Record<string, PlayerProfile> {
  ensureDataDir();
  try {
    if (!fs.existsSync(PLAYERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function savePlayers(players: Record<string, PlayerProfile>) {
  ensureDataDir();
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), "utf-8");
  } catch { /* read-only fs, ignore — ENS is the real storage */ }
}

// ── ENS sync (fire-and-forget, logs errors) ──

function syncToEns(profile: PlayerProfile) {
  if (!profile.username) return;
  const records = toProfileRecords(profile);
  createSubnameWithProfile(profile.username, records).catch((err) => {
    console.error(`[ENS] Failed to sync full profile for ${profile.username}:`, err.message ?? err);
  });
}

function syncFieldsToEns(username: string, updates: Partial<Record<string, string>>) {
  if (!username) return;
  updateTextRecords(username, updates).catch((err) => {
    console.error(`[ENS] Failed to sync fields for ${username}:`, err.message ?? err);
  });
}

// ── Binding interface (kept for API compat) ──

export interface Binding {
  playerId: string;
  publicKey: string;
  etherAddress: string;
  username?: string;
  linkedAt: Date;
}

function profileToBinding(p: PlayerProfile): Binding {
  return {
    playerId: p.publicKey.toLowerCase(),
    publicKey: p.publicKey,
    etherAddress: p.etherAddress,
    username: p.username || undefined,
    linkedAt: new Date(p.linkedAt),
  };
}

// ── Challenges (single-use, TTL 5 min — stays in memory, ephemeral by nature) ──

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challenges = new Map<string, number>();

export function generateChallenge(): string {
  const challenge = crypto.randomBytes(32).toString("hex");
  challenges.set(challenge, Date.now() + CHALLENGE_TTL_MS);
  return challenge;
}

export function consumeChallenge(challenge: string): boolean {
  const expiry = challenges.get(challenge);
  if (!expiry || Date.now() > expiry) {
    challenges.delete(challenge);
    return false;
  }
  challenges.delete(challenge);
  return true;
}

// ── Player CRUD ──

export function getBindingByPublicKey(publicKey: string): Binding | undefined {
  const players = loadPlayers();
  const p = players[publicKey.toLowerCase()];
  return p ? profileToBinding(p) : undefined;
}

export function getBindingByUsername(username: string): Binding | undefined {
  const players = loadPlayers();
  const key = username.toLowerCase();
  const p = Object.values(players).find((pl) => pl.username.toLowerCase() === key);
  return p ? profileToBinding(p) : undefined;
}

export function getBindingByPlayer(playerId: string): Binding | undefined {
  return getBindingByPublicKey(playerId);
}

export function saveBinding(binding: Binding): void {
  const players = loadPlayers();
  const key = binding.publicKey.toLowerCase();
  const existing = players[key];

  const isNew = !existing;
  players[key] = {
    publicKey: binding.publicKey.toLowerCase(),
    etherAddress: binding.etherAddress.toLowerCase(),
    username: binding.username ?? existing?.username ?? "",
    worldId: existing?.worldId ?? "",
    xp: existing?.xp ?? 0,
    level: existing?.level ?? 1,
    rank: existing?.rank ?? "bronze",
    skinIndex: existing?.skinIndex ?? 1,
    walletAddress: existing?.walletAddress ?? "",
    linkedAt: existing?.linkedAt ?? new Date().toISOString(),
  };

  savePlayers(players);

  // Sync to ENS on new registration with username
  if (isNew && players[key].username) {
    syncToEns(players[key]);
  }
}

export function setUsername(publicKey: string, username: string): Binding | null {
  const players = loadPlayers();
  const key = publicKey.toLowerCase();
  const p = players[key];
  if (!p) return null;

  p.username = username;
  savePlayers(players);

  // Create ENS subname with full profile now that we have a username
  syncToEns(p);

  return profileToBinding(p);
}

// ── Profile reads ──

// Sync read from JSON (used internally for fast writes like battle resolution)
export function getProfile(publicKey: string): PlayerProfile | null {
  const players = loadPlayers();
  return players[publicKey.toLowerCase()] ?? null;
}

// Async read from ENS (primary data source), falls back to JSON
export async function getProfileFromEns(publicKey: string): Promise<PlayerProfile | null> {
  const players = loadPlayers();
  const local = players[publicKey.toLowerCase()];
  if (!local?.username) return local ?? null;

  try {
    const records = await ensReadProfile(local.username);
    if (!records || !records.publicKey) return local;

    // Build profile from ENS data
    return {
      publicKey: records.publicKey,
      etherAddress: records.etherAddress,
      username: local.username,
      worldId: (records.worldId === "verified" ? "verified" : "") as "verified" | "",
      xp: parseInt(records.xp) || 0,
      level: parseInt(records.level) || 1,
      rank: records.rank || "bronze",
      skinIndex: parseInt(records.skinIndex) || 1,
      walletAddress: local.walletAddress || "",
      linkedAt: records.linkedAt || local.linkedAt,
    };
  } catch (err) {
    console.error(`[ENS] Failed to read profile for ${local.username}, falling back to JSON:`, err);
    return local;
  }
}

export function updateProfile(publicKey: string, updates: Partial<Pick<PlayerProfile, "worldId" | "xp" | "level" | "rank" | "skinIndex" | "walletAddress">>): PlayerProfile | null {
  const players = loadPlayers();
  const key = publicKey.toLowerCase();
  const p = players[key];
  if (!p) return null;

  if (updates.worldId !== undefined) p.worldId = updates.worldId;
  if (updates.xp !== undefined) p.xp = updates.xp;
  if (updates.level !== undefined) p.level = updates.level;
  if (updates.rank !== undefined) p.rank = updates.rank;
  if (updates.skinIndex !== undefined) p.skinIndex = updates.skinIndex;
  if (updates.walletAddress !== undefined) p.walletAddress = updates.walletAddress;

  savePlayers(players);

  // Sync changed fields to ENS
  const ensUpdates: Partial<Record<string, string>> = {};
  if (updates.worldId !== undefined) ensUpdates.worldId = p.worldId;
  if (updates.xp !== undefined) ensUpdates.xp = String(p.xp);
  if (updates.level !== undefined) ensUpdates.level = String(p.level);
  if (updates.rank !== undefined) ensUpdates.rank = p.rank;
  if (updates.skinIndex !== undefined) ensUpdates.skinIndex = String(p.skinIndex);
  syncFieldsToEns(p.username, ensUpdates);

  return p;
}

// ── Binding codes (for iOS code-entry flow — stays in memory, ephemeral) ──

const CODE_TTL_MS = 5 * 60 * 1000;
const bindingCodes = new Map<string, { publicKey: string; etherAddress: string; expiry: number }>();

export function generateBindingCode(publicKey: string, etherAddress: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  bindingCodes.set(code, { publicKey, etherAddress, expiry: Date.now() + CODE_TTL_MS });
  return code;
}

export function consumeBindingCode(code: string): { publicKey: string; etherAddress: string } | null {
  const entry = bindingCodes.get(code.toUpperCase());
  if (!entry || Date.now() > entry.expiry) {
    bindingCodes.delete(code.toUpperCase());
    return null;
  }
  bindingCodes.delete(code.toUpperCase());
  return { publicKey: entry.publicKey, etherAddress: entry.etherAddress };
}

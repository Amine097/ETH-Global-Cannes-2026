import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createSubnameWithProfile, updateTextRecords, readProfile as ensReadProfile, readPlayerIndex, writePlayerIndex, toProfileRecords } from "./ens";

// ── Player profile (ENS-ready: each field maps to a text record) ──

export interface PlayerProfile {
  // Identity (stored on ENS as text records)
  publicKey: string;
  etherAddress: string;
  username: string;

  // Game (stored encrypted on ENS)
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

// ENS write queue — ensures transactions are sequential (no nonce conflicts)
const ensQueue: (() => Promise<void>)[] = [];
let ensProcessing = false;

async function processEnsQueue() {
  if (ensProcessing) return;
  ensProcessing = true;
  while (ensQueue.length > 0) {
    const task = ensQueue.shift()!;
    try { await task(); } catch (err) {
      console.error(`[ENS] Queue task failed:`, err instanceof Error ? err.message : err);
    }
  }
  ensProcessing = false;
}

function enqueueEns(task: () => Promise<void>) {
  ensQueue.push(task);
  processEnsQueue();
}

function syncToEns(profile: PlayerProfile) {
  if (!profile.username) return;
  const records = toProfileRecords(profile);
  // Queue: first create subname + profile, then update the index
  enqueueEns(async () => {
    await createSubnameWithProfile(profile.username, records);
  });
  enqueueEns(async () => {
    const players = loadPlayers();
    const index: Record<string, string> = {};
    for (const [pk, p] of Object.entries(players)) {
      if (p.username) index[pk] = p.username;
    }
    await writePlayerIndex(index);
  });
}

function syncFieldsToEns(username: string, updates: Partial<Record<string, string>>) {
  if (!username) return;
  enqueueEns(async () => {
    await updateTextRecords(username, updates);
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
    username: (binding.username ?? existing?.username ?? "").toLowerCase(),

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

// ── All profiles (for ranking) ──

export function getAllProfiles(): PlayerProfile[] {
  return Object.values(loadPlayers());
}

// ── Profile reads ──

// Sync read from JSON (used internally for fast writes like battle resolution)
export function getProfile(publicKey: string): PlayerProfile | null {
  const players = loadPlayers();
  return players[publicKey.toLowerCase()] ?? null;
}

// Resolve publicKey → username via JSON first, then ENS player index
async function resolveUsername(publicKey: string): Promise<string | null> {
  const pk = publicKey.toLowerCase();
  // Try local JSON
  const players = loadPlayers();
  if (players[pk]?.username) {
    console.log(`[resolveUsername] Found ${players[pk].username} in JSON for ${pk.slice(0,10)}...`);
    return players[pk].username;
  }
  // Try ENS player index
  try {
    console.log(`[resolveUsername] JSON miss for ${pk.slice(0,10)}..., reading ENS player index...`);
    const index = await readPlayerIndex();
    if (index && index[pk]) {
      console.log(`[resolveUsername] Found ${index[pk]} in ENS index`);
      return index[pk];
    }
    console.log(`[resolveUsername] Not found in ENS index either. Index keys:`, index ? Object.keys(index).map(k => k.slice(0,10)) : "null");
  } catch (err) {
    console.error(`[resolveUsername] ENS index read failed:`, err);
  }
  return null;
}

// Async read from ENS (primary data source), falls back to JSON
export async function getProfileFromEns(publicKey: string): Promise<PlayerProfile | null> {
  const pk = publicKey.toLowerCase();
  const local = loadPlayers()[pk] ?? null;

  // Resolve username — from JSON or ENS index
  const username = local?.username || (await resolveUsername(pk));
  if (!username) return local;

  try {
    const records = await ensReadProfile(username);
    if (!records || !records.publicKey) return local;

    return {
      publicKey: records.publicKey,
      etherAddress: records.etherAddress,
      username,

      xp: parseInt(records.xp) || 0,
      level: parseInt(records.level) || 1,
      rank: records.rank || "bronze",
      skinIndex: parseInt(records.skinIndex) || 1,
      walletAddress: local?.walletAddress || "",
      linkedAt: records.linkedAt || local?.linkedAt || "",
    };
  } catch (err) {
    console.error(`[ENS] Failed to read profile for ${username}, falling back to JSON:`, err);
    return local;
  }
}

// Async check if a publicKey is registered (JSON or ENS index)
export async function isRegistered(publicKey: string): Promise<{ registered: boolean; username?: string }> {
  const pk = publicKey.toLowerCase();
  const local = loadPlayers()[pk];
  if (local?.username) return { registered: true, username: local.username };
  // Check ENS index
  try {
    const index = await readPlayerIndex();
    if (index && index[pk]) return { registered: true, username: index[pk] };
  } catch { /* ignore */ }
  return { registered: false };
}

export function updateProfile(publicKey: string, updates: Partial<Pick<PlayerProfile, "xp" | "level" | "rank" | "skinIndex" | "walletAddress">>): PlayerProfile | null {
  const players = loadPlayers();
  const key = publicKey.toLowerCase();
  const p = players[key];
  if (!p) return null;


  if (updates.xp !== undefined) p.xp = updates.xp;
  if (updates.level !== undefined) p.level = updates.level;
  if (updates.rank !== undefined) p.rank = updates.rank;
  if (updates.skinIndex !== undefined) p.skinIndex = updates.skinIndex;
  if (updates.walletAddress !== undefined) p.walletAddress = updates.walletAddress;

  savePlayers(players);

  // Sync changed fields to ENS
  const ensUpdates: Partial<Record<string, string>> = {};

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

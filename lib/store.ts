import crypto from "crypto";

export interface Binding {
  playerId: string;
  publicKey: string;
  etherAddress: string;
  linkedAt: Date;
}

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

const bindingsByPublicKey = new Map<string, Binding>();
const bindingsByPlayerId = new Map<string, Binding>();

export function getBindingByPublicKey(publicKey: string): Binding | undefined {
  return bindingsByPublicKey.get(publicKey.toLowerCase());
}

export function getBindingByPlayer(playerId: string): Binding | undefined {
  return bindingsByPlayerId.get(playerId);
}

export function saveBinding(binding: Binding): void {
  bindingsByPublicKey.set(binding.publicKey.toLowerCase(), binding);
  bindingsByPlayerId.set(binding.playerId, binding);
}

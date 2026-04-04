import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  parseAbi,
  labelhash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "crypto";

// ── Config ──

const RPC_URL = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.ENS_OWNER_PRIVATE_KEY!;
const PARENT_NAME = process.env.ENS_PARENT_NAME ?? "raidbattle.eth";

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;
const RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as const;

const registryAbi = parseAbi([
  "function setSubnodeOwner(bytes32 node, bytes32 label, address owner) returns (bytes32)",
  "function setResolver(bytes32 node, address resolver)",
  "function owner(bytes32 node) view returns (address)",
  "function resolver(bytes32 node) view returns (address)",
]);

const resolverAbi = parseAbi([
  "function setText(bytes32 node, string key, string value)",
  "function text(bytes32 node, string key) view returns (string)",
]);

// ── Clients (lazy singleton via globalThis for HMR) ──

function getClients(): { pub: PublicClient; wallet: WalletClient } {
  const g = globalThis as unknown as { __ensClients?: { pub: PublicClient; wallet: WalletClient } };
  if (!g.__ensClients) {
    const transport = http(RPC_URL);
    const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace(/^0x/, "")}`);
    g.__ensClients = {
      pub: createPublicClient({ chain: sepolia, transport }),
      wallet: createWalletClient({ chain: sepolia, transport, account }),
    };
  }
  return g.__ensClients;
}

// ── Encryption (AES-256-GCM, key derived from ENS_OWNER_PRIVATE_KEY) ──

// Fields stored encrypted on ENS — only the server can read them
const ENCRYPTED_FIELDS = new Set(["xp", "level", "rank", "skinIndex"]);

function getEncryptionKey(): Buffer {
  // Derive a 32-byte key from the private key via SHA-256
  return crypto.createHash("sha256").update(PRIVATE_KEY).digest();
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

// ── Profile text record keys ──

const PROFILE_KEYS = [
  "publicKey",
  "etherAddress",
  "worldId",
  "xp",
  "level",
  "rank",
  "skinIndex",
  "linkedAt",
] as const;

export type ProfileRecords = Record<(typeof PROFILE_KEYS)[number], string>;

// ── Read ──

export async function readProfile(username: string): Promise<ProfileRecords | null> {
  const { pub } = getClients();
  const node = namehash(`${username.toLowerCase()}.${PARENT_NAME}`);

  // Check if subname exists (has a resolver set)
  const resolverAddr = await pub.readContract({
    address: ENS_REGISTRY,
    abi: registryAbi,
    functionName: "resolver",
    args: [node],
  });

  if (resolverAddr === "0x0000000000000000000000000000000000000000") return null;

  const records: Partial<ProfileRecords> = {};
  for (const key of PROFILE_KEYS) {
    let val = await pub.readContract({
      address: RESOLVER,
      abi: resolverAbi,
      functionName: "text",
      args: [node, key],
    });
    // Decrypt encrypted fields
    if (ENCRYPTED_FIELDS.has(key) && val) {
      try { val = decrypt(val); } catch { /* leave as-is if decryption fails (legacy data) */ }
    }
    records[key] = val;
  }

  return records as ProfileRecords;
}

// ── Check if subname exists ──

export async function subnameExists(username: string): Promise<boolean> {
  const { pub } = getClients();
  const node = namehash(`${username.toLowerCase()}.${PARENT_NAME}`);
  const owner = await pub.readContract({
    address: ENS_REGISTRY,
    abi: registryAbi,
    functionName: "owner",
    args: [node],
  });
  return owner !== "0x0000000000000000000000000000000000000000";
}

// ── Create subname + set all text records ──

export async function createSubnameWithProfile(
  username: string,
  profile: ProfileRecords
): Promise<void> {
  const { wallet, pub } = getClients();
  const account = wallet.account!;
  const parentNode = namehash(PARENT_NAME);
  const label = labelhash(username.toLowerCase());
  const subNode = namehash(`${username.toLowerCase()}.${PARENT_NAME}`);

  // 1. Create subnode — sets owner to our wallet
  const hash1 = await wallet.writeContract({
    address: ENS_REGISTRY,
    abi: registryAbi,
    functionName: "setSubnodeOwner",
    args: [parentNode, label, account.address],
    chain: sepolia,
    account,
  });
  await pub.waitForTransactionReceipt({ hash: hash1 });

  // 2. Set resolver on subnode
  const hash2 = await wallet.writeContract({
    address: ENS_REGISTRY,
    abi: registryAbi,
    functionName: "setResolver",
    args: [subNode, RESOLVER],
    chain: sepolia,
    account,
  });
  await pub.waitForTransactionReceipt({ hash: hash2 });

  // 3. Set all text records (encrypt sensitive fields)
  for (const key of PROFILE_KEYS) {
    let val = profile[key];
    if (val === undefined || val === "") continue;
    if (ENCRYPTED_FIELDS.has(key)) val = encrypt(val);
    const hash = await wallet.writeContract({
      address: RESOLVER,
      abi: resolverAbi,
      functionName: "setText",
      args: [subNode, key, val],
      chain: sepolia,
      account,
    });
    await pub.waitForTransactionReceipt({ hash: hash });
  }
}

// ── Update specific text records ──

export async function updateTextRecords(
  username: string,
  updates: Partial<ProfileRecords>
): Promise<void> {
  const { wallet, pub } = getClients();
  const account = wallet.account!;
  const subNode = namehash(`${username.toLowerCase()}.${PARENT_NAME}`);

  for (const [key, rawVal] of Object.entries(updates)) {
    if (rawVal === undefined) continue;
    const val = ENCRYPTED_FIELDS.has(key) ? encrypt(rawVal) : rawVal;
    const hash = await wallet.writeContract({
      address: RESOLVER,
      abi: resolverAbi,
      functionName: "setText",
      args: [subNode, key, val],
      chain: sepolia,
      account,
    });
    await pub.waitForTransactionReceipt({ hash: hash });
  }
}

// ── Global ranking stored as encrypted text record on the parent name ──

const RANKING_KEY = "ranking";

export async function writeRankingToEns(
  positions: Record<string, number>,
  total: number
): Promise<void> {
  const { wallet, pub } = getClients();
  const account = wallet.account!;
  const parentNode = namehash(PARENT_NAME);

  const payload = JSON.stringify({ _total: total, ...positions });
  const encrypted = encrypt(payload);

  const hash = await wallet.writeContract({
    address: RESOLVER,
    abi: resolverAbi,
    functionName: "setText",
    args: [parentNode, RANKING_KEY, encrypted],
    chain: sepolia,
    account,
  });
  await pub.waitForTransactionReceipt({ hash });
}

export async function readRankingFromEns(): Promise<{
  positions: Record<string, number>;
  total: number;
} | null> {
  const { pub } = getClients();
  const parentNode = namehash(PARENT_NAME);

  try {
    const val = await pub.readContract({
      address: RESOLVER,
      abi: resolverAbi,
      functionName: "text",
      args: [parentNode, RANKING_KEY],
    });
    if (!val) return null;

    const data = JSON.parse(decrypt(val)) as Record<string, number>;
    const total = data._total ?? 0;
    const { _total, ...positions } = data;
    return { positions, total };
  } catch {
    return null;
  }
}

// ── Helper: build ProfileRecords from store data ──

export function toProfileRecords(data: {
  publicKey: string;
  etherAddress: string;
  worldId: string;
  xp: number;
  level: number;
  rank: string;
  skinIndex: number;
  linkedAt: string;
}): ProfileRecords {
  return {
    publicKey: data.publicKey,
    etherAddress: data.etherAddress,
    worldId: data.worldId,
    xp: String(data.xp),
    level: String(data.level),
    rank: data.rank,
    skinIndex: String(data.skinIndex),
    linkedAt: data.linkedAt,
  };
}

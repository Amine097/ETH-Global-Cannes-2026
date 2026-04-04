# Raid Battle — ETH Global Cannes 2026

NFC bracelet-based battle game with on-chain identity (ENS) and World ID proof-of-humanity.

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind)
- **World ID** (IDKit v4) — proof-of-humanity verification
- **ENS on Sepolia** — player profiles stored as text records on `username.raidbattle.eth`
- **HaLo NFC** (libhalo) — physical bracelet identity via ECDSA signatures
- **viem / ethers** — blockchain interaction

## How it works

1. **Verify** — Prove you're human with World ID (mandatory)
2. **Scan** — Tap your HaLo NFC bracelet to create/login to your account
3. **Choose a name** — Get `username.raidbattle.eth` subname on ENS
4. **Battle** — Scan an opponent's bracelet to challenge them. Accept/decline, 5s countdown, probability-based winner
5. **Progress** — Earn XP, level up, climb ranks (Bronze → Silver → Gold → Platinum → Diamond)

## Architecture

```
Browser (mobile)
  ├── World ID verification (IDKit widget)
  ├── HaLo NFC scan (libhalo)
  └── Battle UI (polling-based real-time)

Server (Next.js API routes)
  ├── /api/verify         — World ID proof verification
  ├── /api/rp-context     — Signed request context for IDKit
  ├── /api/halo/challenge — NFC challenge generation
  ├── /api/players/*      — Registration, lookup, profile
  └── /api/battle         — Battle initiation, polling, resolution

Storage
  ├── data/players.json   — Local cache (fast reads)
  └── ENS Sepolia         — On-chain profiles (text records)
      ├── publicKey, etherAddress, worldId, linkedAt  (public)
      └── xp, level, rank, skinIndex                  (AES-256-GCM encrypted)
```

## Quick start

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

## Env vars

```env
# World ID
NEXT_PUBLIC_APP_ID=          # World Developer Portal app ID
WLD_RP_ID=                   # Relying Party ID
WLD_SIGNING_KEY=             # Signing key for rp_context

# ENS (Sepolia)
ENS_PARENT_NAME=             # e.g. raidbattle.eth
ENS_OWNER_PRIVATE_KEY=       # Private key of ENS name owner
SEPOLIA_RPC_URL=             # Sepolia RPC endpoint

# Auth
NEXTAUTH_URL=                # Public URL (ngrok in dev)
NEXTAUTH_SECRET=             # openssl rand -base64 32
```

## ENS data model

Each player gets a subname `username.raidbattle.eth` with text records:

| Key | Encrypted | Description |
|-----|-----------|-------------|
| `publicKey` | No | HaLo bracelet public key |
| `etherAddress` | No | Bracelet Ethereum address |
| `worldId` | No | `"verified"` if World ID passed |
| `linkedAt` | No | Registration timestamp |
| `xp` | Yes (AES-256-GCM) | Experience points |
| `level` | Yes | Player level |
| `rank` | Yes | Bronze/Silver/Gold/Platinum/Diamond |
| `skinIndex` | Yes | Character skin (1-6) |

## Scripts

```bash
npx tsx scripts/resync-ens.ts   # Re-sync all players to ENS
```

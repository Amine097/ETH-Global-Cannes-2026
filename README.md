# Raid Battle — ETH Global Cannes 2026

NFC bracelet-based battle game with on-chain identity (ENS), crypto wagers (Dynamic), and minigame combat.

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind)
- **ENS on Sepolia** — player profiles stored as encrypted text records on `username.raidbattle.eth`
- **Dynamic** — wallet connection (JS SDK) + escrow for wager battles
- **HaLo NFC** (libhalo) — physical bracelet identity via ECDSA signatures
- **World ID** (IDKit v4) — proof-of-humanity verification (optional gate)
- **viem / ethers** — blockchain interaction

## How it works

1. **Scan** — Tap your HaLo NFC bracelet to create or log into your account
2. **Choose a name** — Get `username.raidbattle.eth` subname on ENS
3. **Connect wallet** — Link a Sepolia wallet via Dynamic for wager battles
4. **Challenge** — Tap an opponent's bracelet or scan their QR to send a battle invite
5. **Choose mode** — Free battle (XP only) or wager battle (stake Sepolia ETH, 5% platform fee)
6. **Fight** — Random minigame: Tap Frenzy, Lightning Reflexes, or Battle Rhythm
7. **Progress** — Earn XP, level up, climb ranks: Squire → Knight → Lord → Duke → Legend
8. **Get paid** — Wager winner receives 95% of the pot via on-chain escrow payout

## Architecture

```
Browser (mobile)
  ├── HaLo NFC scan (libhalo) — bracelet identity
  ├── Dynamic JS SDK — wallet connection + tx signing (lazy-loaded)
  ├── World ID (IDKit v4) — proof of humanity
  └── Battle UI — minigames, real-time polling, arena video

Server (Next.js API routes)
  ├── /api/halo/challenge   — NFC challenge generation
  ├── /api/players/*        — Registration, lookup, profile, wallet, ranking
  ├── /api/battle           — Initiate, respond, minigame submit, resolve
  ├── /api/escrow           — Deposit tracking, balance check, payout
  ├── /api/verify           — World ID proof verification
  └── /api/rp-context       — Signed request context for IDKit

Storage
  ├── JSON (/tmp on Vercel)  — Local cache for fast reads
  └── ENS Sepolia            — On-chain profiles (text records)
      ├── publicKey, etherAddress, worldId, linkedAt  (public)
      ├── xp, level, rank, skinIndex                  (AES-256-GCM encrypted)
      └── ranking (encrypted, on parent name)

Escrow
  └── Server wallet (ENS owner key) holds wager deposits on Sepolia
      ├── Both players deposit before fight starts
      ├── Winner gets 95% payout after resolution
      └── 5% platform fee retained in escrow wallet
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

# Dynamic (wallet connection for wagers)
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=  # From Dynamic dashboard

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
| `rank` | Yes | Squire/Knight/Lord/Duke/Legend |
| `skinIndex` | Yes | Character skin (1-6) |

## Battle system

- **Minigames**: Tap Frenzy (tap spam), Lightning Reflexes (reaction time), Battle Rhythm (score-based)
- **Win probability**: 50% base ± level bonus ± minigame performance, clamped [10%, 90%]
- **XP**: Winners gain 50+ XP (bonus for beating higher level), losers lose proportionally
- **Ranks**: Squire (1-4) → Knight (5-9) → Lord (10-14) → Duke (15-19) → Legend (20+)

## Scripts

```bash
npx tsx scripts/resync-ens.ts   # Re-sync all players to ENS
```

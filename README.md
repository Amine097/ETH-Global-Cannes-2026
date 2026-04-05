# Raid Battle — ETH Global Cannes 2026

NFC bracelet-based battle game with on-chain identity (ENS) and crypto wagers (Dynamic).

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind)
- **ENS on Sepolia** — player profiles as encrypted text records on `username.raidbattle.eth`
- **Dynamic** — wallet connection (JS SDK) + escrow for wager battles
- **HaLo NFC** (libhalo) — physical bracelet identity via ECDSA signatures
- **viem / ethers** — blockchain interaction

## How it works

1. **Scan** — Tap your HaLo NFC bracelet to create or log into your account
2. **Choose a name** — Get `username.raidbattle.eth` subname on ENS
3. **Connect wallet** — Link a Sepolia wallet via Dynamic for wager battles
4. **Challenge** — Tap an opponent's bracelet or scan their QR to challenge
5. **Choose mode** — Free battle (XP only) or wager battle (stake ETH, 5% fee)
6. **Fight** — Random minigame: Tap Frenzy, Lightning Reflexes, or Battle Rhythm
7. **Progress** — Earn XP, level up, climb ranks: Squire → Knight → Lord → Duke → Legend
8. **Get paid** — Wager winner receives 95% of the pot via on-chain escrow

## Where we use ENS and Dynamic

### ENS (Ethereum Name Service) — on-chain identity & storage

| Where | File | What |
|-------|------|------|
| Player profiles | `lib/ens.ts` → `createSubnameWithProfile()` | Creates `username.raidbattle.eth` with text records |
| Encrypted game data | `lib/ens.ts` → `encrypt()` / `decrypt()` | XP, level, rank, skinIndex stored as AES-256-GCM |
| Player index | `lib/ens.ts` → `writePlayerIndex()` | Global pk→username mapping on parent name |
| Ranking | `lib/ens.ts` → `writeRankingToEns()` | Encrypted leaderboard on parent name |
| Profile reads | `lib/store.ts` → `getProfileFromEns()` | Primary data source, JSON is just cache |
| Registration check | `app/api/players/register` | Checks ENS index + subname before allowing signup |
| Login | `app/api/players/check` | Resolves player from ENS when cache is empty |
| Profile display | `components/PlayerProfile.tsx` | Shows `username.raidbattle.eth` |

### Dynamic — wallet connection & wager escrow

| Where | File | What |
|-------|------|------|
| Wallet provider | `components/DynamicProvider.tsx` | `DynamicContextProvider` with Ethereum connectors |
| Lazy loading | `components/WithDynamic.tsx` | Only loads SDK on wallet/battle pages (perf) |
| Connect wallet | `components/WalletConnect.tsx` | `useDynamicContext()` + `setShowAuthFlow()` |
| Send deposit | `components/BattleArena.tsx` | `primaryWallet.getWalletClient().sendTransaction()` |
| Escrow payout | `lib/escrow.ts` | Server wallet sends 95% to winner on Sepolia |
| Escrow API | `app/api/escrow/route.ts` | Deposit tracking, balance check, payout |
| Profile display | `components/PlayerProfile.tsx` | Shows connected wallet address |
| Battle scanner | `components/BattleScanner.tsx` | Wager mode requires connected wallet |

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Env vars

```env
ENS_PARENT_NAME=raidbattle.eth
ENS_OWNER_PRIVATE_KEY=xxx
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=xxx
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=openssl-rand-base64-32
```

## Scripts

```bash
npx tsx scripts/resync-ens.ts    # Re-sync all players to ENS
npx tsx scripts/sync-index.ts    # Rebuild player index on ENS
```

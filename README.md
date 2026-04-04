# ETH Global Cannes 2026

World MiniKit app with HaLo NFC bracelet binding.

## Stack

- **Next.js 14** (App Router)
- **World MiniKit** — Sign in, Verify (World ID), Pay
- **HaLo NFC** (libhalo) — bind a physical bracelet to a World ID
- **next-auth** — session management via Worldcoin OAuth

## Features

| Feature | Route / Component |
|---|---|
| Sign in with World ID | `components/SignIn` |
| Bind HaLo NFC bracelet | `components/HaloBracelet` → `api/players/bind-bracelet` |
| World ID proof verification | `components/Verify` → `api/verify` |
| WLD / USDC.e payment | `components/Pay` → `api/initiate-payment` + `api/confirm-payment` |

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Env vars

```env
APP_ID=                    # World Developer Portal app ID
DEV_PORTAL_API_KEY=        # World Developer Portal API key
WLD_CLIENT_ID=             # Sign in with World ID client ID
WLD_CLIENT_SECRET=         # Sign in with World ID client secret
NEXTAUTH_URL=              # Public URL (ngrok in dev, domain in prod)
NEXTAUTH_SECRET=           # Random secret — openssl rand -base64 32
```

## Testing on World App

1. Run `ngrok http 3000` and copy the HTTPS URL
2. Set `NEXTAUTH_URL=<ngrok-url>` in `.env.local` and restart
3. In [developer.worldcoin.org](https://developer.worldcoin.org): set App URL and add `<ngrok-url>/api/auth/callback/worldcoin` as redirect URI
4. Open World App → Apps → search your app, or Settings → Developer → Enter URL

> **NFC note:** HaLo bracelet scanning requires Chrome on Android. It may not work inside the World App WebView — test NFC directly in Chrome mobile.

## Docs

- [World MiniKit docs](https://docs.world.org/)
- [Developer Portal](https://developer.worldcoin.org/)
- [libhalo](https://github.com/arx-research/libhalo)

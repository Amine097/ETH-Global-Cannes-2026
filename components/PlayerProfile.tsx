"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";

const SKINS = ["⚔️", "🛡️", "🔮", "🏹", "⚡", "🔥"];

const RANK_LABELS: Record<string, string> = {
  bronze: "Squire",
  silver: "Knight",
  gold: "Lord",
  platinum: "Duke",
  diamond: "Legend",
};

const RANK_COLORS: Record<string, string> = {
  bronze: "text-[#cd7f32]",
  silver: "text-[#c0c0c0]",
  gold: "text-[#c9a227]",
  platinum: "text-[#7dd8e6]",
  diamond: "text-[#b57dee]",
};

const RANK_BORDER: Record<string, string> = {
  bronze: "border-[#cd7f32]/30",
  silver: "border-[#c0c0c0]/30",
  gold: "border-[#c9a227]/40",
  platinum: "border-[#7dd8e6]/30",
  diamond: "border-[#b57dee]/40",
};

const RANK_ICONS: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "👑",
  platinum: "💎",
  diamond: "🌟",
};

interface ProfileData {
  xp: number;
  level: number;
  rank: string;
  skinIndex: number;
  position: number | null;
  total: number | null;
}

interface Props {
  etherAddress: string;
  publicKey: string;
  username: string;
  walletAddress: string;
  onBattle: () => void;
  onConnectWallet: () => void;
  onLogout: () => void;
}

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return level * (level - 1) * 50;
}

export const PlayerProfile = ({ etherAddress, publicKey, username, walletAddress, onBattle, onConnectWallet, onLogout }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [profile, setProfile] = useState<ProfileData>({ xp: 0, level: 1, rank: "bronze", skinIndex: 1, position: null, total: null });

  const fetchProfile = useCallback(() => {
    const pkParam = encodeURIComponent(publicKey);
    Promise.all([
      fetch(`/api/players/check?pk=${pkParam}`).then((r) => r.json()),
      fetch(`/api/players/rank?pk=${pkParam}`).then((r) => r.json()),
    ])
      .then(([check, rankData]) => {
        if (check.player) {
          setProfile({
            xp: check.player.xp ?? 0,
            level: check.player.level ?? 1,
            rank: check.player.rank ?? "bronze",
            skinIndex: check.player.skinIndex ?? 1,
            position: rankData.position ?? null,
            total: rankData.total ?? null,
          });
        }
      })
      .catch(() => {});
  }, [publicKey]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (canvasRef.current && publicKey) {
      QRCode.toCanvas(canvasRef.current, publicKey, {
        width: 160,
        margin: 2,
        color: { dark: "#0a0806", light: "#f5e6c0" },
      });
    }
  }, [publicKey]);

  const currentLevelXp = xpForLevel(profile.level);
  const nextLevelXp = xpForLevel(profile.level + 1);
  const xpProgress = nextLevelXp > currentLevelXp
    ? ((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
    : 100;

  const rankLabel = RANK_LABELS[profile.rank] ?? profile.rank;
  const rankColor = RANK_COLORS[profile.rank] ?? "text-[#f0e6c8]";
  const rankBorder = RANK_BORDER[profile.rank] ?? "border-[#2e2010]";
  const rankIcon = RANK_ICONS[profile.rank] ?? "⚔️";

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6 py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(201,162,39,0.06),transparent_60%)]" />

      <div className="relative w-full max-w-sm">
        {/* Avatar + Identity */}
        <div className="mb-5 text-center">
          {/* Avatar in styled ring */}
          <div className={`relative mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2 ${rankBorder} bg-[#100e08]`}
               style={{ boxShadow: `0 0 24px rgba(201,162,39,0.12)` }}>
            <span className="text-4xl">{SKINS[(profile.skinIndex - 1) % 6]}</span>
          </div>

          <h1 className="font-cinzel text-2xl font-bold tracking-wide text-[#f0e6c8]"
              style={{ textShadow: "0 0 20px rgba(201,162,39,0.2)" }}>
            {username}
          </h1>
          <p className="mt-1 font-cinzel text-xs tracking-widest text-[#5a4010]">
            {username.toLowerCase()}.raidbattle.eth
          </p>

          {/* Rank badge */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#2e2010] bg-[#100e08] px-4 py-1.5">
            <span className="text-base">{rankIcon}</span>
            <span className={`font-cinzel text-sm font-semibold tracking-wider ${rankColor}`}>
              {rankLabel}
            </span>
          </div>

          {/* Global position */}
          {profile.position !== null && profile.total !== null && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#c9a227]/20 bg-[#100e08] px-4 py-1">
              <span className="text-xs">🏰</span>
              <span className="font-cinzel text-xs tracking-wider text-[#c9a227]">
                #{profile.position}
              </span>
              <span className="font-cinzel text-xs text-[#3d2a10]">
                of {profile.total}
              </span>
            </div>
          )}
        </div>

        {/* Level + XP */}
        <div className="medieval-card mb-3 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-cinzel text-xs tracking-widest text-[#7a6845] uppercase">Glory</span>
            <span className="font-cinzel text-xs font-semibold text-[#f0e6c8]">
              Level {profile.level}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#1e1608]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, xpProgress)}%`,
                background: "linear-gradient(90deg, #9e7d1a, #c9a227)",
                boxShadow: "0 0 8px rgba(201,162,39,0.4)",
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-cinzel text-xs text-[#5a4010]">
            <span>{profile.xp} XP</span>
            <span>{nextLevelXp} XP</span>
          </div>
        </div>

        {/* QR Code — show to opponent */}
        <div className="medieval-card mb-3 flex flex-col items-center p-5">
          <p className="mb-3 font-cinzel text-[10px] tracking-[0.3em] text-[#5a4010] uppercase">
            Your Sigil — Show to Challenger
          </p>
          <div className="rounded-lg border border-[#2e2010] bg-[#0d0b06] p-3">
            <canvas ref={canvasRef} />
          </div>
          <p className="mt-2 font-crimson text-xs text-[#3d2a10]">
            Opponent scans this to challenge you
          </p>
        </div>

        {/* Stats */}
        <div className="medieval-card mb-3 p-4">
          <div className="space-y-3">
            <StatRow label="Bracelet" value={etherAddress.slice(0, 8) + "…" + etherAddress.slice(-6)} mono />
            <div className="h-px bg-[#1e1608]" />
            <StatRow label="World ID" value="Verified ✓" accent />
            <div className="h-px bg-[#1e1608]" />
            <StatRow label="ENS" value={`${username.toLowerCase()}.raidbattle.eth`} />
          </div>
        </div>

        {/* Wallet (Dynamic) */}
        <div className="medieval-card mb-5 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Wallet</span>
            <span className="font-crimson text-[10px] text-[#7a6845]">via Dynamic</span>
          </div>
          {walletAddress ? (
            <div>
              <div className="rounded-lg border border-[#c9a227]/20 bg-[#c9a227]/5 px-3 py-2">
                <p className="font-mono text-xs text-[#c9a227]">
                  {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
                </p>
                <p className="mt-1 font-crimson text-[10px] text-[#7a6845]">Ready for wager battles</p>
              </div>
              <button
                onClick={onConnectWallet}
                className="mt-2 w-full rounded-lg py-2 font-cinzel text-[10px] tracking-wider text-[#5a4010] hover:text-[#c9a227] transition-colors"
              >
                Change Wallet
              </button>
            </div>
          ) : (
            <button
              onClick={onConnectWallet}
              className="w-full rounded-lg border border-dashed border-[#c9a227]/30 bg-[#c9a227]/5 px-4 py-3 font-cinzel text-xs tracking-wider text-[#c9a227] hover:border-[#c9a227]/60 hover:bg-[#c9a227]/10 transition-all"
            >
              💰 Connect Wallet for Wagers
            </button>
          )}
        </div>

        {/* Battle button */}
        <button
          onClick={onBattle}
          className="btn-gold mb-3 w-full rounded-lg px-8 py-4 text-base"
        >
          ⚔ Seek Battle
        </button>

        <button
          onClick={onLogout}
          className="w-full rounded-lg py-3 font-cinzel text-xs tracking-wider text-[#3d2a10] hover:text-[#5a4010] transition-colors"
        >
          Abandon the Realm
        </button>
      </div>
    </div>
  );
};

function StatRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">{label}</span>
      <span
        className={`font-crimson text-sm ${mono ? "font-mono tracking-tight" : ""} ${
          accent ? "font-semibold text-[#c9a227]" : "text-[#f0e6c8]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

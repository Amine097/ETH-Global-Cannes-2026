"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";

const SKINS = ["🗡️", "🛡️", "🔮", "🏹", "⚡", "🔥"];
const RANK_COLORS: Record<string, string> = {
  bronze: "text-orange-400",
  silver: "text-gray-300",
  gold: "text-yellow-400",
  platinum: "text-cyan-300",
  diamond: "text-purple-400",
};

interface ProfileData {
  xp: number;
  level: number;
  rank: string;
  skinIndex: number;
}

interface Props {
  etherAddress: string;
  publicKey: string;
  username: string;
  onBattle: () => void;
  onLogout: () => void;
}

// XP needed for a given level (must match lib/battle.ts)
function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return level * (level - 1) * 50;
}

export const PlayerProfile = ({ etherAddress, publicKey, username, onBattle, onLogout }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [profile, setProfile] = useState<ProfileData>({ xp: 0, level: 1, rank: "bronze", skinIndex: 1 });

  const fetchProfile = useCallback(() => {
    fetch(`/api/players/check?pk=${encodeURIComponent(publicKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.player) {
          setProfile({
            xp: data.player.xp ?? 0,
            level: data.player.level ?? 1,
            rank: data.player.rank ?? "bronze",
            skinIndex: data.player.skinIndex ?? 1,
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
        width: 180,
        margin: 2,
        color: { dark: "#ffffff", light: "#00000000" },
      });
    }
  }, [publicKey]);

  const currentLevelXp = xpForLevel(profile.level);
  const nextLevelXp = xpForLevel(profile.level + 1);
  const xpProgress = nextLevelXp > currentLevelXp
    ? ((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
    : 100;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Avatar + Name */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">{SKINS[(profile.skinIndex - 1) % 6]}</div>
          <h1 className="text-3xl font-bold">{username}</h1>
          <p className="mt-1 text-sm text-[#22c55e]">{username.toLowerCase()}.eth</p>
        </div>

        {/* Level + XP bar */}
        <div className="mb-4 rounded-2xl border border-[#1e1e1e] bg-[#111] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Level {profile.level}</span>
            <span className={`text-sm font-bold capitalize ${RANK_COLORS[profile.rank] ?? "text-white"}`}>
              {profile.rank}
            </span>
          </div>
          <div className="overflow-hidden rounded-full bg-[#1e1e1e]">
            <div
              className="h-2 rounded-full bg-[#22c55e] transition-all duration-500"
              style={{ width: `${Math.min(100, xpProgress)}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-[#888]">
            {profile.xp} / {nextLevelXp} XP
          </p>
        </div>

        {/* QR Code */}
        <div className="mb-4 flex flex-col items-center rounded-2xl border border-[#1e1e1e] bg-[#111] p-6">
          <canvas ref={canvasRef} className="mb-3" />
          <p className="text-xs text-[#888]">Show this to your opponent</p>
        </div>

        {/* Stats */}
        <div className="mb-6 rounded-2xl border border-[#1e1e1e] bg-[#111] p-5">
          <div className="space-y-4">
            <Row label="Bracelet" value={etherAddress.slice(0, 8) + "..." + etherAddress.slice(-6)} mono />
            <Row label="World ID" value="Verified" accent />
          </div>
        </div>

        <button
          onClick={onBattle}
          className="mb-3 w-full rounded-2xl bg-[#22c55e] px-8 py-4 text-lg font-bold text-black active:opacity-80"
        >
          Battle!
        </button>

        <button
          onClick={onLogout}
          className="w-full rounded-xl py-3 text-sm text-[#888] hover:text-white"
        >
          Log out
        </button>
      </div>
    </div>
  );
};

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#888]">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""} ${accent ? "font-semibold text-[#22c55e]" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

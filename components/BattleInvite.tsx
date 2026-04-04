"use client";

import { useEffect, useState } from "react";

const SKINS = ["🗡️", "🛡️", "🔮", "🏹", "⚡", "🔥"];
const RANK_COLORS: Record<string, string> = {
  bronze: "text-orange-400",
  silver: "text-gray-300",
  gold: "text-yellow-400",
  platinum: "text-cyan-300",
  diamond: "text-purple-400",
};

interface Props {
  attackerUsername: string;
  attackerLevel: number;
  attackerSkin: number;
  attackerRank: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const BattleInvite = ({
  attackerUsername,
  attackerLevel,
  attackerSkin,
  attackerRank,
  onAccept,
  onDecline,
}: Props) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          onDecline();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDecline]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Pulse ring */}
        <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-red-500/10" />
          <span className="relative text-6xl">{SKINS[(attackerSkin - 1) % 6]}</span>
        </div>

        <h1 className="mb-1 text-center text-2xl font-bold">Battle Request!</h1>
        <p className="mb-6 text-center text-sm text-[#888]">
          <span className="font-semibold text-white">{attackerUsername}</span> wants to fight
        </p>

        {/* Opponent stats */}
        <div className="mb-6 rounded-2xl border border-[#1e1e1e] bg-[#111] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#888]">Level</span>
            <span className="text-sm font-bold text-white">{attackerLevel}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-[#888]">Rank</span>
            <span className={`text-sm font-bold capitalize ${RANK_COLORS[attackerRank] ?? "text-white"}`}>
              {attackerRank}
            </span>
          </div>
        </div>

        {/* Timer bar */}
        <div className="mb-6 overflow-hidden rounded-full bg-[#1e1e1e]">
          <div
            className="h-1 rounded-full bg-red-500 transition-all duration-1000"
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 rounded-2xl border border-[#333] bg-transparent px-6 py-4 text-lg font-semibold text-white active:opacity-80"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-2xl bg-[#22c55e] px-6 py-4 text-lg font-bold text-black active:opacity-80"
          >
            Accept
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-[#888]">
          Auto-decline in {timeLeft}s
        </p>
      </div>
    </div>
  );
};

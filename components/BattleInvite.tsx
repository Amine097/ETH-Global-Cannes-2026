"use client";

import { useEffect, useState } from "react";

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

  const rankLabel = RANK_LABELS[attackerRank] ?? attackerRank;
  const rankColor = RANK_COLORS[attackerRank] ?? "text-[#f0e6c8]";

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      {/* Crimson danger glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(139,26,26,0.12),transparent_65%)]" />

      <div className="relative w-full max-w-sm">
        {/* Pulsing challenger avatar */}
        <div className="relative mx-auto mb-6 flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(139,26,26,0.15)]" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-[rgba(139,26,26,0.08)]" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#8b1a1a]/40 bg-[#100e08]">
            <span className="text-4xl">{SKINS[(attackerSkin - 1) % 6]}</span>
          </div>
        </div>

        {/* Challenge text */}
        <div className="mb-6 text-center">
          <p className="font-cinzel text-xs tracking-[0.35em] text-[#7a3a3a] uppercase mb-2">
            A Challenger Approaches
          </p>
          <h1 className="font-cinzel text-2xl font-bold tracking-wide text-[#f0e6c8]"
              style={{ textShadow: "0 0 20px rgba(139,26,26,0.3)" }}>
            {attackerUsername}
          </h1>
          <p className="mt-1 font-crimson text-sm text-[#7a6845]">demands satisfaction on the field of battle</p>
        </div>

        {/* Challenger stats */}
        <div className="medieval-card mb-5 p-4">
          <div className="flex items-center justify-between">
            <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Level</span>
            <span className="font-cinzel text-sm font-bold text-[#f0e6c8]">{attackerLevel}</span>
          </div>
          <div className="my-3 h-px bg-[#1e1608]" />
          <div className="flex items-center justify-between">
            <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Title</span>
            <span className={`font-cinzel text-sm font-bold ${rankColor}`}>{rankLabel}</span>
          </div>
        </div>

        {/* Countdown bar */}
        <div className="mb-5">
          <div className="mb-2 flex justify-between font-cinzel text-[10px] tracking-widest text-[#5a4010] uppercase">
            <span>Time to decide</span>
            <span className={(timeLeft <= 10 ? "text-[#e04444]" : "")}>{timeLeft}s</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1e1608]">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${(timeLeft / 30) * 100}%`,
                background: timeLeft <= 10
                  ? "linear-gradient(90deg, #6e1010, #b02020)"
                  : "linear-gradient(90deg, #8b1a1a, #cc3333)",
                boxShadow: "0 0 8px rgba(139,26,26,0.5)",
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="btn-outline-gold flex-1 rounded-lg px-4 py-4 text-base"
          >
            Refuse
          </button>
          <button
            onClick={onAccept}
            className="btn-crimson flex-1 rounded-lg px-4 py-4 text-base"
          >
            Accept ⚔
          </button>
        </div>

        <p className="mt-4 text-center font-cinzel text-[10px] tracking-wider text-[#3d2a10]">
          Silence is cowardice — auto-refuse in {timeLeft}s
        </p>
      </div>
    </div>
  );
};

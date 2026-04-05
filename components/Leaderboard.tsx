"use client";

import { useState, useEffect } from "react";

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

const POSITION_ICONS = ["👑", "🥈", "🥉"];

interface LeaderboardEntry {
  position: number;
  username: string;
  level: number;
  xp: number;
  rank: string;
  skinIndex: number;
  publicKey: string;
}

interface Props {
  playerPk: string;
  onBack: () => void;
}

export const Leaderboard = ({ playerPk, onBack }: Props) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/leaderboard?pk=${encodeURIComponent(playerPk)}`)
      .then((r) => {
        if (r.status === 403) throw new Error("Unauthorized");
        return r.json();
      })
      .then((data) => {
        setEntries(data.leaderboard ?? []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [playerPk]);

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center px-6 py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(201,162,39,0.08),transparent_65%)]" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <span className="mb-2 block text-4xl">🏰</span>
          <h1 className="font-cinzel text-2xl font-bold tracking-wider text-[#f0e6c8]">
            Hall of Champions
          </h1>
          <p className="mt-1 font-crimson text-sm text-[#7a6845]">
            Admin view — global ranking
          </p>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        {loading && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-8 w-8 spinner-gold" />
            <p className="font-crimson text-sm text-[#7a6845]">Loading rankings...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 px-4 py-6 text-center">
            <p className="font-crimson text-sm text-[#e04444]">{error}</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-crimson text-sm text-[#7a6845]">No warriors have entered the realm yet.</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div
                key={entry.position}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                  entry.position === 1
                    ? "border-[#c9a227]/40 bg-[#c9a227]/10"
                    : entry.position <= 3
                    ? "border-[#c9a227]/20 bg-[#c9a227]/5"
                    : "border-[#2e2010] bg-[#100e08]"
                }`}
              >
                {/* Position */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#2e2010] bg-[#0d0b06]">
                  {entry.position <= 3 ? (
                    <span className="text-lg">{POSITION_ICONS[entry.position - 1]}</span>
                  ) : (
                    <span className="font-cinzel text-xs font-bold text-[#5a4010]">
                      {entry.position}
                    </span>
                  )}
                </div>

                {/* Skin */}
                <span className="text-xl">{SKINS[(entry.skinIndex - 1) % 6]}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-cinzel text-sm font-semibold text-[#f0e6c8] truncate">
                    {entry.username}
                  </p>
                  <p className="font-crimson text-[10px] text-[#5a4010]">
                    {entry.username}.raidbattle.eth
                  </p>
                </div>

                {/* Stats */}
                <div className="flex-shrink-0 text-right">
                  <p className="font-cinzel text-xs font-bold text-[#f0e6c8]">
                    Lv.{entry.level}
                  </p>
                  <p className={`font-cinzel text-[10px] font-semibold ${RANK_COLORS[entry.rank] ?? "text-[#7a6845]"}`}>
                    {RANK_LABELS[entry.rank] ?? entry.rank}
                  </p>
                  <p className="font-crimson text-[10px] text-[#5a4010]">
                    {entry.xp} XP
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && !error && entries.length > 0 && (
          <div className="mt-4 rounded-lg border border-[#2e2010] bg-[#0d0b06] p-3 text-center">
            <p className="font-cinzel text-[10px] tracking-widest text-[#5a4010] uppercase">
              {entries.length} warriors · Data from ENS Sepolia
            </p>
          </div>
        )}

        <button
          onClick={onBack}
          className="mt-6 w-full rounded-lg py-3 font-cinzel text-xs tracking-wider text-[#3d2a10] hover:text-[#5a4010] transition-colors"
        >
          ← Back to profile
        </button>
      </div>
    </div>
  );
};

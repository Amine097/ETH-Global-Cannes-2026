"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Battle } from "@/lib/battle";

const SKINS = ["🗡️", "🛡️", "🔮", "🏹", "⚡", "🔥"];
const RANK_COLORS: Record<string, string> = {
  bronze: "text-orange-400",
  silver: "text-gray-300",
  gold: "text-yellow-400",
  platinum: "text-cyan-300",
  diamond: "text-purple-400",
};

type Phase = "countdown" | "resolving" | "result";

interface Props {
  battleId: string;
  playerPk: string;
  role: "attacker" | "defender";
  onDone: () => void;
}

export const BattleArena = ({ battleId, playerPk, role, onDone }: Props) => {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(5);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolved = useRef(false);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("resolving");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Resolve (attacker resolves, defender polls)
  const resolve = useCallback(async () => {
    if (resolved.current) return;
    resolved.current = true;

    if (role === "attacker") {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", battleId }),
      });
      const data = await res.json();
      if (data.battle) {
        setBattle(data.battle);
        setPhase("result");
      } else {
        setError(data.error ?? "Failed to resolve");
      }
    } else {
      // Defender polls until resolved
      const poll = async () => {
        for (let i = 0; i < 15; i++) {
          const res = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll-status", battleId }),
          });
          const data = await res.json();
          if (data.battle?.status === "resolved") {
            setBattle(data.battle);
            setPhase("result");
            return;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        setError("Battle timed out");
      };
      poll();
    }
  }, [battleId, role]);

  useEffect(() => {
    if (phase === "resolving") resolve();
  }, [phase, resolve]);

  // Also fetch battle info for display during countdown
  useEffect(() => {
    fetch("/api/battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "poll-status", battleId }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.battle) setBattle(d.battle); });
  }, [battleId]);

  const me = battle ? (role === "attacker" ? battle.attacker : battle.defender) : null;
  const opponent = battle ? (role === "attacker" ? battle.defender : battle.attacker) : null;
  const iWon = battle?.winner === role;
  const myXpDelta = battle
    ? role === "attacker"
      ? battle.attackerXpDelta
      : battle.defenderXpDelta
    : 0;
  const myNewLevel = battle
    ? role === "attacker"
      ? battle.attackerNewLevel
      : battle.defenderNewLevel
    : undefined;
  const myNewRank = battle
    ? role === "attacker"
      ? battle.attackerNewRank
      : battle.defenderNewRank
    : undefined;

  // ── Countdown phase ──
  if (phase === "countdown") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          {battle && (
            <div className="mb-8 flex items-center justify-center gap-8">
              <div className="text-center">
                <span className="text-4xl">{SKINS[(battle.attacker.skinIndex - 1) % 6]}</span>
                <p className="mt-1 text-sm font-semibold">{battle.attacker.username}</p>
                <p className="text-xs text-[#888]">Lv.{battle.attacker.level}</p>
              </div>
              <span className="text-2xl font-bold text-[#888]">VS</span>
              <div className="text-center">
                <span className="text-4xl">{SKINS[(battle.defender.skinIndex - 1) % 6]}</span>
                <p className="mt-1 text-sm font-semibold">{battle.defender.username}</p>
                <p className="text-xs text-[#888]">Lv.{battle.defender.level}</p>
              </div>
            </div>
          )}

          <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/10" />
            <span className="text-8xl font-black text-white">{countdown}</span>
          </div>

          <p className="mt-6 text-sm text-[#888]">Battle starting...</p>
        </div>
      </div>
    );
  }

  // ── Resolving phase ──
  if (phase === "resolving") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-6xl animate-pulse">⚔️</div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
          <p className="mt-4 text-sm text-[#888]">Calculating result...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <button onClick={onDone} className="rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black">
            Back to profile
          </button>
        </div>
      </div>
    );
  }

  // ── Result phase ──
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Winner banner */}
        <div className={`mb-6 rounded-2xl border p-8 text-center ${
          iWon ? "border-[#22c55e]/30 bg-[#22c55e]/5" : "border-red-500/30 bg-red-500/5"
        }`}>
          <div className="mb-3 text-6xl">{iWon ? "🏆" : "💀"}</div>
          <p className={`text-3xl font-black ${iWon ? "text-[#22c55e]" : "text-red-400"}`}>
            {iWon ? "Victory!" : "Defeat"}
          </p>
        </div>

        {/* VS recap */}
        {me && opponent && (
          <div className="mb-4 flex items-center justify-center gap-6">
            <div className={`text-center ${iWon ? "" : "opacity-50"}`}>
              <span className="text-3xl">{SKINS[(me.skinIndex - 1) % 6]}</span>
              <p className="text-sm font-semibold">{me.username}</p>
            </div>
            <span className="text-lg font-bold text-[#888]">vs</span>
            <div className={`text-center ${!iWon ? "" : "opacity-50"}`}>
              <span className="text-3xl">{SKINS[(opponent.skinIndex - 1) % 6]}</span>
              <p className="text-sm font-semibold">{opponent.username}</p>
            </div>
          </div>
        )}

        {/* XP change */}
        <div className="mb-6 rounded-2xl border border-[#1e1e1e] bg-[#111] p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#888]">XP</span>
              <span className={`text-sm font-bold ${(myXpDelta ?? 0) >= 0 ? "text-[#22c55e]" : "text-red-400"}`}>
                {(myXpDelta ?? 0) >= 0 ? "+" : ""}{myXpDelta}
              </span>
            </div>
            {myNewLevel !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#888]">Level</span>
                <span className="text-sm font-bold text-white">{myNewLevel}</span>
              </div>
            )}
            {myNewRank && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#888]">Rank</span>
                <span className={`text-sm font-bold capitalize ${RANK_COLORS[myNewRank] ?? "text-white"}`}>
                  {myNewRank}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onDone}
          className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black active:opacity-80"
        >
          Back to profile
        </button>
      </div>
    </div>
  );
};

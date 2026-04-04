"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Battle } from "@/lib/battle";

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

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("resolving"); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

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
      if (data.battle) { setBattle(data.battle); setPhase("result"); }
      else setError(data.error ?? "Failed to resolve");
    } else {
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
        setError("The battle scroll was lost in the void");
      };
      poll();
    }
  }, [battleId, role]);

  useEffect(() => {
    if (phase === "resolving") resolve();
  }, [phase, resolve]);

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
  const myXpDelta = battle ? (role === "attacker" ? battle.attackerXpDelta : battle.defenderXpDelta) : 0;
  const myNewLevel = battle ? (role === "attacker" ? battle.attackerNewLevel : battle.defenderNewLevel) : undefined;
  const myNewRank = battle ? (role === "attacker" ? battle.attackerNewRank : battle.defenderNewRank) : undefined;

  // ── Countdown ──
  if (phase === "countdown") {
    return (
      <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(139,26,26,0.1),transparent_65%)]" />
        <div className="relative w-full max-w-sm text-center">
          <p className="mb-6 font-cinzel text-[10px] tracking-[0.45em] text-[#5a4010] uppercase">
            Combat Commences
          </p>

          {battle && (
            <div className="mb-8 flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-[#2e2010] bg-[#100e08]">
                  <span className="text-3xl">{SKINS[(battle.attacker.skinIndex - 1) % 6]}</span>
                </div>
                <p className="font-cinzel text-xs font-semibold text-[#f0e6c8]">{battle.attacker.username}</p>
                <p className="font-cinzel text-[10px] text-[#5a4010]">Lv.{battle.attacker.level}</p>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="font-cinzel text-sm font-black text-[#3d2a10]">VS</span>
                <div className="h-px w-8 bg-[#3d2a10]" />
              </div>

              <div className="text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-[#2e2010] bg-[#100e08]">
                  <span className="text-3xl">{SKINS[(battle.defender.skinIndex - 1) % 6]}</span>
                </div>
                <p className="font-cinzel text-xs font-semibold text-[#f0e6c8]">{battle.defender.username}</p>
                <p className="font-cinzel text-[10px] text-[#5a4010]">Lv.{battle.defender.level}</p>
              </div>
            </div>
          )}

          {/* Big countdown number */}
          <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(201,162,39,0.06)]" />
            <div className="absolute inset-4 rounded-full border border-[#3d2a10] bg-[#100e08]" />
            <span
              className="relative font-cinzel text-8xl font-black text-[#c9a227]"
              style={{ textShadow: "0 0 40px rgba(201,162,39,0.6)" }}
            >
              {countdown}
            </span>
          </div>

          <p className="mt-6 font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">
            Steel yourself, warrior
          </p>
        </div>
      </div>
    );
  }

  // ── Resolving ──
  if (phase === "resolving") {
    return (
      <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(201,162,39,0.06),transparent_65%)]" />
        <div className="relative w-full max-w-sm text-center">
          <span className="mb-6 block text-6xl animate-pulse">⚔️</span>
          <div className="mx-auto mb-4 h-10 w-10 spinner-gold" />
          <p className="font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">
            The fates decide...
          </p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
        <div className="relative w-full max-w-sm text-center">
          <p className="mb-2 font-cinzel text-sm text-[#5a4010] uppercase tracking-widest">The scroll is cursed</p>
          <p className="mb-6 font-crimson text-base text-[#e04444]">{error}</p>
          <button onClick={onDone} className="btn-gold w-full rounded-lg px-8 py-4 text-base">
            Return to Keep
          </button>
        </div>
      </div>
    );
  }

  // ── Result ──
  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6 py-8">
      <div
        className={`pointer-events-none fixed inset-0 ${
          iWon
            ? "bg-[radial-gradient(ellipse_at_50%_20%,rgba(201,162,39,0.1),transparent_65%)]"
            : "bg-[radial-gradient(ellipse_at_50%_20%,rgba(139,26,26,0.1),transparent_65%)]"
        }`}
      />

      <div className="relative w-full max-w-sm">
        {/* Victory / Defeat banner */}
        <div
          className={`mb-5 rounded-lg border p-8 text-center ${
            iWon
              ? "border-[#c9a227]/25 bg-[#100e08]"
              : "border-[#8b1a1a]/30 bg-[#100e08]"
          }`}
          style={{
            boxShadow: iWon
              ? "0 0 32px rgba(201,162,39,0.1), inset 0 1px 0 rgba(201,162,39,0.06)"
              : "0 0 32px rgba(139,26,26,0.1), inset 0 1px 0 rgba(139,26,26,0.06)",
          }}
        >
          <div className="mb-3 text-6xl">{iWon ? "🏆" : "💀"}</div>
          <p
            className={`font-cinzel text-3xl font-black tracking-wider ${
              iWon ? "text-[#c9a227]" : "text-[#e04444]"
            }`}
            style={{
              textShadow: iWon
                ? "0 0 32px rgba(201,162,39,0.5)"
                : "0 0 32px rgba(224,68,68,0.4)",
            }}
          >
            {iWon ? "Victory!" : "Defeated"}
          </p>
          {iWon && (
            <p className="mt-1 font-cinzel text-xs tracking-[0.3em] text-[#7a6845] uppercase">
              Glory be upon you
            </p>
          )}
          {!iWon && (
            <p className="mt-1 font-cinzel text-xs tracking-[0.3em] text-[#5a3030] uppercase">
              Your foe was worthy
            </p>
          )}
        </div>

        {/* VS recap */}
        {me && opponent && (
          <div className="mb-4 flex items-center justify-center gap-5">
            <div className={`text-center ${iWon ? "opacity-100" : "opacity-40"}`}>
              <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full border border-[#2e2010] bg-[#100e08]">
                <span className="text-2xl">{SKINS[(me.skinIndex - 1) % 6]}</span>
              </div>
              <p className="font-cinzel text-xs font-semibold text-[#f0e6c8]">{me.username}</p>
            </div>
            <span className="font-cinzel text-sm font-bold text-[#3d2a10]">vs</span>
            <div className={`text-center ${!iWon ? "opacity-100" : "opacity-40"}`}>
              <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full border border-[#2e2010] bg-[#100e08]">
                <span className="text-2xl">{SKINS[(opponent.skinIndex - 1) % 6]}</span>
              </div>
              <p className="font-cinzel text-xs font-semibold text-[#f0e6c8]">{opponent.username}</p>
            </div>
          </div>
        )}

        {/* Spoils */}
        <div className="medieval-card mb-5 p-4">
          <p className="mb-3 text-center font-cinzel text-[10px] tracking-[0.3em] text-[#5a4010] uppercase">
            Spoils of Battle
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Glory (XP)</span>
              <span
                className={`font-cinzel text-sm font-bold ${
                  (myXpDelta ?? 0) >= 0 ? "text-[#c9a227]" : "text-[#e04444]"
                }`}
              >
                {(myXpDelta ?? 0) >= 0 ? "+" : ""}{myXpDelta}
              </span>
            </div>
            {myNewLevel !== undefined && (
              <>
                <div className="h-px bg-[#1e1608]" />
                <div className="flex items-center justify-between">
                  <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Level</span>
                  <span className="font-cinzel text-sm font-bold text-[#f0e6c8]">{myNewLevel}</span>
                </div>
              </>
            )}
            {myNewRank && (
              <>
                <div className="h-px bg-[#1e1608]" />
                <div className="flex items-center justify-between">
                  <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Title</span>
                  <span className={`font-cinzel text-sm font-bold ${RANK_COLORS[myNewRank] ?? "text-[#f0e6c8]"}`}>
                    {RANK_LABELS[myNewRank] ?? myNewRank}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onDone}
          className="btn-gold w-full rounded-lg px-8 py-4 text-base"
        >
          Return to Keep
        </button>
      </div>
    </div>
  );
};

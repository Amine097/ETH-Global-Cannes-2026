"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Battle, Minigame } from "@/lib/battle";

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

const MINIGAME_NAMES: Record<Minigame, string> = {
  taps: "Tap Frenzy",
  reaction: "Lightning Reflexes",
  rhythm: "Battle Rhythm",
};

type Phase = "deposit" | "waiting-deposits" | "syncing" | "countdown" | "fighting" | "submitting" | "resolving" | "result";

interface Props {
  battleId: string;
  playerPk: string;
  role: "attacker" | "defender";
  onDone: () => void;
}

export const BattleArena = ({ battleId, playerPk, role, onDone }: Props) => {
  const [phase, setPhase] = useState<Phase>("syncing");
  const [countdown, setCountdown] = useState(5);
  const [fightRemaining, setFightRemaining] = useState(10);
  const [taps, setTaps] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [rhythmScore, setRhythmScore] = useState(0);
  const [depositStatus, setDepositStatus] = useState<string | null>(null);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);
  const depositPollingRef = useRef(false);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolved = useRef(false);
  const tapsRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const rhythmScoreRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timersRef = useRef<{ fightStart: number; fightEnd: number }>({ fightStart: 0, fightEnd: 0 });

  const minigame = battle?.minigame ?? "taps";

  // Fetch battle data, handle wager deposit or sync to server timestamps
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "poll-status", battleId }),
      });
      const d = await res.json();
      if (!d.battle) return;
      setBattle(d.battle);

      // If wager battle, start deposit phase first
      if (d.battle.mode === "wager" && d.battle.wagerAmount) {
        const escRes = await fetch("/api/escrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-address" }),
        });
        const escData = await escRes.json();
        setEscrowAddress(escData.escrowAddress);
        if (!cancelled) setPhase("deposit");
        return;
      }

      // Free battle — check for timestamps
      if (d.battle.fightStartAt) {
        timersRef.current = { fightStart: d.battle.fightStartAt, fightEnd: d.battle.fightEndAt ?? 0 };
        const now = d.serverTime ?? Date.now();
        const msUntilFight = d.battle.fightStartAt - now;
        if (!cancelled) {
          if (msUntilFight <= 0) setPhase("fighting");
          else { setCountdown(Math.ceil(msUntilFight / 1000)); setPhase("countdown"); }
        }
        return;
      }

      // No timestamps yet — keep polling
      for (let i = 0; i < 30; i++) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const res2 = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll-status", battleId }),
          });
          const data2 = await res2.json();
          if (data2.battle) {
            setBattle(data2.battle);
            if (data2.battle.fightStartAt) {
              timersRef.current = { fightStart: data2.battle.fightStartAt, fightEnd: data2.battle.fightEndAt ?? 0 };
              const now2 = data2.serverTime ?? Date.now();
              const ms = data2.battle.fightStartAt - now2;
              if (!cancelled) {
                if (ms <= 0) setPhase("fighting");
                else { setCountdown(Math.ceil(ms / 1000)); setPhase("countdown"); }
              }
              return;
            }
          }
        } catch { /* retry */ }
      }
      if (!cancelled) setError("Could not sync battle timing");
    };
    init();
    return () => { cancelled = true; };
  }, [battleId]);

  // ── Wager deposit ──
  async function sendDeposit() {
    if (!battle?.wagerAmount || !escrowAddress) return;
    setDepositStatus("Sending deposit...");
    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) { setDepositStatus("No wallet found. Please connect via Dynamic."); return; }
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.[0]) { setDepositStatus("No account found"); return; }
      const weiAmount = BigInt(Math.floor(parseFloat(battle.wagerAmount) * 1e18));
      const hexValue = "0x" + weiAmount.toString(16);
      const txHash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: accounts[0], to: escrowAddress, value: hexValue }],
      });
      setDepositStatus("Deposit sent! Waiting for opponent...");
      await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm-deposit", battleId, playerPk, txHash }),
      });
      setPhase("waiting-deposits");
      pollDeposits();
    } catch (err: unknown) {
      setDepositStatus(err instanceof Error ? err.message : "Deposit failed");
    }
  }

  function pollDeposits() {
    depositPollingRef.current = true;
    const interval = setInterval(async () => {
      if (!depositPollingRef.current) { clearInterval(interval); return; }
      try {
        const res = await fetch("/api/escrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check-deposits", battleId }),
        });
        const data = await res.json();
        if (data.bothDeposited) {
          depositPollingRef.current = false;
          clearInterval(interval);
          setPhase("syncing");
          pollForTimestamps();
        }
      } catch { /* retry */ }
    }, 2000);
  }

  function pollForTimestamps() {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) { clearInterval(interval); setError("Could not sync battle timing"); return; }
      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll-status", battleId }),
        });
        const data = await res.json();
        if (data.battle?.fightStartAt) {
          clearInterval(interval);
          setBattle(data.battle);
          timersRef.current = { fightStart: data.battle.fightStartAt, fightEnd: data.battle.fightEndAt ?? 0 };
          const now = data.serverTime ?? Date.now();
          const ms = data.battle.fightStartAt - now;
          if (ms <= 0) setPhase("fighting");
          else { setCountdown(Math.ceil(ms / 1000)); setPhase("countdown"); }
        }
      } catch { /* retry */ }
    }, 1000);
  }

  useEffect(() => { return () => { depositPollingRef.current = false; }; }, []);

  // Countdown synced to server fightStartAt
  useEffect(() => {
    if (phase !== "countdown") return;
    const { fightStart } = timersRef.current;
    if (!fightStart) return;
    const tick = () => {
      const remaining = Math.ceil((fightStart - Date.now()) / 1000);
      if (remaining <= 0) { setCountdown(0); setPhase("fighting"); }
      else setCountdown(remaining);
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [phase]);

  // Video autoplay
  useEffect(() => {
    const tryPlay = () => { if (videoRef.current?.paused) videoRef.current.play().catch(() => {}); };
    tryPlay();
    const t1 = setTimeout(tryPlay, 100);
    const t2 = setTimeout(tryPlay, 500);
    const t3 = setTimeout(tryPlay, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  // Fight timer for taps minigame
  useEffect(() => {
    if (phase !== "fighting" || minigame !== "taps") return;
    const { fightEnd } = timersRef.current;
    if (!fightEnd) {
      const t = setTimeout(() => setPhase("submitting"), 10000);
      return () => clearTimeout(t);
    }
    const tick = () => {
      const remaining = Math.ceil((fightEnd - Date.now()) / 1000);
      if (remaining <= 0) { setFightRemaining(0); setPhase("submitting"); }
      else setFightRemaining(remaining);
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [phase, minigame]);

  // Submit results then resolve
  useEffect(() => {
    if (phase !== "submitting") return;
    let cancelled = false;

    const submit = async () => {
      // Submit minigame results
      if (minigame === "taps") {
        await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit-taps", battleId, role, taps: tapsRef.current }),
        });
      } else if (minigame === "reaction") {
        await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit-reactions", battleId, role, reactions: reactionTimesRef.current }),
        });
      } else if (minigame === "rhythm") {
        await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit-rhythm", battleId, role, score: rhythmScoreRef.current }),
        });
      }

      if (cancelled) return;

      // Check which field to wait for from opponent
      const fieldMap: Record<string, [string, string]> = {
        taps: ["defenderTaps", "attackerTaps"],
        reaction: ["defenderReactions", "attackerReactions"],
        rhythm: ["defenderRhythm", "attackerRhythm"],
      };
      const opponentField = (fieldMap[minigame] ?? fieldMap.taps)[role === "attacker" ? 0 : 1];

      if (role === "attacker") {
        // Wait for opponent data then resolve
        for (let i = 0; i < 15; i++) {
          if (cancelled) return;
          const res = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll-status", battleId }),
          });
          const data = await res.json();
          if (data.battle?.[opponentField] !== undefined && data.battle?.[opponentField] !== null) {
            const resolveRes = await fetch("/api/battle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "resolve", battleId }),
            });
            const resolveData = await resolveRes.json();
            if (!cancelled && resolveData.battle) {
              if (resolveData.battle.mode === "wager") {
                fetch("/api/escrow", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "payout", battleId }),
                }).then(r => r.json()).then(d => {
                  if (d.txHash) resolveData.battle.payoutTx = d.txHash;
                }).catch(() => {});
              }
              setBattle(resolveData.battle);
              setPhase("result");
            } else if (!cancelled) {
              setError(resolveData.error ?? "Failed to resolve");
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        // Timeout — resolve anyway
        if (!cancelled) {
          const resolveRes = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "resolve", battleId }),
          });
          const resolveData = await resolveRes.json();
          if (resolveData.battle) { setBattle(resolveData.battle); setPhase("result"); }
          else setError(resolveData.error ?? "Failed to resolve");
        }
      } else {
        // Defender: poll for resolution
        for (let i = 0; i < 20; i++) {
          if (cancelled) return;
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
        if (!cancelled) setError("The battle scroll was lost in the void");
      }
    };

    submit();
    return () => { cancelled = true; };
  }, [phase, battleId, role, minigame]);

  // Tap handler for taps minigame
  const handleTap = useCallback(() => {
    if (phase !== "fighting" || minigame !== "taps") return;
    if (videoRef.current?.paused) videoRef.current.play().catch(() => {});
    tapsRef.current += 1;
    setTaps(tapsRef.current);
  }, [phase, minigame]);

  // Reaction game complete handler
  const handleReactionDone = useCallback((times: number[]) => {
    reactionTimesRef.current = times;
    setReactionTimes(times);
    setPhase("submitting");
  }, []);

  // Rhythm game complete handler
  const handleRhythmDone = useCallback((score: number) => {
    rhythmScoreRef.current = score;
    setRhythmScore(score);
    setPhase("submitting");
  }, []);

  const me = battle ? (role === "attacker" ? battle.attacker : battle.defender) : null;
  const opponent = battle ? (role === "attacker" ? battle.defender : battle.attacker) : null;
  const iWon = battle?.winner === role;
  const myXpDelta = battle ? (role === "attacker" ? battle.attackerXpDelta : battle.defenderXpDelta) : 0;
  const myNewLevel = battle ? (role === "attacker" ? battle.attackerNewLevel : battle.defenderNewLevel) : undefined;
  const myNewRank = battle ? (role === "attacker" ? battle.attackerNewRank : battle.defenderNewRank) : undefined;
  const myTaps = role === "attacker" ? battle?.attackerTaps : battle?.defenderTaps;
  const oppTaps = role === "attacker" ? battle?.defenderTaps : battle?.attackerTaps;
  const totalTaps = (myTaps ?? 0) + (oppTaps ?? 0);
  const wonSpam = (myTaps ?? 0) > (oppTaps ?? 0);
  const myReactions = role === "attacker" ? battle?.attackerReactions : battle?.defenderReactions;
  const oppReactions = role === "attacker" ? battle?.defenderReactions : battle?.attackerReactions;
  const myRhythm = role === "attacker" ? battle?.attackerRhythm : battle?.defenderRhythm;
  const oppRhythm = role === "attacker" ? battle?.defenderRhythm : battle?.attackerRhythm;

  return (
    <>
      {/* Persistent video — always in DOM */}
      <video
        ref={videoRef}
        autoPlay muted loop playsInline preload="auto"
        src="/arena.mp4"
        className={
          phase === "fighting"
            ? "fixed top-0 left-0 w-screen object-cover z-0"
            : "fixed top-0 left-0 w-[1px] h-[1px] opacity-0 pointer-events-none"
        }
        style={phase === "fighting" ? { height: "100dvh" } : undefined}
      />

      {/* ── Deposit (wager battles) ── */}
      {phase === "deposit" && battle?.mode === "wager" && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(201,162,39,0.08),transparent_65%)]" />
          <div className="relative w-full max-w-sm text-center">
            <div className="mb-4 text-5xl">💰</div>
            <h2 className="font-cinzel text-xl font-bold tracking-wider text-[#f0e6c8]">Deposit Your Wager</h2>
            <p className="mt-2 font-crimson text-sm text-[#7a6845]">
              Send <span className="font-semibold text-[#c9a227]">{battle.wagerAmount} ETH</span> to the escrow
            </p>
            {escrowAddress && (
              <div className="mt-4 rounded-lg border border-[#2e2010] bg-[#0d0b06] px-3 py-2">
                <p className="font-cinzel text-[10px] tracking-wider text-[#5a4010] uppercase">Escrow Address (Sepolia)</p>
                <p className="mt-1 font-mono text-[10px] text-[#c9a227] break-all">{escrowAddress}</p>
              </div>
            )}
            <button onClick={sendDeposit} className="btn-gold mt-6 w-full rounded-lg px-8 py-4 text-base">
              Send {battle.wagerAmount} ETH
            </button>
            {depositStatus && <p className="mt-3 font-crimson text-xs text-[#7a6845]">{depositStatus}</p>}
            <p className="mt-4 font-crimson text-[10px] text-[#3d2a10]">Powered by <span className="text-[#5a4010]">Dynamic</span> · Sepolia Testnet</p>
          </div>
        </div>
      )}

      {/* ── Waiting for both deposits ── */}
      {phase === "waiting-deposits" && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(201,162,39,0.06),transparent_65%)]" />
          <div className="relative w-full max-w-sm text-center">
            <div className="mx-auto mb-4 h-10 w-10 spinner-gold" />
            <h2 className="font-cinzel text-lg font-bold tracking-wider text-[#f0e6c8]">Wager Deposited</h2>
            <p className="mt-2 font-crimson text-sm text-[#7a6845]">Waiting for opponent to deposit their wager...</p>
            <div className="mt-6 medieval-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-cinzel text-xs text-[#5a4010]">You</span>
                <span className="font-cinzel text-xs font-bold text-[#c9a227]">Deposited ✓</span>
              </div>
              <div className="h-px bg-[#1e1608]" />
              <div className="flex items-center justify-between mt-2">
                <span className="font-cinzel text-xs text-[#5a4010]">Opponent</span>
                <span className="font-cinzel text-xs text-[#7a6845] animate-pulse">Pending...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Syncing ── */}
      {phase === "syncing" && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(201,162,39,0.06),transparent_65%)]" />
          <div className="relative w-full max-w-sm text-center">
            <div className="mx-auto mb-4 h-10 w-10 spinner-gold" />
            <p className="font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">Synchronizing battle...</p>
          </div>
        </div>
      )}

      {/* ── Countdown ── */}
      {phase === "countdown" && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(139,26,26,0.1),transparent_65%)]" />
          <div className="relative w-full max-w-sm text-center">
            {/* Minigame badge */}
            <div className="mb-4 inline-block rounded-full border border-[#c9a227]/30 bg-[#c9a227]/10 px-4 py-1">
              <span className="font-cinzel text-[10px] tracking-[0.3em] text-[#c9a227] uppercase">
                {MINIGAME_NAMES[minigame]}
              </span>
            </div>

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

            <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(201,162,39,0.06)]" />
              <div className="absolute inset-4 rounded-full border border-[#3d2a10] bg-[#100e08]" />
              <span className="relative font-cinzel text-8xl font-black text-[#c9a227]" style={{ textShadow: "0 0 40px rgba(201,162,39,0.6)" }}>
                {countdown}
              </span>
            </div>

            <div className="mt-6 space-y-2 text-center">
              {minigame === "taps" && (
                <>
                  <p className="font-cinzel text-xs tracking-[0.3em] text-[#c9a227] uppercase">Tap the screen as fast as you can!</p>
                  <p className="font-crimson text-sm text-[#7a6845]">Out-tap your foe to gain favor from the gods</p>
                </>
              )}
              {minigame === "reaction" && (
                <>
                  <p className="font-cinzel text-xs tracking-[0.3em] text-[#c9a227] uppercase">Wait for the signal, then tap instantly!</p>
                  <p className="font-crimson text-sm text-[#7a6845]">3 rounds — win more rounds, gain more favor</p>
                </>
              )}
              {minigame === "rhythm" && (
                <>
                  <p className="font-cinzel text-xs tracking-[0.3em] text-[#c9a227] uppercase">Tap in sync with the rhythm!</p>
                  <p className="font-crimson text-sm text-[#7a6845]">8 beats — tap when the ring hits the circle</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Fighting: Taps Minigame ── */}
      {phase === "fighting" && minigame === "taps" && (
        <div
          className="fixed top-0 left-0 w-screen z-10 overflow-hidden select-none"
          style={{ height: "100dvh" }}
          onPointerDown={handleTap}
        >
          <div className="absolute inset-0 bg-black/40 z-[1]" />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2]">
            <div className="rounded-full border border-[#c9a227]/40 bg-black/70 px-5 py-2 backdrop-blur-sm" style={{ boxShadow: "0 0 20px rgba(0,0,0,0.5)" }}>
              <span className="font-cinzel text-2xl font-black text-[#c9a227]" style={{ textShadow: "0 0 12px rgba(201,162,39,0.6)" }}>{fightRemaining}</span>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center z-[2] pointer-events-none">
            <p className="font-cinzel text-[10px] tracking-[0.45em] text-[#c9a227]/70 uppercase mb-4">Tap to strike!</p>
            <span className="font-cinzel text-[120px] font-black leading-none text-[#c9a227]" style={{ textShadow: "0 0 60px rgba(201,162,39,0.5), 0 0 120px rgba(201,162,39,0.2)" }}>
              {taps}
            </span>
            <p className="font-cinzel text-sm tracking-[0.2em] text-[#f0e6c8]/60 uppercase mt-4">strikes</p>
          </div>
          <TapEffects taps={taps} />
        </div>
      )}

      {/* ── Fighting: Reaction Minigame ── */}
      {phase === "fighting" && minigame === "reaction" && (
        <ReactionGame onDone={handleReactionDone} videoRef={videoRef} />
      )}

      {/* ── Fighting: Rhythm Minigame ── */}
      {phase === "fighting" && minigame === "rhythm" && (
        <RhythmGame onDone={handleRhythmDone} videoRef={videoRef} />
      )}

      {/* ── Submitting / Resolving ── */}
      {(phase === "submitting" || phase === "resolving") && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(201,162,39,0.06),transparent_65%)]" />
          <div className="relative w-full max-w-sm text-center">
            <span className="mb-4 block text-6xl animate-pulse">⚔️</span>
            {minigame === "taps" && (
              <p className="mb-2 font-cinzel text-lg font-bold text-[#c9a227]">{tapsRef.current} strikes</p>
            )}
            {minigame === "reaction" && reactionTimes.length > 0 && (
              <p className="mb-2 font-cinzel text-lg font-bold text-[#c9a227]">
                Avg {Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)}ms
              </p>
            )}
            {minigame === "rhythm" && (
              <p className="mb-2 font-cinzel text-lg font-bold text-[#c9a227]">
                {rhythmScoreRef.current} / 800 pts
              </p>
            )}
            <div className="mx-auto mb-4 h-10 w-10 spinner-gold" />
            <p className="font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">The fates decide...</p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="relative w-full max-w-sm text-center">
            <p className="mb-2 font-cinzel text-sm text-[#5a4010] uppercase tracking-widest">The scroll is cursed</p>
            <p className="mb-6 font-crimson text-base text-[#e04444]">{error}</p>
            <button onClick={onDone} className="btn-gold w-full rounded-lg px-8 py-4 text-base">Return to Keep</button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {phase === "result" && !error && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6 py-8">
          <div className={`pointer-events-none fixed inset-0 ${iWon ? "bg-[radial-gradient(ellipse_at_50%_20%,rgba(201,162,39,0.1),transparent_65%)]" : "bg-[radial-gradient(ellipse_at_50%_20%,rgba(139,26,26,0.1),transparent_65%)]"}`} />
          <div className="relative w-full max-w-sm">
            {/* Victory / Defeat */}
            <div className={`mb-5 rounded-lg border p-8 text-center ${iWon ? "border-[#c9a227]/25 bg-[#100e08]" : "border-[#8b1a1a]/30 bg-[#100e08]"}`}
              style={{ boxShadow: iWon ? "0 0 32px rgba(201,162,39,0.1), inset 0 1px 0 rgba(201,162,39,0.06)" : "0 0 32px rgba(139,26,26,0.1), inset 0 1px 0 rgba(139,26,26,0.06)" }}>
              <div className="mb-3 text-6xl">{iWon ? "🏆" : "💀"}</div>
              <p className={`font-cinzel text-3xl font-black tracking-wider ${iWon ? "text-[#c9a227]" : "text-[#e04444]"}`}
                style={{ textShadow: iWon ? "0 0 32px rgba(201,162,39,0.5)" : "0 0 32px rgba(224,68,68,0.4)" }}>
                {iWon ? "Victory!" : "Defeated"}
              </p>
              {iWon ? <p className="mt-1 font-cinzel text-xs tracking-[0.3em] text-[#7a6845] uppercase">Glory be upon you</p>
                : <p className="mt-1 font-cinzel text-xs tracking-[0.3em] text-[#5a3030] uppercase">Your foe was worthy</p>}
            </div>

            {/* Tap results */}
            {minigame === "taps" && myTaps !== undefined && oppTaps !== undefined && (
              <div className="medieval-card mb-4 p-4">
                <p className="mb-3 text-center font-cinzel text-[10px] tracking-[0.3em] text-[#5a4010] uppercase">Strike Count</p>
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <p className="font-cinzel text-2xl font-black text-[#c9a227]">{myTaps}</p>
                    <p className="font-cinzel text-[10px] text-[#5a4010] uppercase">You</p>
                  </div>
                  <span className="font-cinzel text-sm text-[#3d2a10]">vs</span>
                  <div className="text-center">
                    <p className="font-cinzel text-2xl font-black text-[#f0e6c8]">{oppTaps}</p>
                    <p className="font-cinzel text-[10px] text-[#5a4010] uppercase">Foe</p>
                  </div>
                </div>
                {wonSpam && totalTaps > 0 && (
                  <p className="mt-2 text-center font-cinzel text-[10px] tracking-wider text-[#c9a227]">
                    +{Math.round(((myTaps! - oppTaps!) / totalTaps) * 20)}% favor from the gods
                  </p>
                )}
              </div>
            )}

            {/* Reaction results */}
            {minigame === "reaction" && myReactions && oppReactions && (
              <div className="medieval-card mb-4 p-4">
                <p className="mb-3 text-center font-cinzel text-[10px] tracking-[0.3em] text-[#5a4010] uppercase">Reaction Rounds</p>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => {
                    const myT = myReactions[i] ?? 999;
                    const opT = oppReactions[i] ?? 999;
                    const iWonRound = myT < opT;
                    const tied = myT === opT;
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="font-cinzel text-[10px] text-[#5a4010] uppercase">Round {i + 1}</span>
                        <div className="flex items-center gap-3">
                          <span className={`font-cinzel text-xs font-bold ${iWonRound ? "text-[#c9a227]" : "text-[#f0e6c8]/50"}`}>
                            {myT}ms
                          </span>
                          <span className="font-cinzel text-[10px] text-[#3d2a10]">vs</span>
                          <span className={`font-cinzel text-xs font-bold ${!iWonRound && !tied ? "text-[#c9a227]" : "text-[#f0e6c8]/50"}`}>
                            {opT}ms
                          </span>
                          <span className="w-4 text-center text-xs">
                            {tied ? "—" : iWonRound ? "✓" : "✗"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  let myWins = 0;
                  for (let i = 0; i < 3; i++) {
                    if ((myReactions[i] ?? 999) < (oppReactions[i] ?? 999)) myWins++;
                  }
                  let oppWins = 0;
                  for (let i = 0; i < 3; i++) {
                    if ((oppReactions[i] ?? 999) < (myReactions[i] ?? 999)) oppWins++;
                  }
                  const net = myWins - oppWins;
                  if (net > 0) return (
                    <p className="mt-2 text-center font-cinzel text-[10px] tracking-wider text-[#c9a227]">
                      +{net * 5}% favor from the gods
                    </p>
                  );
                  return null;
                })()}
              </div>
            )}

            {/* Rhythm results */}
            {minigame === "rhythm" && myRhythm !== undefined && oppRhythm !== undefined && (
              <div className="medieval-card mb-4 p-4">
                <p className="mb-3 text-center font-cinzel text-[10px] tracking-[0.3em] text-[#5a4010] uppercase">Rhythm Score</p>
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <p className="font-cinzel text-2xl font-black text-[#c9a227]">{myRhythm}</p>
                    <p className="font-cinzel text-[10px] text-[#5a4010] uppercase">You</p>
                  </div>
                  <span className="font-cinzel text-sm text-[#3d2a10]">vs</span>
                  <div className="text-center">
                    <p className="font-cinzel text-2xl font-black text-[#f0e6c8]">{oppRhythm}</p>
                    <p className="font-cinzel text-[10px] text-[#5a4010] uppercase">Foe</p>
                  </div>
                </div>
                <p className="mt-1 text-center font-crimson text-[10px] text-[#5a4010]">out of 800</p>
                {myRhythm > oppRhythm && (myRhythm + oppRhythm) > 0 && (
                  <p className="mt-2 text-center font-cinzel text-[10px] tracking-wider text-[#c9a227]">
                    +{Math.round(((myRhythm - oppRhythm) / (myRhythm + oppRhythm)) * 18)}% favor from the gods
                  </p>
                )}
              </div>
            )}

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
              <p className="mb-3 text-center font-cinzel text-[10px] tracking-[0.3em] text-[#5a4010] uppercase">Spoils of Battle</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Glory (XP)</span>
                  <span className={`font-cinzel text-sm font-bold ${(myXpDelta ?? 0) >= 0 ? "text-[#c9a227]" : "text-[#e04444]"}`}>
                    {(myXpDelta ?? 0) >= 0 ? "+" : ""}{myXpDelta}
                  </span>
                </div>
                {myNewLevel !== undefined && (
                  <><div className="h-px bg-[#1e1608]" /><div className="flex items-center justify-between">
                    <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Level</span>
                    <span className="font-cinzel text-sm font-bold text-[#f0e6c8]">{myNewLevel}</span>
                  </div></>
                )}
                {myNewRank && (
                  <><div className="h-px bg-[#1e1608]" /><div className="flex items-center justify-between">
                    <span className="font-cinzel text-xs tracking-wider text-[#5a4010] uppercase">Title</span>
                    <span className={`font-cinzel text-sm font-bold ${RANK_COLORS[myNewRank] ?? "text-[#f0e6c8]"}`}>{RANK_LABELS[myNewRank] ?? myNewRank}</span>
                  </div></>
                )}
              </div>
            </div>

            {/* Wager result */}
            {battle?.mode === "wager" && battle.wagerAmount && (
              <div className="mb-5 rounded-lg border border-[#c9a227]/30 bg-[#c9a227]/5 p-4 text-center">
                <p className="font-cinzel text-[10px] tracking-[0.3em] text-[#7a6845] uppercase">{iWon ? "Bounty Claimed" : "Bounty Lost"}</p>
                <p className={`mt-1 font-cinzel text-2xl font-black ${iWon ? "text-[#c9a227]" : "text-[#e04444]"}`}
                  style={{ textShadow: iWon ? "0 0 20px rgba(201,162,39,0.4)" : "none" }}>
                  {iWon ? "+" : "-"}{battle.wagerAmount} ETH
                </p>
                <p className="mt-1 font-crimson text-[10px] text-[#5a4010]">Settled via Dynamic escrow · Sepolia</p>
                {battle.payoutTx && (
                  <a href={`https://sepolia.etherscan.io/tx/${battle.payoutTx}`} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[9px] text-[#c9a227] underline">View on Etherscan →</a>
                )}
              </div>
            )}

            <button onClick={onDone} className="btn-gold w-full rounded-lg px-8 py-4 text-base">Return to Keep</button>
          </div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════
// Reaction Time Minigame Component
// ═══════════════════════════════════════════════

type RoundState = "waiting" | "ready" | "go" | "tapped" | "early";

function ReactionGame({ onDone, videoRef }: { onDone: (times: number[]) => void; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [round, setRound] = useState(0); // 0, 1, 2
  const [roundState, setRoundState] = useState<RoundState>("waiting");
  const [times, setTimes] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const goTimestamp = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start each round
  useEffect(() => {
    if (round >= 3) return;
    setRoundState("ready");
    setCurrentTime(null);

    // Random delay between 2-4 seconds
    const delay = 2000 + Math.random() * 2000;
    timerRef.current = setTimeout(() => {
      goTimestamp.current = Date.now();
      setRoundState("go");
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [round]);

  const handleTap = useCallback(() => {
    // Force video play
    if (videoRef.current?.paused) videoRef.current.play().catch(() => {});

    if (roundState === "ready") {
      // Tapped too early
      if (timerRef.current) clearTimeout(timerRef.current);
      setRoundState("early");
      setCurrentTime(999);
      const newTimes = [...times, 999];
      setTimes(newTimes);
      setTimeout(() => {
        if (round + 1 >= 3) onDone(newTimes);
        else setRound((r) => r + 1);
      }, 1500);
    } else if (roundState === "go") {
      const reactionMs = Date.now() - goTimestamp.current;
      setCurrentTime(reactionMs);
      setRoundState("tapped");
      const newTimes = [...times, reactionMs];
      setTimes(newTimes);
      setTimeout(() => {
        if (round + 1 >= 3) onDone(newTimes);
        else setRound((r) => r + 1);
      }, 1500);
    }
  }, [roundState, round, times, onDone, videoRef]);

  const bgColor = roundState === "ready"
    ? "bg-[#8b1a1a]/60"
    : roundState === "go"
      ? "bg-[#1a6b1a]/60"
      : roundState === "early"
        ? "bg-[#8b1a1a]/80"
        : "bg-black/50";

  return (
    <div
      className="fixed top-0 left-0 w-screen z-10 overflow-hidden select-none"
      style={{ height: "100dvh" }}
      onPointerDown={handleTap}
    >
      {/* Colored overlay */}
      <div className={`absolute inset-0 z-[1] transition-colors duration-200 ${bgColor}`} />

      {/* Round indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2] flex items-center gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-3 w-3 rounded-full border ${
            i < round
              ? (times[i] < 999 ? "border-[#c9a227] bg-[#c9a227]" : "border-[#e04444] bg-[#e04444]")
              : i === round
                ? "border-[#c9a227] bg-[#c9a227]/30"
                : "border-[#3d2a10] bg-transparent"
          }`} />
        ))}
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-[2] pointer-events-none">
        {roundState === "ready" && (
          <>
            <div className="mb-6 h-24 w-24 rounded-full border-4 border-[#8b1a1a] bg-[#8b1a1a]/30 flex items-center justify-center">
              <span className="text-4xl">🛑</span>
            </div>
            <p className="font-cinzel text-2xl font-black text-[#e04444] tracking-wider"
              style={{ textShadow: "0 0 30px rgba(224,68,68,0.5)" }}>
              WAIT...
            </p>
            <p className="mt-2 font-cinzel text-xs text-[#f0e6c8]/40 uppercase tracking-widest">
              Round {round + 1} of 3
            </p>
          </>
        )}

        {roundState === "go" && (
          <>
            <div className="mb-6 h-24 w-24 rounded-full border-4 border-[#2ecc71] bg-[#2ecc71]/30 flex items-center justify-center animate-pulse">
              <span className="text-4xl">⚡</span>
            </div>
            <p className="font-cinzel text-3xl font-black text-[#2ecc71] tracking-wider"
              style={{ textShadow: "0 0 40px rgba(46,204,113,0.6)" }}>
              TAP NOW!
            </p>
          </>
        )}

        {roundState === "tapped" && currentTime !== null && (
          <>
            <div className="mb-4 h-24 w-24 rounded-full border-4 border-[#c9a227] bg-[#c9a227]/20 flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>
            <p className="font-cinzel text-5xl font-black text-[#c9a227]"
              style={{ textShadow: "0 0 40px rgba(201,162,39,0.5)" }}>
              {currentTime}ms
            </p>
            <p className="mt-2 font-cinzel text-xs text-[#f0e6c8]/50 uppercase tracking-widest">
              {currentTime < 200 ? "Lightning fast!" : currentTime < 350 ? "Quick reflexes!" : "Keep trying!"}
            </p>
          </>
        )}

        {roundState === "early" && (
          <>
            <div className="mb-4 h-24 w-24 rounded-full border-4 border-[#e04444] bg-[#e04444]/20 flex items-center justify-center">
              <span className="text-4xl">✗</span>
            </div>
            <p className="font-cinzel text-2xl font-black text-[#e04444]"
              style={{ textShadow: "0 0 30px rgba(224,68,68,0.5)" }}>
              TOO EARLY!
            </p>
            <p className="mt-2 font-cinzel text-xs text-[#f0e6c8]/40 uppercase tracking-widest">
              999ms penalty
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Rhythm Minigame Component
// ═══════════════════════════════════════════════

const BEAT_COUNT = 8;
const BEAT_INTERVAL = 1250; // ms between beats
const RING_DURATION = 1000; // ms for ring to shrink to target

function RhythmGame({ onDone, videoRef }: { onDone: (score: number) => void; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [beatIndex, setBeatIndex] = useState(-1); // -1 = not started
  const [ringProgress, setRingProgress] = useState(0); // 0 to 1
  const [feedback, setFeedback] = useState<{ text: string; color: string; points: number } | null>(null);
  const [score, setScore] = useState(0);
  const [beatResults, setBeatResults] = useState<string[]>([]);
  const beatStartRef = useRef(0);
  const tappedRef = useRef(false);
  const scoreRef = useRef(0);
  const animFrameRef = useRef(0);
  const gameStartRef = useRef(0);
  const resultsRef = useRef<string[]>([]);

  // Start the game
  useEffect(() => {
    gameStartRef.current = Date.now() + 500; // small delay
    setBeatIndex(0);
  }, []);

  // Run each beat
  useEffect(() => {
    if (beatIndex < 0 || beatIndex >= BEAT_COUNT) return;
    tappedRef.current = false;
    setFeedback(null);

    // The beat target time
    const beatTime = gameStartRef.current + beatIndex * BEAT_INTERVAL;
    const ringStart = beatTime - RING_DURATION;
    beatStartRef.current = beatTime;

    // Animate ring
    const animate = () => {
      const now = Date.now();
      const progress = Math.min(1, (now - ringStart) / RING_DURATION);
      setRingProgress(progress);

      if (now < beatTime + 300) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Time expired for this beat
        if (!tappedRef.current) {
          // Missed
          setFeedback({ text: "MISS", color: "text-[#e04444]", points: 0 });
          resultsRef.current = [...resultsRef.current, "miss"];
          setBeatResults([...resultsRef.current]);
          setTimeout(() => {
            if (beatIndex + 1 >= BEAT_COUNT) {
              onDone(scoreRef.current);
            } else {
              setBeatIndex((b) => b + 1);
            }
          }, 400);
        }
      }
    };

    // Wait until ring should start
    const delay = Math.max(0, ringStart - Date.now());
    const timeout = setTimeout(() => {
      animFrameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [beatIndex, onDone]);

  const handleTap = useCallback(() => {
    if (videoRef.current?.paused) videoRef.current.play().catch(() => {});
    if (tappedRef.current || beatIndex < 0 || beatIndex >= BEAT_COUNT) return;
    tappedRef.current = true;

    const diff = Math.abs(Date.now() - beatStartRef.current);
    let points: number;
    let text: string;
    let color: string;
    let result: string;

    if (diff < 80) {
      points = 100; text = "PERFECT"; color = "text-[#c9a227]"; result = "perfect";
    } else if (diff < 150) {
      points = 70; text = "GOOD"; color = "text-[#2ecc71]"; result = "good";
    } else if (diff < 250) {
      points = 40; text = "OK"; color = "text-[#f39c12]"; result = "ok";
    } else {
      points = 0; text = "MISS"; color = "text-[#e04444]"; result = "miss";
    }

    scoreRef.current += points;
    setScore(scoreRef.current);
    setFeedback({ text, color, points });
    resultsRef.current = [...resultsRef.current, result];
    setBeatResults([...resultsRef.current]);

    setTimeout(() => {
      if (beatIndex + 1 >= BEAT_COUNT) {
        onDone(scoreRef.current);
      } else {
        setBeatIndex((b) => b + 1);
      }
    }, 400);
  }, [beatIndex, onDone, videoRef]);

  // Ring scale: starts large (2.5), shrinks to 1 (target size)
  const ringScale = 1 + (1 - ringProgress) * 1.5;
  const ringOpacity = ringProgress > 0.3 ? 1 : ringProgress / 0.3;

  return (
    <div
      className="fixed top-0 left-0 w-screen z-10 overflow-hidden select-none"
      style={{ height: "100dvh" }}
      onPointerDown={handleTap}
    >
      <div className="absolute inset-0 bg-black/50 z-[1]" />

      {/* Score */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2]">
        <div className="rounded-full border border-[#c9a227]/40 bg-black/70 px-5 py-2 backdrop-blur-sm" style={{ boxShadow: "0 0 20px rgba(0,0,0,0.5)" }}>
          <span className="font-cinzel text-xl font-black text-[#c9a227]" style={{ textShadow: "0 0 12px rgba(201,162,39,0.6)" }}>
            {score}
          </span>
          <span className="font-cinzel text-xs text-[#c9a227]/50 ml-1">/ 800</span>
        </div>
      </div>

      {/* Beat progress dots */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[2] flex gap-2 mt-2">
        {Array.from({ length: BEAT_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 w-2.5 rounded-full border ${
              i < beatResults.length
                ? beatResults[i] === "perfect"
                  ? "border-[#c9a227] bg-[#c9a227]"
                  : beatResults[i] === "good"
                    ? "border-[#2ecc71] bg-[#2ecc71]"
                    : beatResults[i] === "ok"
                      ? "border-[#f39c12] bg-[#f39c12]"
                      : "border-[#e04444] bg-[#e04444]"
                : i === beatIndex
                  ? "border-[#c9a227] bg-[#c9a227]/30"
                  : "border-[#3d2a10] bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Center target + ring */}
      <div className="absolute inset-0 flex items-center justify-center z-[2] pointer-events-none">
        <div className="relative flex items-center justify-center">
          {/* Target circle */}
          <div
            className="h-24 w-24 rounded-full border-[3px] border-[#c9a227]/60"
            style={{ boxShadow: "0 0 30px rgba(201,162,39,0.15), inset 0 0 20px rgba(201,162,39,0.1)" }}
          />

          {/* Shrinking ring */}
          {beatIndex >= 0 && beatIndex < BEAT_COUNT && !tappedRef.current && (
            <div
              className="absolute h-24 w-24 rounded-full border-4 border-[#c9a227]"
              style={{
                transform: `scale(${ringScale})`,
                opacity: ringOpacity,
                transition: "none",
                boxShadow: ringProgress > 0.85 ? "0 0 25px rgba(201,162,39,0.5)" : "none",
              }}
            />
          )}

          {/* Feedback text */}
          {feedback && (
            <div className="absolute flex flex-col items-center">
              <p className={`font-cinzel text-3xl font-black ${feedback.color}`}
                style={{ textShadow: "0 0 20px rgba(0,0,0,0.8)" }}>
                {feedback.text}
              </p>
              {feedback.points > 0 && (
                <p className="font-cinzel text-sm text-[#c9a227]/70">+{feedback.points}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom instruction */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[2]">
        <p className="font-cinzel text-[10px] tracking-[0.3em] text-[#f0e6c8]/40 uppercase">
          Tap when the ring hits the circle
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Tap Visual Effects
// ═══════════════════════════════════════════════

function TapEffects({ taps }: { taps: number }) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const prevTaps = useRef(0);

  useEffect(() => {
    if (taps > prevTaps.current) {
      const x = 30 + Math.random() * 40;
      const y = 30 + Math.random() * 40;
      const id = taps;
      setRipples((prev) => [...prev.slice(-8), { id, x, y }]);
      setTimeout(() => { setRipples((prev) => prev.filter((r) => r.id !== id)); }, 600);
    }
    prevTaps.current = taps;
  }, [taps]);

  return (
    <>
      {ripples.map((r) => (
        <div key={r.id} className="absolute z-20 pointer-events-none" style={{ left: `${r.x}%`, top: `${r.y}%`, transform: "translate(-50%, -50%)" }}>
          <div className="w-20 h-20 rounded-full border-2 border-[#c9a227] opacity-80" style={{ animation: "tap-ripple 0.6s ease-out forwards" }} />
        </div>
      ))}
      <style jsx>{`
        @keyframes tap-ripple {
          0% { transform: scale(0.3); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </>
  );
}

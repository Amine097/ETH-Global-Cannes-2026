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
  const [depositStatus, setDepositStatus] = useState<string | null>(null);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);
  const depositPollingRef = useRef(false);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolved = useRef(false);
  const tapsRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timersRef = useRef<{ fightStart: number; fightEnd: number }>({ fightStart: 0, fightEnd: 0 });

  // Fetch battle data, handle wager deposit or sync to server timestamps
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      // First fetch to get battle info
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

      // Free battle — poll for timestamps
      if (d.battle.fightStartAt && d.battle.fightEndAt) {
        timersRef.current = { fightStart: d.battle.fightStartAt, fightEnd: d.battle.fightEndAt };
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
            if (data2.battle.fightStartAt && data2.battle.fightEndAt) {
              timersRef.current = { fightStart: data2.battle.fightStartAt, fightEnd: data2.battle.fightEndAt };
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

  // ── Wager: send deposit ──
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
          // Re-poll for timestamps now that deposits are in
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
        if (data.battle) {
          setBattle(data.battle);
          if (data.battle.fightStartAt && data.battle.fightEndAt) {
            clearInterval(interval);
            timersRef.current = { fightStart: data.battle.fightStartAt, fightEnd: data.battle.fightEndAt };
            const now = data.serverTime ?? Date.now();
            const ms = data.battle.fightStartAt - now;
            if (ms <= 0) setPhase("fighting");
            else { setCountdown(Math.ceil(ms / 1000)); setPhase("countdown"); }
          }
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

  // Aggressively try to play the video
  useEffect(() => {
    const tryPlay = () => { if (videoRef.current?.paused) videoRef.current.play().catch(() => {}); };
    tryPlay();
    const t1 = setTimeout(tryPlay, 100);
    const t2 = setTimeout(tryPlay, 500);
    const t3 = setTimeout(tryPlay, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  // Fight timer synced to server fightEndAt
  useEffect(() => {
    if (phase !== "fighting") return;
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
  }, [phase]);

  // Submit taps then resolve
  useEffect(() => {
    if (phase !== "submitting") return;
    let cancelled = false;

    const submit = async () => {
      await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit-taps", battleId, role, taps: tapsRef.current }),
      });

      if (cancelled) return;

      if (role === "attacker") {
        for (let i = 0; i < 10; i++) {
          if (cancelled) return;
          const res = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll-status", battleId }),
          });
          const data = await res.json();
          if (data.battle?.defenderTaps !== undefined && data.battle?.defenderTaps !== null) {
            const resolveRes = await fetch("/api/battle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "resolve", battleId }),
            });
            const resolveData = await resolveRes.json();
            if (!cancelled && resolveData.battle) {
              // Trigger payout for wager battles
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
  }, [phase, battleId, role]);

  const handleTap = useCallback(() => {
    if (phase !== "fighting") return;
    if (videoRef.current?.paused) videoRef.current.play().catch(() => {});
    tapsRef.current += 1;
    setTaps(tapsRef.current);
  }, [phase]);

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

  return (
    <>
      {/* Persistent video — always in DOM, visible only during fight */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
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
            <h2 className="font-cinzel text-xl font-bold tracking-wider text-[#f0e6c8]">
              Deposit Your Wager
            </h2>
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

            {depositStatus && (
              <p className="mt-3 font-crimson text-xs text-[#7a6845]">{depositStatus}</p>
            )}

            <p className="mt-4 font-crimson text-[10px] text-[#3d2a10]">
              Powered by <span className="text-[#5a4010]">Dynamic</span> · Sepolia Testnet
            </p>
          </div>
        </div>
      )}

      {/* ── Waiting for both deposits ── */}
      {phase === "waiting-deposits" && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(201,162,39,0.06),transparent_65%)]" />
          <div className="relative w-full max-w-sm text-center">
            <div className="mx-auto mb-4 h-10 w-10 spinner-gold" />
            <h2 className="font-cinzel text-lg font-bold tracking-wider text-[#f0e6c8]">
              Wager Deposited
            </h2>
            <p className="mt-2 font-crimson text-sm text-[#7a6845]">
              Waiting for opponent to deposit their wager...
            </p>
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
            <p className="font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">
              Synchronizing battle...
            </p>
          </div>
        </div>
      )}

      {/* ── Countdown ── */}
      {phase === "countdown" && (
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

            <div className="mt-6 space-y-2 text-center">
              <p className="font-cinzel text-xs tracking-[0.3em] text-[#c9a227] uppercase">
                Tap the screen as fast as you can!
              </p>
              <p className="font-crimson text-sm text-[#7a6845]">
                Out-tap your foe to gain favor from the gods
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Fighting (Tap Spam) ── */}
      {phase === "fighting" && (
        <div
          className="fixed top-0 left-0 w-screen z-10 overflow-hidden select-none"
          style={{ height: "100dvh" }}
          onPointerDown={handleTap}
        >
          <div className="absolute inset-0 bg-black/40 z-[1]" />

          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2]">
            <div
              className="rounded-full border border-[#c9a227]/40 bg-black/70 px-5 py-2 backdrop-blur-sm"
              style={{ boxShadow: "0 0 20px rgba(0,0,0,0.5)" }}
            >
              <span
                className="font-cinzel text-2xl font-black text-[#c9a227]"
                style={{ textShadow: "0 0 12px rgba(201,162,39,0.6)" }}
              >
                {fightRemaining}
              </span>
            </div>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center z-[2] pointer-events-none">
            <p className="font-cinzel text-[10px] tracking-[0.45em] text-[#c9a227]/70 uppercase mb-4">
              Tap to strike!
            </p>
            <span
              className="font-cinzel text-[120px] font-black leading-none text-[#c9a227]"
              style={{
                textShadow: "0 0 60px rgba(201,162,39,0.5), 0 0 120px rgba(201,162,39,0.2)",
              }}
            >
              {taps}
            </span>
            <p className="font-cinzel text-sm tracking-[0.2em] text-[#f0e6c8]/60 uppercase mt-4">
              strikes
            </p>
          </div>

          <TapEffects taps={taps} />
        </div>
      )}

      {/* ── Submitting / Resolving ── */}
      {(phase === "submitting" || phase === "resolving") && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(201,162,39,0.06),transparent_65%)]" />
          <div className="relative w-full max-w-sm text-center">
            <span className="mb-4 block text-6xl animate-pulse">⚔️</span>
            <p className="mb-2 font-cinzel text-lg font-bold text-[#c9a227]">
              {tapsRef.current} strikes
            </p>
            <div className="mx-auto mb-4 h-10 w-10 spinner-gold" />
            <p className="font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">
              The fates decide...
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
          <div className="relative w-full max-w-sm text-center">
            <p className="mb-2 font-cinzel text-sm text-[#5a4010] uppercase tracking-widest">The scroll is cursed</p>
            <p className="mb-6 font-crimson text-base text-[#e04444]">{error}</p>
            <button onClick={onDone} className="btn-gold w-full rounded-lg px-8 py-4 text-base">
              Return to Keep
            </button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {phase === "result" && !error && (
        <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6 py-8">
          <div
            className={`pointer-events-none fixed inset-0 ${
              iWon
                ? "bg-[radial-gradient(ellipse_at_50%_20%,rgba(201,162,39,0.1),transparent_65%)]"
                : "bg-[radial-gradient(ellipse_at_50%_20%,rgba(139,26,26,0.1),transparent_65%)]"
            }`}
          />

          <div className="relative w-full max-w-sm">
            <div
              className={`mb-5 rounded-lg border p-8 text-center ${
                iWon ? "border-[#c9a227]/25 bg-[#100e08]" : "border-[#8b1a1a]/30 bg-[#100e08]"
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

            {/* Tap results */}
            {myTaps !== undefined && oppTaps !== undefined && (
              <div className="medieval-card mb-4 p-4">
                <p className="mb-3 text-center font-cinzel text-[10px] tracking-[0.3em] text-[#5a4010] uppercase">
                  Strike Count
                </p>
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

            {/* Wager result */}
            {battle?.mode === "wager" && battle.wagerAmount && (
              <div className="mb-5 rounded-lg border border-[#c9a227]/30 bg-[#c9a227]/5 p-4 text-center">
                <p className="font-cinzel text-[10px] tracking-[0.3em] text-[#7a6845] uppercase">
                  {iWon ? "Bounty Claimed" : "Bounty Lost"}
                </p>
                <p className={`mt-1 font-cinzel text-2xl font-black ${iWon ? "text-[#c9a227]" : "text-[#e04444]"}`}
                   style={{ textShadow: iWon ? "0 0 20px rgba(201,162,39,0.4)" : "none" }}>
                  {iWon ? "+" : "-"}{battle.wagerAmount} ETH
                </p>
                <p className="mt-1 font-crimson text-[10px] text-[#5a4010]">
                  Settled via Dynamic escrow · Sepolia
                </p>
                {battle.payoutTx && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${battle.payoutTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[9px] text-[#c9a227] underline"
                  >
                    View on Etherscan →
                  </a>
                )}
              </div>
            )}

            <button onClick={onDone} className="btn-gold w-full rounded-lg px-8 py-4 text-base">
              Return to Keep
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ── Visual tap feedback ──
function TapEffects({ taps }: { taps: number }) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const prevTaps = useRef(0);

  useEffect(() => {
    if (taps > prevTaps.current) {
      const x = 30 + Math.random() * 40;
      const y = 30 + Math.random() * 40;
      const id = taps;
      setRipples((prev) => [...prev.slice(-8), { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    }
    prevTaps.current = taps;
  }, [taps]);

  return (
    <>
      {ripples.map((r) => (
        <div
          key={r.id}
          className="absolute z-20 pointer-events-none"
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="w-20 h-20 rounded-full border-2 border-[#c9a227] opacity-80"
            style={{
              animation: "tap-ripple 0.6s ease-out forwards",
            }}
          />
        </div>
      ))}
      <style jsx>{`
        @keyframes tap-ripple {
          0% {
            transform: scale(0.3);
            opacity: 0.8;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BattleArena } from "./BattleArena";

type Step =
  | "mode-select"
  | "bet-select"
  | "idle"
  | "scanning-nfc"
  | "scanning-qr"
  | "initiating"
  | "waiting"
  | "arena"
  | "declined"
  | "error";

type BattleMode = "free" | "wager";

const BET_OPTIONS = ["0.001", "0.005", "0.01", "0.05"];

interface Props {
  playerPk: string;
  hasWallet: boolean;
  onConnectWallet: () => void;
  onBack: () => void;
}

export const BattleScanner = ({ playerPk, hasWallet, onConnectWallet, onBack }: Props) => {
  const [step, setStep] = useState<Step>("mode-select");
  const [battleMode, setBattleMode] = useState<BattleMode>("free");
  const [betAmount, setBetAmount] = useState<string>("0.01");
  const [error, setError] = useState<string | null>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const pollingRef = useRef(false);
  // Pre-load jsqr once so it's ready synchronously during scan frames
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsQrRef = useRef<((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null>(null);

  function stopCamera() {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function selectMode(mode: BattleMode) {
    setBattleMode(mode);
    if (mode === "wager") {
      if (!hasWallet) {
        onConnectWallet();
        return;
      }
      setStep("bet-select");
    } else {
      setStep("idle");
    }
  }

  function confirmBet() {
    setStep("idle");
  }

  // ── NFC scan ──
  async function startNfcScan() {
    setStep("scanning-nfc");
    setError(null);
    try {
      const { execHaloCmdWeb } = await import("@arx-research/libhalo/api/web");
      const res = await fetch("/api/halo/challenge", { method: "POST" });
      const { challenge } = await res.json();
      const halo = await execHaloCmdWeb({ name: "sign", keyNo: 1, digest: challenge });
      initiateBattle(halo.publicKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "NFC scan failed");
      setStep("error");
    }
  }

  // ── QR scan — just flip the step; useEffect handles camera after render ──
  function startQrScan() {
    setError(null);
    setStep("scanning-qr");
  }

  const scanFrame = useCallback(() => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) { requestAnimationFrame(scanFrame); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // jsQrRef is pre-loaded on mount — synchronous call, no async race
    const jsQr = jsQrRef.current;
    if (jsQr) {
      const code = jsQr(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        stopCamera();
        initiateBattle(code.data);
        return;
      }
    }
    if (scanningRef.current) requestAnimationFrame(scanFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initiate battle ──
  async function initiateBattle(defenderPk: string) {
    setStep("initiating");
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate",
          attackerPk: playerPk,
          defenderPk,
          mode: battleMode,
          wagerAmount: battleMode === "wager" ? betAmount : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start battle");
        setStep("error");
        return;
      }
      setBattleId(data.battle.id);
      setOpponentName(data.battle.defender.username);
      setStep("waiting");
      startPolling(data.battle.id);
    } catch {
      setError("Network error");
      setStep("error");
    }
  }

  // ── Poll for acceptance ──
  function startPolling(id: string) {
    pollingRef.current = true;
    let attempts = 0;
    const interval = setInterval(async () => {
      if (!pollingRef.current) { clearInterval(interval); return; }
      attempts++;
      if (attempts > 30) {
        pollingRef.current = false;
        clearInterval(interval);
        setError("Opponent did not respond to the challenge");
        setStep("error");
        return;
      }
      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll-status", battleId: id }),
        });
        const data = await res.json();
        if (!data.battle) return;
        if (data.battle.status === "accepted") {
          pollingRef.current = false;
          clearInterval(interval);
          setStep("arena");
        } else if (data.battle.status === "declined" || data.battle.status === "expired") {
          pollingRef.current = false;
          clearInterval(interval);
          setStep("declined");
        }
      } catch { /* retry */ }
    }, 2000);
  }

  // Pre-load jsqr on mount
  useEffect(() => {
    import("jsqr").then((m) => { jsQrRef.current = m.default; });
    return () => {
      stopCamera();
      pollingRef.current = false;
    };
  }, []);

  // Start camera AFTER "scanning-qr" renders the <video> element into the DOM
  useEffect(() => {
    if (step !== "scanning-qr") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanningRef.current = true;
        requestAnimationFrame(scanFrame);
      } catch {
        if (!cancelled) {
          setError("Camera access denied");
          setStep("error");
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Arena phase ──
  if (step === "arena" && battleId) {
    return (
      <BattleArena battleId={battleId} playerPk={playerPk} role="attacker" onDone={onBack} />
    );
  }

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.06),transparent_65%)]" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="font-cinzel text-2xl font-bold tracking-wider text-[#f0e6c8]">Seek Battle</h1>
          <p className="mt-1 font-crimson text-sm text-[#7a6845]">
            {step === "mode-select" ? "Choose your terms of engagement" :
             step === "bet-select" ? "Set your wager" :
             "Find a worthy foe and issue your challenge"}
          </p>
        </div>

        {/* Ornament */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-sm">⚔</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        {/* ── Mode Selection ── */}
        {step === "mode-select" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => selectMode("free")}
              className="btn-gold w-full rounded-lg px-8 py-4 text-base"
            >
              ⚔ Free Battle
            </button>
            <p className="text-center font-crimson text-xs text-[#5a4010]">Glory and XP only</p>

            <div className="my-1 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#2e2010]" />
              <span className="font-cinzel text-[10px] tracking-widest text-[#3d2a10] uppercase">or</span>
              <div className="h-px flex-1 bg-[#2e2010]" />
            </div>

            <button
              onClick={() => selectMode("wager")}
              className="w-full rounded-lg border border-[#c9a227]/40 bg-gradient-to-r from-[#1a1508] to-[#12100a] px-8 py-4 font-cinzel text-base font-bold tracking-wider text-[#c9a227] transition-all hover:border-[#c9a227]/70 hover:shadow-[0_0_20px_rgba(201,162,39,0.15)] active:opacity-80"
            >
              💰 Wager Battle
            </button>
            <p className="text-center font-crimson text-xs text-[#5a4010]">
              Stake crypto · Winner takes all
              <br />
              <span className="text-[#7a6845]">Powered by <span className="font-semibold text-[#c9a227]">Dynamic</span></span>
            </p>
          </div>
        )}

        {/* ── Bet Amount Selection ��─ */}
        {step === "bet-select" && (
          <div className="flex flex-col gap-4">
            <p className="text-center font-cinzel text-xs tracking-widest text-[#5a4010] uppercase">
              Choose your stake
            </p>
            <div className="grid grid-cols-2 gap-3">
              {BET_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBetAmount(amt)}
                  className={`rounded-lg border px-4 py-3 font-cinzel text-sm font-bold transition-all ${
                    betAmount === amt
                      ? "border-[#c9a227] bg-[#c9a227]/10 text-[#c9a227] shadow-[0_0_15px_rgba(201,162,39,0.2)]"
                      : "border-[#2e2010] bg-[#100e08] text-[#7a6845] hover:border-[#5a4010]"
                  }`}
                >
                  {amt} ETH
                </button>
              ))}
            </div>
            <button onClick={confirmBet} className="btn-gold mt-2 w-full rounded-lg px-8 py-4 text-base">
              Confirm Wager — {betAmount} ETH
            </button>
            <button
              onClick={() => setStep("mode-select")}
              className="w-full rounded-lg py-2 font-cinzel text-xs tracking-wider text-[#3d2a10] hover:text-[#5a4010] transition-colors"
            >
              ← Change mode
            </button>
          </div>
        )}

        {/* ── Scan Options ── */}
        {step === "idle" && (
          <div className="flex flex-col gap-4">
            {battleMode === "wager" && (
              <div className="mb-2 rounded-lg border border-[#c9a227]/30 bg-[#c9a227]/5 px-4 py-3 text-center">
                <p className="font-cinzel text-xs tracking-wider text-[#c9a227]">
                  💰 Wager: {betAmount} ETH
                </p>
                <p className="mt-1 font-crimson text-[10px] text-[#7a6845]">Powered by Dynamic</p>
              </div>
            )}
            <button onClick={startNfcScan} className="btn-gold w-full rounded-lg px-8 py-4 text-base">
              📿 Touch Their Bracelet
            </button>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#2e2010]" />
              <span className="font-cinzel text-[10px] tracking-widest text-[#3d2a10] uppercase">or</span>
              <div className="h-px flex-1 bg-[#2e2010]" />
            </div>
            <button onClick={startQrScan} className="btn-outline-gold w-full rounded-lg px-8 py-3 text-sm">
              📷 Scan Their Sigil (QR)
            </button>
          </div>
        )}

        {/* QR camera */}
        {step === "scanning-qr" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full overflow-hidden rounded-lg border border-[#2e2010]">
              <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
              <div className="absolute inset-0 rounded-lg border-2 border-[#c9a227]/20 pointer-events-none" />
              <div className="absolute inset-[25%] rounded-md border-2 border-[#c9a227]/70 pointer-events-none" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={() => { stopCamera(); setStep("idle"); }} className="font-cinzel text-xs tracking-wider text-[#5a4010] hover:text-[#7a6845] transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* NFC scanning */}
        {step === "scanning-nfc" && (
          <div className="medieval-card-glow p-8 text-center">
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#2e2010] border-t-[#c9a227]" />
              <span className="text-2xl">📿</span>
            </div>
            <p className="font-cinzel text-sm font-semibold text-[#c9a227]">Touch their bracelet</p>
            <p className="mt-2 font-crimson text-xs text-[#5a4010]">Hold your phone near their wrist</p>
          </div>
        )}

        {/* Initiating */}
        {step === "initiating" && (
          <div className="medieval-card p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 spinner-gold" />
            <p className="font-crimson text-sm text-[#7a6845]">Dispatching the herald...</p>
          </div>
        )}

        {/* Waiting for accept */}
        {step === "waiting" && (
          <div className="rounded-lg border border-[#c9a227]/20 bg-[#100e08] p-8 text-center">
            <div className="mb-4 text-4xl animate-pulse">⚔️</div>
            <p className="font-cinzel text-lg font-bold text-[#c9a227]">Challenge Sent!</p>
            <p className="mt-2 font-crimson text-sm text-[#7a6845]">
              Waiting for <span className="font-semibold text-[#f0e6c8]">{opponentName}</span> to accept...
            </p>
            {battleMode === "wager" && (
              <p className="mt-2 font-cinzel text-xs text-[#c9a227]">💰 Wager: {betAmount} ETH</p>
            )}
            <div className="mx-auto mt-4 h-6 w-6 spinner-gold" />
          </div>
        )}

        {/* Declined */}
        {step === "declined" && (
          <div className="flex flex-col gap-4">
            <div className="medieval-card p-8 text-center">
              <div className="mb-3 text-4xl">😞</div>
              <p className="font-cinzel text-lg font-semibold text-[#f0e6c8]">Challenge Refused</p>
              <p className="mt-1 font-crimson text-sm text-[#7a6845]">{opponentName} fled from battle</p>
            </div>
            <button onClick={() => setStep("mode-select")} className="btn-gold w-full rounded-lg px-8 py-4 text-base">
              Try again
            </button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 px-4 py-4 text-center">
              <p className="font-crimson text-sm text-[#e04444]">{error}</p>
            </div>
            <button onClick={() => { setError(null); setStep("mode-select"); }} className="btn-gold w-full rounded-lg px-8 py-4 text-base">
              Try again
            </button>
          </div>
        )}

        {/* Back */}
        {(step === "mode-select" || step === "idle" || step === "declined" || step === "error") && (
          <button onClick={() => { stopCamera(); pollingRef.current = false; onBack(); }} className="mt-4 w-full rounded-lg py-3 font-cinzel text-xs tracking-wider text-[#3d2a10] hover:text-[#5a4010] transition-colors">
            ← Back to profile
          </button>
        )}

        {step === "waiting" && (
          <button onClick={() => { pollingRef.current = false; setStep("mode-select"); }} className="mt-4 w-full rounded-lg py-3 font-cinzel text-xs tracking-wider text-[#3d2a10] hover:text-[#5a4010] transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

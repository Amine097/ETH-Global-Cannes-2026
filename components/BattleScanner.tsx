"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BattleArena } from "./BattleArena";

type Step = "idle" | "scanning-nfc" | "scanning-qr" | "initiating" | "waiting" | "arena" | "declined" | "error";

interface Props {
  playerPk: string;
  onBack: () => void;
}

export const BattleScanner = ({ playerPk, onBack }: Props) => {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const pollingRef = useRef(false);

  function stopCamera() {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // ── NFC scan (Android) ──
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

  // ── QR scan (iOS / fallback) ──
  const startQrScan = useCallback(async () => {
    setStep("scanning-qr");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      scanningRef.current = true;
      requestAnimationFrame(scanFrame);
    } catch {
      setError("Camera access denied");
      setStep("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanFrame = useCallback(() => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    import("jsqr").then((jsQR) => {
      const code = jsQR.default(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        stopCamera();
        initiateBattle(code.data);
      } else if (scanningRef.current) {
        requestAnimationFrame(scanFrame);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initiate battle ──
  async function initiateBattle(defenderPk: string) {
    setStep("initiating");
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initiate", attackerPk: playerPk, defenderPk }),
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
      if (attempts > 30) { // 60s timeout
        pollingRef.current = false;
        clearInterval(interval);
        setError("Opponent didn't respond");
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

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
      pollingRef.current = false;
    };
  }, []);

  // ── Arena phase ──
  if (step === "arena" && battleId) {
    return (
      <BattleArena
        battleId={battleId}
        playerPk={playerPk}
        role="attacker"
        onDone={onBack}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Battle</h1>
        <p className="mb-6 text-center text-sm text-[#888]">
          Scan your opponent&apos;s bracelet to challenge them
        </p>

        {/* Idle */}
        {step === "idle" && (
          <div className="flex flex-col gap-4">
            <button onClick={startNfcScan} className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black active:opacity-80">
              Scan bracelet (NFC)
            </button>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#1e1e1e]" />
              <span className="text-xs text-[#888]">or</span>
              <div className="h-px flex-1 bg-[#1e1e1e]" />
            </div>
            <button onClick={startQrScan} className="w-full rounded-2xl border border-[#1e1e1e] bg-[#111] px-8 py-3 text-sm text-[#888] active:opacity-80">
              Scan QR code instead
            </button>
          </div>
        )}

        {/* Camera scanning (QR fallback) */}
        {step === "scanning-qr" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e]">
              <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
              <div className="absolute inset-0 rounded-2xl border-2 border-[#22c55e]/30 pointer-events-none" />
              <div className="absolute inset-[25%] rounded-lg border-2 border-[#22c55e] pointer-events-none" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-sm text-[#888]">Point at your opponent&apos;s QR code</p>
            <button onClick={() => { stopCamera(); setStep("idle"); }} className="text-sm text-[#888] underline active:opacity-80">Cancel</button>
          </div>
        )}

        {/* NFC scanning */}
        {step === "scanning-nfc" && (
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
            <p className="font-medium text-white">Tap opponent&apos;s bracelet</p>
            <p className="mt-1 text-xs text-[#888]">Hold your phone near their wrist</p>
          </div>
        )}

        {/* Initiating */}
        {step === "initiating" && (
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
            <p className="text-sm text-[#888]">Looking up opponent...</p>
          </div>
        )}

        {/* Waiting for accept */}
        {step === "waiting" && (
          <div className="rounded-2xl border border-yellow-500/30 bg-[#111] p-8 text-center">
            <div className="mb-4 text-4xl animate-pulse">⚔️</div>
            <p className="text-lg font-bold text-yellow-400">Challenge sent!</p>
            <p className="mt-2 text-sm text-[#888]">
              Waiting for <span className="font-semibold text-white">{opponentName}</span> to accept...
            </p>
            <div className="mx-auto mt-4 h-6 w-6 animate-spin rounded-full border-2 border-[#888] border-t-yellow-400" />
          </div>
        )}

        {/* Declined */}
        {step === "declined" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
              <div className="mb-3 text-4xl">😞</div>
              <p className="text-lg font-semibold text-white">Battle declined</p>
              <p className="mt-1 text-sm text-[#888]">{opponentName} didn&apos;t accept the challenge</p>
            </div>
            <button onClick={() => { setStep("idle"); setError(null); }} className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black">
              Try again
            </button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button onClick={() => { setError(null); setStep("idle"); }} className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black">
              Try again
            </button>
          </div>
        )}

        {/* Back */}
        {(step === "idle" || step === "declined" || step === "error") && (
          <button onClick={() => { stopCamera(); pollingRef.current = false; onBack(); }} className="mt-4 w-full rounded-xl py-3 text-sm text-[#888] hover:text-white">
            Back to profile
          </button>
        )}

        {step === "waiting" && (
          <button onClick={() => { pollingRef.current = false; setStep("idle"); }} className="mt-4 w-full rounded-xl py-3 text-sm text-[#888] hover:text-white">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

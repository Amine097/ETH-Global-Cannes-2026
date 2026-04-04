"use client";

import { useState, useEffect, useRef } from "react";

type Step = "loading" | "ready" | "scanning" | "processing" | "error";

interface ScanResult {
  challenge: string;
  signature: string;
  publicKey: string;
  etherAddress: string;
}

interface Props {
  mode: "login" | "signup";
  onResult: (data: ScanResult) => void;
  onBack: () => void;
}

export const BraceletScan = ({ mode, onResult, onBack }: Props) => {
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const challengeRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/halo/challenge", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        challengeRef.current = data.challenge;
        setStep("ready");
      })
      .catch(() => {
        setError("Failed to prepare scanner");
        setStep("error");
      });
  }, []);

  async function handleScan() {
    const challenge = challengeRef.current;
    if (!challenge) return;
    setError(null);
    setStep("scanning");
    try {
      const { execHaloCmdWeb } = await import("@arx-research/libhalo/api/web");
      const halo = await execHaloCmdWeb({ name: "sign", keyNo: 1, digest: challenge });
      setStep("processing");
      onResult({
        challenge,
        signature: halo.signature.ether,
        publicKey: halo.publicKey,
        etherAddress: halo.etherAddress,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setStep("error");
      fetch("/api/halo/challenge", { method: "POST" })
        .then((res) => res.json())
        .then((data) => { challengeRef.current = data.challenge; });
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.06),transparent_65%)]" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 text-4xl">{isLogin ? "🔑" : "📿"}</div>
          <h1 className="font-cinzel text-2xl font-bold tracking-wider text-[#f0e6c8]">
            {isLogin ? "Reclaim Your Seal" : "Bind Your Sigil"}
          </h1>
          <p className="mt-2 font-crimson text-sm text-[#7a6845]">
            {isLogin
              ? "Touch your enchanted bracelet to enter"
              : "Touch your bracelet to forge your identity"}
          </p>
        </div>

        {/* Ornament */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        {step === "loading" && (
          <div className="medieval-card p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 spinner-gold" />
            <p className="font-crimson text-sm text-[#7a6845]">Enchanting the scanner...</p>
          </div>
        )}

        {step === "ready" && (
          <div className="flex flex-col items-center gap-5">
            {/* Pulsing NFC ring */}
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(201,162,39,0.06)]" />
              <div className="absolute inset-2 animate-pulse rounded-full bg-[rgba(201,162,39,0.04)]" />
              <span className="relative text-5xl">📿</span>
            </div>
            <button
              onClick={handleScan}
              className="btn-gold w-full rounded-lg px-8 py-4 text-base"
            >
              Touch Your Bracelet
            </button>
            <p className="font-crimson text-center text-xs text-[#5a4010]">
              Hold the bracelet near the back of your phone when prompted
            </p>
          </div>
        )}

        {step === "scanning" && (
          <div className="medieval-card-glow p-8 text-center">
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#2e2010] border-t-[#c9a227]" />
              <span className="text-2xl">📿</span>
            </div>
            <p className="font-cinzel text-sm font-semibold text-[#c9a227]">Tap your bracelet now</p>
            <p className="mt-2 font-crimson text-xs text-[#5a4010]">Hold it near the back of your phone</p>
          </div>
        )}

        {step === "processing" && (
          <div className="medieval-card p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 spinner-gold" />
            <p className="font-crimson text-sm text-[#7a6845]">Reading the runes...</p>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 p-5 text-center">
              <p className="font-crimson text-sm text-[#e04444]">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setStep("ready"); }}
              className="btn-gold w-full rounded-lg px-8 py-4 text-base"
            >
              Try Again
            </button>
          </div>
        )}

        <button
          onClick={onBack}
          className="mt-6 w-full rounded-lg py-3 font-cinzel text-xs tracking-wider text-[#5a4010] hover:text-[#7a6845] transition-colors"
        >
          ← Retreat
        </button>
      </div>
    </div>
  );
};

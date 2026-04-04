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
      const halo = await execHaloCmdWeb(
        { name: "sign", keyNo: 1, digest: challenge },
      );

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">
          {mode === "login" ? "Log in" : "Sign up"}
        </h1>
        <p className="mb-8 text-center text-sm text-[#888]">
          Scan your bracelet to {mode === "login" ? "log in" : "create your account"}
        </p>

        {step === "loading" && (
          <Card><Spinner /><p className="text-sm text-[#888]">Preparing scanner...</p></Card>
        )}

        {step === "ready" && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleScan}
              className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black active:opacity-80"
            >
              Scan bracelet
            </button>
            <p className="text-center text-xs text-[#888]">
              Hold your bracelet near your phone when prompted
            </p>
          </div>
        )}

        {step === "scanning" && (
          <Card>
            <Spinner />
            <p className="font-medium text-white">Tap your bracelet now</p>
            <p className="mt-1 text-xs text-[#888]">Hold it near the back of your phone</p>
          </Card>
        )}

        {step === "processing" && (
          <Card><Spinner /><p className="text-sm text-[#888]">Processing...</p></Card>
        )}

        {step === "error" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setStep("ready"); }}
              className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black"
            >
              Try again
            </button>
          </div>
        )}

        <button
          onClick={onBack}
          className="mt-6 w-full rounded-xl py-3 text-sm text-[#888] hover:text-white"
        >
          Back
        </button>
      </div>
    </div>
  );
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">{children}</div>;
}

function Spinner() {
  return <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />;
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

type Step = "loading" | "ready" | "scanning" | "processing" | "done" | "not-found" | "error";

interface ResultData {
  publicKey: string;
  etherAddress: string;
  username?: string;
  isNew?: boolean;
}

export default function ScanPage() {
  const params = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "login";

  const [step, setStep] = useState<Step>("loading");
  const [result, setResult] = useState<ResultData | null>(null);
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

      if (mode === "login") {
        const checkRes = await fetch(`/api/players/check?pk=${encodeURIComponent(halo.publicKey)}`);
        const checkData = await checkRes.json();

        if (checkData.registered) {
          // Save session for World App to pick up
          localStorage.setItem("player", JSON.stringify({
            publicKey: checkData.player.publicKey,
            etherAddress: checkData.player.etherAddress,
            username: checkData.player.username,
          }));
          setResult({
            publicKey: checkData.player.publicKey,
            etherAddress: checkData.player.etherAddress,
            username: checkData.player.username,
          });
          setStep("done");
        } else {
          setStep("not-found");
        }
      } else {
        const regRes = await fetch("/api/players/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challenge,
            signature: halo.signature.ether,
            publicKey: halo.publicKey,
            etherAddress: halo.etherAddress,
          }),
        });
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error(regData.error ?? "Registration failed");

        // Save for World App — no username yet
        localStorage.setItem("player", JSON.stringify({
          publicKey: regData.player.publicKey,
          etherAddress: regData.player.etherAddress,
        }));
        setResult({
          publicKey: regData.player.publicKey,
          etherAddress: regData.player.etherAddress,
          isNew: true,
        });
        setStep("done");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
      setStep("error");
      fetch("/api/halo/challenge", { method: "POST" })
        .then((res) => res.json())
        .then((data) => { challengeRef.current = data.challenge; });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Raid Battle</h1>
        <p className="mb-8 text-center text-sm text-[#888]">
          {mode === "login" ? "Scan to log in" : "Scan to sign up"}
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
          <Card>
            <Spinner />
            <p className="text-sm text-[#888]">
              {mode === "login" ? "Checking identity..." : "Registering player..."}
            </p>
          </Card>
        )}

        {step === "done" && result && (
          <DoneScreen result={result} />
        )}

        {step === "not-found" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-yellow-500/30 bg-[#111] p-6 text-center">
              <div className="mb-3 text-4xl">&#x1F6AB;</div>
              <p className="text-lg font-bold text-yellow-400">Not registered</p>
              <p className="mt-2 text-sm text-[#888]">This bracelet hasn&apos;t been linked yet.</p>
            </div>
            <button
              onClick={() => {
                window.location.href = window.location.origin + "/scan?mode=signup";
              }}
              className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black"
            >
              Sign up instead
            </button>
          </div>
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
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">{children}</div>;
}

function Spinner() {
  return <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />;
}

const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? "app_477f27affac447ade4a6036e4f30620a";

function DoneScreen({ result }: { result: ResultData }) {
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    // Try multiple redirect methods in sequence
    const worldOrgLink = `https://world.org/mini-app?app_id=${APP_ID}`;
    const worldcoinLink = `https://worldcoin.org/mini-app?app_id=${APP_ID}`;

    // Method 1: universal link (works if app is published)
    window.location.href = worldOrgLink;

    // Method 2: after 1.5s try worldcoin.org variant
    const t1 = setTimeout(() => {
      window.location.href = worldcoinLink;
    }, 1500);

    // Method 3: after 3s, show manual instructions
    const t2 = setTimeout(() => {
      setShowManual(true);
    }, 3000);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[#22c55e]/30 bg-[#111] p-6 text-center">
        <div className="mb-3 text-4xl">&#x2713;</div>
        <p className="text-lg font-bold text-[#22c55e]">
          {result.isNew ? "Bracelet linked!" : `Welcome back${result.username ? `, ${result.username}` : ""}!`}
        </p>
        <p className="mt-2 font-mono text-xs text-[#888]">
          {result.etherAddress.slice(0, 10)}...{result.etherAddress.slice(-6)}
        </p>
      </div>

      {!showManual && (
        <Card>
          <Spinner />
          <p className="text-sm text-white">Opening World App...</p>
        </Card>
      )}

      {showManual && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-[#1e1e1e] p-4 text-center">
            <p className="text-sm text-[#ccc]">
              Open <strong className="text-white">World App</strong> and go to your Mini App
            </p>
            {result.isNew && (
              <p className="mt-1 text-xs text-[#888]">You&apos;ll choose your username there</p>
            )}
          </div>

          <a
            href={`https://world.org/mini-app?app_id=${APP_ID}`}
            className="block w-full rounded-2xl bg-white px-8 py-4 text-center text-lg font-bold text-black active:opacity-80"
          >
            Open World App
          </a>
        </div>
      )}
    </div>
  );
}

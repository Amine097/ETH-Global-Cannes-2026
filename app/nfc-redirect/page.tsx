"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type State = "verifying" | "redirecting" | "fallback" | "error" | "already-bound";

export default function NfcRedirectPage() {
  const params = useSearchParams();
  const [state, setState] = useState<State>("verifying");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pk1 = params.get("pk1");
    const rnd = params.get("rnd");
    const rndsig = params.get("rndsig");

    if (!pk1 || !rnd || !rndsig) {
      setError("Missing bracelet data in URL");
      setState("error");
      return;
    }

    fetch("/api/bind-nfc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pk1, rnd, rndsig }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (data.alreadyBound) {
          setState("already-bound");
          return;
        }
        if (!res.ok) {
          setError(data.error ?? "Verification failed");
          setState("error");
          return;
        }

        setCode(data.code);
        setState("redirecting");

        // Try deep link back to World App
        const appId = process.env.NEXT_PUBLIC_APP_ID;
        if (appId) {
          const deepLink = `https://world.org/mini-app?app_id=${appId}&path=${encodeURIComponent(`/?code=${data.code}`)}`;

          // Try universal link first
          window.location.href = deepLink;

          // If still on this page after 2s, show fallback
          setTimeout(() => setState("fallback"), 2000);
        } else {
          setState("fallback");
        }
      })
      .catch(() => {
        setError("Network error");
        setState("error");
      });
  }, [params]);

  const appId = process.env.NEXT_PUBLIC_APP_ID;
  const worldAppLink = code && appId
    ? `https://world.org/mini-app?app_id=${appId}&path=${encodeURIComponent(`/?code=${code}`)}`
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Raid Battle</h1>
        <p className="mb-8 text-center text-sm text-[#888]">Bracelet NFC</p>

        {state === "verifying" && (
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
            <p className="text-sm text-[#888]">Verifying bracelet...</p>
          </div>
        )}

        {state === "redirecting" && (
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
            <p className="text-sm text-white">Opening World App...</p>
          </div>
        )}

        {state === "fallback" && code && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#22c55e]/30 bg-[#111] p-8 text-center">
              <div className="mb-4 text-4xl">&#x2713;</div>
              <p className="mb-6 text-sm text-[#888]">Bracelet verified</p>
              <p className="mb-2 text-sm text-[#888]">Your code</p>
              <p className="mb-6 font-mono text-4xl font-bold tracking-[0.3em] text-[#22c55e]">
                {code}
              </p>
            </div>

            {worldAppLink && (
              <a
                href={worldAppLink}
                className="block w-full rounded-2xl bg-white px-8 py-4 text-center text-lg font-bold text-black"
              >
                Open in World App
              </a>
            )}

            <div className="rounded-xl bg-[#1e1e1e] p-4 text-center">
              <p className="text-sm text-[#888]">
                Or enter the code manually in the app
              </p>
            </div>

            <p className="text-center text-xs text-[#888]">Expires in 5 minutes</p>
          </div>
        )}

        {state === "already-bound" && (
          <div className="rounded-2xl border border-yellow-500/30 bg-[#111] p-8 text-center">
            <div className="mb-4 text-4xl">&#9888;</div>
            <p className="font-semibold text-yellow-400">Bracelet already linked</p>
            <p className="mt-2 text-sm text-[#888]">This bracelet is already bound to a player.</p>
            {worldAppLink && (
              <a href={worldAppLink} className="mt-4 inline-block text-sm text-white underline">
                Back to World App
              </a>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="rounded-2xl border border-red-500/30 bg-[#111] p-8 text-center">
            <div className="mb-4 text-4xl">&#x2717;</div>
            <p className="font-semibold text-red-400">Error</p>
            <p className="mt-2 text-sm text-[#888]">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type State = "loading" | "success" | "error" | "already-bound";

export default function BindNfcPage() {
  const params = useSearchParams();
  const [state, setState] = useState<State>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const pk1 = params.get("pk1");
    const rnd = params.get("rnd");
    const rndsig = params.get("rndsig");

    if (!pk1 || !rnd || !rndsig) {
      setErrorMsg("Missing bracelet data in URL");
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
        } else if (!res.ok) {
          setErrorMsg(data.error ?? "Verification failed");
          setState("error");
        } else {
          setCode(data.code);
          setAddress(data.etherAddress);
          setState("success");
        }
      })
      .catch(() => {
        setErrorMsg("Network error");
        setState("error");
      });
  }, [params]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Raid Battle</h1>
        <p className="mb-8 text-center text-sm text-[#888]">Bracelet NFC</p>

        {state === "loading" && (
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
            <p className="text-sm text-[#888]">Verifying bracelet...</p>
          </div>
        )}

        {state === "success" && code && (
          <div className="rounded-2xl border border-[#22c55e]/30 bg-[#111] p-8 text-center">
            <div className="mb-4 text-4xl">&#x2713;</div>
            <p className="mb-1 text-sm text-[#888]">Bracelet verified</p>
            {address && (
              <p className="mb-6 font-mono text-xs text-[#888]">
                {address.slice(0, 8)}...{address.slice(-6)}
              </p>
            )}
            <p className="mb-2 text-sm text-[#888]">Your binding code</p>
            <p className="mb-6 font-mono text-4xl font-bold tracking-[0.3em] text-[#22c55e]">
              {code}
            </p>
            <div className="rounded-xl bg-[#1e1e1e] p-4">
              <p className="text-sm text-[#888]">
                Go back to <strong className="text-white">World App</strong> and enter this code to link your bracelet.
              </p>
            </div>
            <p className="mt-4 text-xs text-[#888]">Code expires in 5 minutes</p>
          </div>
        )}

        {state === "already-bound" && (
          <div className="rounded-2xl border border-yellow-500/30 bg-[#111] p-8 text-center">
            <div className="mb-4 text-4xl">&#9888;</div>
            <p className="font-semibold text-yellow-400">Bracelet already linked</p>
            <p className="mt-2 text-sm text-[#888]">This bracelet is already bound to a player.</p>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-2xl border border-red-500/30 bg-[#111] p-8 text-center">
            <div className="mb-4 text-4xl">&#x2717;</div>
            <p className="font-semibold text-red-400">Verification failed</p>
            <p className="mt-2 text-sm text-[#888]">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit";
import type { IDKitResult, IDKitErrorCodes } from "@worldcoin/idkit";

const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? "app_477f27affac447ade4a6036e4f30620a";
const ACTION = "proposal-012";

interface Props {
  onVerified: () => void;
  onBack: () => void;
}

export const WorldVerify = ({ onVerified, onBack }: Props) => {
  const [rpContext, setRpContext] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchRpContext = useCallback(() => {
    setLoadingCtx(true);
    setError(null);
    fetch("/api/rp-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: ACTION }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to get rp_context");
        const data = await res.json();
        setRpContext(data.rp_context);
      })
      .catch((err) => {
        console.error("rp_context error:", err);
        setError("Failed to initialize World ID");
      })
      .finally(() => setLoadingCtx(false));
  }, []);

  useEffect(() => {
    fetchRpContext();
  }, [fetchRpContext]);

  async function handleVerify(result: IDKitResult) {
    setVerifying(true);
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Backend verification failed");
    }
  }

  function handleSuccess() {
    setVerifying(false);
    localStorage.setItem("world_verified", "true");
    onVerified();
  }

  function handleError(errorCode: IDKitErrorCodes) {
    console.error("IDKit error:", errorCode);
    setVerifying(false);
    setWidgetOpen(false);

    if (errorCode === "connection_failed" || errorCode === "timeout") {
      setError("Connection to World App failed. Make sure World App is installed and try again.");
    } else if (errorCode === "user_rejected") {
      setError("Verification was rejected in World App.");
    } else if (errorCode === "cancelled") {
      // Refresh rp_context for next attempt
      setError(null);
      fetchRpContext();
    } else if (errorCode === "verification_rejected") {
      setError("Verification rejected. You may have already verified with this action.");
    } else {
      setError(`Verification failed (${errorCode}). Please try again.`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Verify Identity</h1>
        <p className="mb-8 text-center text-sm text-[#888]">
          Prove you are a unique human with World ID
        </p>

        {loadingCtx && (
          <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
            <p className="text-sm text-[#888]">Loading World ID...</p>
          </div>
        )}

        {!loadingCtx && !rpContext && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
              <p className="text-sm text-[#888]">World ID unavailable</p>
            </div>
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
            <button
              onClick={fetchRpContext}
              className="w-full rounded-2xl border border-[#333] bg-transparent px-6 py-3 text-sm text-white active:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {!loadingCtx && rpContext && (
          <>
            {verifying ? (
              <div className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-8 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#888] border-t-white" />
                <p className="text-sm text-[#888]">Verifying proof...</p>
              </div>
            ) : (
              <button
                onClick={() => { setError(null); setWidgetOpen(true); }}
                className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black transition-opacity active:opacity-80"
              >
                Verify with World ID
              </button>
            )}

            <IDKitRequestWidget
              app_id={APP_ID as `app_${string}`}
              action={ACTION}
              rp_context={rpContext}
              preset={orbLegacy({})}
              allow_legacy_proofs={true}
              open={widgetOpen}
              onOpenChange={setWidgetOpen}
              handleVerify={handleVerify}
              onSuccess={handleSuccess}
              onError={handleError}
              autoClose={true}
            />
          </>
        )}

        {error && !loadingCtx && rpContext && (
          <p className="mt-3 text-center text-xs text-red-400">{error}</p>
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

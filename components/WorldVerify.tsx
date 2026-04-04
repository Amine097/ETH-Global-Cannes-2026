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
      setError("Connection to World App failed. Ensure World App is installed and try again.");
    } else if (errorCode === "user_rejected") {
      setError("Verification was rejected in World App.");
    } else if (errorCode === "cancelled") {
      setError(null);
      fetchRpContext();
    } else if (errorCode === "verification_rejected") {
      setError("Verification rejected. You may have already verified with this action.");
    } else {
      setError(`Verification failed (${errorCode}). Please try again.`);
    }
  }

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.06),transparent_65%)]" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <span className="text-4xl">🌐</span>
          </div>
          <h1 className="font-cinzel text-2xl font-bold tracking-wider text-[#f0e6c8]">
            Prove Your Lineage
          </h1>
          <p className="mt-2 font-crimson text-sm text-[#7a6845]">
            Only true humans may enter the realm
          </p>
        </div>

        {/* Ornament */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        {loadingCtx && (
          <div className="medieval-card p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 spinner-gold" />
            <p className="font-crimson text-sm text-[#7a6845]">Consulting the oracle...</p>
          </div>
        )}

        {!loadingCtx && !rpContext && (
          <div className="flex flex-col gap-3">
            <div className="medieval-card p-8 text-center">
              <p className="font-crimson text-sm text-[#7a6845]">The oracle is unreachable</p>
            </div>
            {error && (
              <div className="rounded-lg border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 px-4 py-3 text-center">
                <p className="font-crimson text-sm text-[#e04444]">{error}</p>
              </div>
            )}
            <button onClick={fetchRpContext} className="btn-outline-gold w-full rounded-lg px-6 py-3 text-sm">
              Try Again
            </button>
          </div>
        )}

        {!loadingCtx && rpContext && (
          <>
            {verifying ? (
              <div className="medieval-card p-8 text-center">
                <div className="mx-auto mb-4 h-8 w-8 spinner-gold" />
                <p className="font-crimson text-sm text-[#7a6845]">Verifying your bloodline...</p>
              </div>
            ) : (
              <button
                onClick={() => { setError(null); setWidgetOpen(true); }}
                className="btn-gold w-full rounded-lg px-8 py-4 text-base"
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
          <div className="mt-3 rounded-lg border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 px-4 py-3 text-center">
            <p className="font-crimson text-sm text-[#e04444]">{error}</p>
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

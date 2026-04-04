"use client";

import { useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

interface Props {
  playerPk: string;
  onConnected: (address: string) => void;
  onBack: () => void;
}

export const WalletConnect = ({ playerPk, onConnected, onBack }: Props) => {
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (primaryWallet?.address) {
      // Already connected — save it
      await saveWallet(primaryWallet.address);
    } else {
      // Open Dynamic auth/connect flow
      setShowAuthFlow?.(true);
    }
  }

  async function saveWallet(address: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/players/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: playerPk, walletAddress: address }),
      });
      if (!res.ok) throw new Error("Failed to save wallet");
      onConnected(address.toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  // If wallet just connected via Dynamic, save it
  if (primaryWallet?.address && !saving) {
    saveWallet(primaryWallet.address);
  }

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.06),transparent_65%)]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 text-4xl">💰</div>
          <h1 className="font-cinzel text-2xl font-bold tracking-wider text-[#f0e6c8]">
            Connect Wallet
          </h1>
          <p className="mt-2 font-crimson text-sm text-[#7a6845]">
            Link a wallet to place wagers on battles
          </p>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        {saving ? (
          <div className="medieval-card p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 spinner-gold" />
            <p className="font-crimson text-sm text-[#7a6845]">Linking your wallet...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleConnect}
              className="btn-gold w-full rounded-lg px-8 py-4 text-base"
            >
              Connect with Dynamic
            </button>
            <p className="text-center font-crimson text-xs text-[#5a4010]">
              Powered by <span className="font-semibold text-[#c9a227]">Dynamic</span> — secure wallet infrastructure
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 px-4 py-3 text-center">
            <p className="font-crimson text-sm text-[#e04444]">{error}</p>
          </div>
        )}

        <button
          onClick={onBack}
          className="mt-6 w-full rounded-lg py-3 font-cinzel text-xs tracking-wider text-[#3d2a10] hover:text-[#5a4010] transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

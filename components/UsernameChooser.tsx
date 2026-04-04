"use client";

import { useState } from "react";

interface Props {
  publicKey: string;
  etherAddress: string;
  challenge: string;
  signature: string;
  onDone: (username: string) => void;
}

export const UsernameChooser = ({ publicKey, etherAddress, challenge, signature, onDone }: Props) => {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (username.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/players/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge,
          signature,
          publicKey,
          etherAddress,
          username: username.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onDone(username.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.06),transparent_65%)]" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 text-4xl">📜</div>
          <h1 className="font-cinzel text-2xl font-bold tracking-wider text-[#f0e6c8]">
            Proclaim Your War Name
          </h1>
          <p className="mt-2 font-crimson text-sm text-[#7a6845]">
            This name shall be forever etched upon the realm
          </p>
        </div>

        {/* Ornament */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        <div className="flex flex-col gap-4">
          {/* Input */}
          <div className="relative">
            <input
              type="text"
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              placeholder="your-war-name"
              className="w-full rounded-lg border border-[#2e2010] bg-[#100e08] px-5 py-4 pr-14 font-crimson text-lg text-[#f0e6c8] placeholder:text-[#3d2a10] focus:border-[#c9a227] focus:outline-none transition-colors"
              style={{ boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)" }}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 font-cinzel text-xs text-[#5a4010]">
              .eth
            </span>
          </div>

          {/* Preview */}
          {username.trim().length >= 2 && (
            <div className="medieval-card px-4 py-3 text-center">
              <p className="font-cinzel text-xs tracking-widest text-[#5a4010] uppercase mb-1">Your ENS identity</p>
              <p className="font-crimson text-base text-[#c9a227]">
                {username.toLowerCase()}.raidbattle.eth
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={username.trim().length < 2 || loading}
            className="btn-gold w-full rounded-lg px-8 py-4 text-base disabled:opacity-30"
          >
            {loading ? "Forging your destiny..." : "Seal Your Name"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[#8b1a1a]/40 bg-[#8b1a1a]/10 p-4 text-center">
            <p className="font-crimson text-sm text-[#e04444]">{error}</p>
          </div>
        )}

        <p className="mt-6 text-center font-crimson text-xs text-[#3d2a10]">
          Letters, numbers, _ and - only · 2–20 characters
        </p>
      </div>
    </div>
  );
};

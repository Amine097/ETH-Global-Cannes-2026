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
      // Register + set username in one call
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
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold">Choose your name</h1>
        <p className="mb-8 text-center text-sm text-[#888]">
          This will be your identity in Raid Battle
        </p>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              placeholder="your-name"
              className="w-full rounded-2xl border border-[#1e1e1e] bg-[#111] px-5 py-4 pr-16 text-lg text-white placeholder:text-[#333] focus:border-[#22c55e] focus:outline-none"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-[#888]">
              .eth
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={username.trim().length < 2 || loading}
            className="w-full rounded-2xl bg-[#22c55e] px-8 py-4 text-lg font-bold text-black transition-opacity disabled:opacity-30"
          >
            {loading ? "Saving..." : "Confirm"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-[#888]">
          Letters, numbers, _ and - only. 2-20 characters.
        </p>
      </div>
    </div>
  );
};

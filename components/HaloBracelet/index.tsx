"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { isNativePlatform } from "@/lib/native-nfc";

export type ScanResult =
  | { type: "code"; code: string }
  | { type: "ndef"; pk1: string; rnd: string; rndsig: string };

interface Props {
  onScanned: (result: ScanResult) => void;
}

export const HaloBracelet = ({ onScanned }: Props) => {
  const [isNative, setIsNative] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);

  async function handleNativeScan() {
    if (scanning) return;
    setScanning(true);
    setError(null);

    try {
      const { scanNfcNative } = await import("@/lib/native-nfc");
      const result = await scanNfcNative();
      onScanned({ type: "ndef", pk1: result.pk1, rnd: result.rnd, rndsig: result.rndsig });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function handleCodeSubmit() {
    if (code.trim().length < 6) return;
    onScanned({ type: "code", code: code.trim().toUpperCase() });
  }

  // Native iOS/Android — direct NFC scan
  if (isNative) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-2 text-center text-xs text-[#888]">Step 1 of 2</div>
          <h1 className="mb-2 text-center text-2xl font-bold">Scan your bracelet</h1>
          <p className="mb-8 text-center text-sm text-[#888]">
            Tap the button then hold your bracelet near your phone
          </p>

          <button
            onClick={handleNativeScan}
            disabled={scanning}
            className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black transition-opacity disabled:opacity-50"
          >
            {scanning ? "Hold bracelet near phone..." : "Scan bracelet"}
          </button>

          {scanning && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#888] border-t-white" />
              <p className="text-sm text-[#888]">Waiting for NFC...</p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Web fallback — code entry (for World App WebView)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-2 text-center text-xs text-[#888]">Step 1 of 2</div>
        <h1 className="mb-2 text-center text-2xl font-bold">Link your bracelet</h1>
        <p className="mb-8 text-center text-sm text-[#888]">
          Scan your bracelet in Safari, then enter the code here
        </p>

        <div className="mb-6 rounded-2xl border border-[#1e1e1e] bg-[#111] p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-black">1</span>
              <p className="text-sm text-[#ccc]">
                Open <strong className="text-white">Safari</strong> and go to the scan page
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-black">2</span>
              <p className="text-sm text-[#ccc]">
                Scan your bracelet and copy the code
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-black">3</span>
              <p className="text-sm text-[#ccc]">
                Paste the code below
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="rounded-2xl border border-[#1e1e1e] bg-[#111] px-6 py-4 text-center font-mono text-2xl tracking-[0.3em] text-white placeholder:tracking-[0.3em] placeholder:text-[#333] focus:border-[#22c55e] focus:outline-none"
          />
          <button
            onClick={handleCodeSubmit}
            disabled={code.length < 6}
            className="w-full rounded-2xl bg-[#22c55e] px-8 py-4 text-lg font-bold text-black transition-opacity disabled:opacity-30"
          >
            Link bracelet
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

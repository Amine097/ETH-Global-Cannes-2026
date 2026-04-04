"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

type Status = "idle" | "getting-challenge" | "scanning" | "binding" | "success" | "error";

const LABELS: Record<Status, string> = {
  idle: "Scanner mon bracelet",
  "getting-challenge": "Préparation...",
  scanning: "Approche ton bracelet...",
  binding: "Liaison en cours...",
  success: "Bracelet lié !",
  error: "Réessayer",
};

export const HaloBracelet = () => {
  const { data: session } = useSession();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [etherAddress, setEtherAddress] = useState<string | null>(null);

  // Ne rend rien si pas de session
  if (!session?.user?.name) return null;

  const playerId = session.user.name; // World ID sub
  const isLoading = ["getting-challenge", "scanning", "binding"].includes(status);

  async function handleScan() {
    if (isLoading) return;
    setError(null);

    try {
      // 1. Challenge
      setStatus("getting-challenge");
      const res = await fetch("/api/halo/challenge", { method: "POST" });
      if (!res.ok) throw new Error("Impossible de générer le challenge");
      const { challenge } = await res.json();

      // 2. Scan NFC via LibHaLo
      setStatus("scanning");

      if (!("NDEFReader" in window)) {
        throw new Error(
          "NFC non disponible dans ce navigateur.\nSur Android : utilise Chrome.\nDans World App : le scan NFC peut ne pas être supporté en WebView."
        );
      }

      const { execHaloCmdWeb } = await import("@arx-research/libhalo/api/web");
      const halo = await execHaloCmdWeb({ name: "sign", keyNo: 1, digest: challenge });

      // 3. Binding
      setStatus("binding");
      const bindRes = await fetch("/api/players/bind-bracelet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          challenge,
          signature: halo.signature.ether,
          publicKey: halo.publicKey,
          etherAddress: halo.etherAddress,
        }),
      });

      const data = await bindRes.json();
      if (!bindRes.ok) throw new Error(data.error ?? "Échec de la liaison");

      setEtherAddress(halo.etherAddress);
      setStatus("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setStatus("error");
    }
  }

  if (status === "success" && etherAddress) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-green-500 bg-green-50 p-6 text-center">
        <p className="font-bold text-green-700">Bracelet lié avec succès</p>
        <p className="font-mono text-xs text-gray-500">{etherAddress.slice(0, 10)}...{etherAddress.slice(-6)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleScan}
        disabled={isLoading}
        className="rounded-xl bg-black px-8 py-4 font-semibold text-white disabled:opacity-50"
      >
        {LABELS[status]}
      </button>

      {status === "scanning" && (
        <p className="text-sm text-gray-500">Pose ton téléphone sur le bracelet</p>
      )}

      {error && (
        <pre className="max-w-xs whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-600">
          {error}
        </pre>
      )}
    </div>
  );
};

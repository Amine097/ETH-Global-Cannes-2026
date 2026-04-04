"use client";

import { useEffect, useState } from "react";

interface Props {
  onEnter: () => void;
}

function EthLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2L6 16.5L16 13.5L26 16.5L16 2Z" fill="#627EEA" />
      <path d="M16 2L6 16.5L16 13.5V2Z" fill="#8CA0FF" />
      <path d="M16 18L6 16.5L16 30L26 16.5L16 18Z" fill="#627EEA" />
      <path d="M16 18L6 16.5L16 30V18Z" fill="#8CA0FF" />
      <path d="M6 16.5L16 19.5L26 16.5L16 13.5L6 16.5Z" fill="#627EEA" fillOpacity="0.5" />
      <path d="M6 16.5L16 19.5V13.5L6 16.5Z" fill="#8CA0FF" fillOpacity="0.6" />
    </svg>
  );
}

export const Welcome = ({ onEnter }: Props) => {
  const [ethAmount, setEthAmount] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur")
      .then((r) => r.json())
      .then((data) => {
        const eurPerEth: number = data?.ethereum?.eur;
        if (eurPerEth) setEthAmount((100 / eurPerEth).toFixed(4));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-between px-6 py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.07),transparent_65%)]" />

      {/* ── Prize Banner ── */}
      <div className="relative w-full max-w-sm">
        <div
          className="relative overflow-hidden rounded-xl border border-[#627EEA]/30 bg-[#0c0e1a] px-5 py-4"
          style={{ boxShadow: "0 0 32px rgba(98,126,234,0.15), inset 0 1px 0 rgba(98,126,234,0.1)" }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(98,126,234,0.08),transparent_70%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="font-cinzel text-[10px] tracking-[0.35em] text-[#627EEA] uppercase mb-1">
                🏆 Grand Prize
              </p>
              <p className="font-cinzel text-2xl font-black text-white" style={{ textShadow: "0 0 20px rgba(98,126,234,0.5)" }}>
                100 €
              </p>
              {ethAmount ? (
                <p className="font-cinzel text-sm font-semibold text-[#8CA0FF]">≈ {ethAmount} ETH</p>
              ) : (
                <p className="font-cinzel text-sm text-[#3d4a7a]">fetching price...</p>
              )}
              <p className="mt-1 font-crimson text-xs italic text-[#4a5580]">For the last warrior standing</p>
            </div>
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full blur-xl" style={{ background: "rgba(98,126,234,0.3)" }} />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#627EEA]/30 bg-[#0a0c18]">
                <EthLogo size={36} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="relative w-full max-w-sm text-center">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-base">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        <p className="font-cinzel text-[10px] tracking-[0.45em] text-[#7a6845] uppercase mb-3">
          ETH Global Cannes · MMXXVI
        </p>

        <h1 className="font-cinzel text-5xl font-black tracking-widest text-[#f0e6c8] uppercase"
            style={{ textShadow: "0 0 48px rgba(201,162,39,0.35)" }}>
          Raid Battle
        </h1>
        <p className="mt-2 font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">
          The Grand Melee
        </p>

        <div className="my-10 flex items-center justify-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(201,162,39,0.05)]" />
            <div className="absolute inset-2 rounded-full bg-[rgba(201,162,39,0.04)] animate-pulse" />
            <span className="relative animate-float text-6xl">⚔️</span>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-base">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        <button onClick={onEnter} className="btn-gold w-full rounded-lg px-8 py-4 text-base">
          Log In / Sign Up
        </button>
      </div>

      {/* Footer badges */}
      <div className="relative flex items-center justify-center gap-4 font-cinzel text-[10px] tracking-[0.3em] text-[#3d2a10] uppercase">
        <span>World ID</span>
        <span className="text-[#2e2010]">·</span>
        <span>HaLo NFC</span>
        <span className="text-[#2e2010]">·</span>
        <span>ENS</span>
      </div>
    </div>
  );
};

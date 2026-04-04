"use client";

interface Props {
  onEnter: () => void;
}

export const Welcome = ({ onEnter }: Props) => {
  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      {/* Ambient glow layer */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.07),transparent_65%)]" />

      <div className="relative w-full max-w-sm text-center">
        {/* Top ornament */}
        <div className="mb-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-base">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        {/* Eyebrow */}
        <p className="font-cinzel text-[10px] tracking-[0.45em] text-[#7a6845] uppercase mb-3">
          ETH Global Cannes · MMXXVI
        </p>

        {/* Title */}
        <h1
          className="font-cinzel text-5xl font-black tracking-widest text-[#f0e6c8] uppercase"
          style={{ textShadow: "0 0 48px rgba(201,162,39,0.35)" }}
        >
          Raid Battle
        </h1>
        <p className="mt-2 font-cinzel text-xs tracking-[0.3em] text-[#5a4010] uppercase">
          The Grand Melee
        </p>

        {/* Hero emblem */}
        <div className="my-12 flex items-center justify-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(201,162,39,0.05)]" />
            <div className="absolute inset-2 rounded-full bg-[rgba(201,162,39,0.04)] animate-pulse" />
            <span className="relative animate-float text-6xl">⚔️</span>
          </div>
        </div>

        {/* Bottom ornament */}
        <div className="mb-10 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-base">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        {/* Action button */}
        <button
          onClick={onEnter}
          className="btn-gold w-full rounded-lg px-8 py-4 text-base"
        >
          Enter the Realm
        </button>

        {/* Footer badges */}
        <div className="mt-14 flex items-center justify-center gap-4 font-cinzel text-[10px] tracking-[0.3em] text-[#3d2a10] uppercase">
          <span>World ID</span>
          <span className="text-[#2e2010]">·</span>
          <span>HaLo NFC</span>
          <span className="text-[#2e2010]">·</span>
          <span>ENS</span>
        </div>
      </div>
    </div>
  );
};

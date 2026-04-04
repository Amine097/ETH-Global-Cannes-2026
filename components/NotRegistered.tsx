"use client";

interface Props {
  onBack: () => void;
  onSignup: () => void;
}

export const NotRegistered = ({ onBack, onSignup }: Props) => {
  return (
    <div className="realm-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(201,162,39,0.05),transparent_65%)]" />

      <div className="relative w-full max-w-sm text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#2e2010] bg-[#100e08]">
            <span className="text-4xl">🔒</span>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3d2a10]" />
          <span className="text-[#5a4010] text-sm">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3d2a10]" />
        </div>

        <h1 className="font-cinzel text-2xl font-bold tracking-wider text-[#f0e6c8] mb-2">
          Unknown Sigil
        </h1>
        <p className="font-crimson text-sm text-[#7a6845] mb-8">
          This bracelet has not been bound to any warrior.
          <br />
          Pledge your oath to enter the realm.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={onSignup}
            className="btn-gold w-full rounded-lg px-8 py-4 text-base"
          >
            Pledge Your Oath
          </button>
          <button
            onClick={onBack}
            className="w-full rounded-lg py-3 font-cinzel text-xs tracking-wider text-[#5a4010] hover:text-[#7a6845] transition-colors"
          >
            ← Retreat
          </button>
        </div>
      </div>
    </div>
  );
};

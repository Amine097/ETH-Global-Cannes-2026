"use client";

interface Props {
  onLogin: () => void;
  onSignup: () => void;
}

export const Welcome = ({ onLogin, onSignup }: Props) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-12">
          <h1 className="mb-3 text-5xl font-extrabold tracking-tight">
            Raid Battle
          </h1>
          <p className="text-lg text-[#888]">
            Scan. Fight. Win.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={onLogin}
            className="w-full rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black active:opacity-80"
          >
            Log in
          </button>
          <button
            onClick={onSignup}
            className="w-full rounded-2xl border border-[#333] bg-transparent px-8 py-4 text-lg font-semibold text-white active:opacity-80"
          >
            Sign up
          </button>
        </div>

        <div className="mt-16 flex items-center justify-center gap-6 text-xs text-[#888]">
          <span>World ID</span>
          <span className="h-1 w-1 rounded-full bg-[#888]" />
          <span>HaLo NFC</span>
          <span className="h-1 w-1 rounded-full bg-[#888]" />
          <span>ENS</span>
        </div>
      </div>
    </div>
  );
};

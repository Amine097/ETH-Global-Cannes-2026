"use client";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "";

interface Props {
  onBack: () => void;
}

export const NotRegistered = ({ onBack }: Props) => {
  const signupUrl = `${SERVER_URL}/scan?mode=signup`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 text-5xl">&#x1F6AB;</div>
        <h1 className="mb-2 text-2xl font-bold">Not registered</h1>
        <p className="mb-8 text-sm text-[#888]">
          This bracelet hasn&apos;t been linked to a player yet.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href={signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl bg-white px-8 py-4 text-center text-lg font-bold text-black active:opacity-80"
          >
            Sign up instead
          </a>
          <button
            onClick={onBack}
            className="w-full rounded-xl py-3 text-sm text-[#888] hover:text-white"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

import { PayBlock } from "@/components/Pay";
import { SignIn } from "@/components/SignIn";
import { VerifyBlock } from "@/components/Verify";
import { HaloBracelet } from "@/components/HaloBracelet";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-y-3">
      <SignIn />
      <HaloBracelet />
      <VerifyBlock />
      <PayBlock />
    </main>
  );
}

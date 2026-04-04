import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import NextAuthProvider from "@/components/next-auth-provider";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Raid Battle",
  description: "Scan your HaLo bracelet. Prove your identity. Enter the game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NextAuthProvider>
          <ErudaProvider>
            {children}
          </ErudaProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}

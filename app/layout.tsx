import type { Metadata } from "next";
import { Cinzel, Crimson_Text } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import NextAuthProvider from "@/components/next-auth-provider";

const DynamicWalletProvider = dynamic(
  () => import("../components/DynamicProvider"),
  { ssr: false }
);

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const crimsonText = Crimson_Text({
  subsets: ["latin"],
  variable: "--font-crimson",
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Raid Battle",
  description: "Scan your sigil. Prove your lineage. Enter the realm.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${crimsonText.variable}`}>
        <NextAuthProvider>
          <DynamicWalletProvider>
            <ErudaProvider>
              {children}
            </ErudaProvider>
          </DynamicWalletProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}

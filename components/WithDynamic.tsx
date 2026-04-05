"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const DynamicProvider = dynamic(
  () => import("./DynamicProvider"),
  { ssr: false }
);

export function WithDynamic({ children }: { children: ReactNode }) {
  return <DynamicProvider>{children}</DynamicProvider>;
}

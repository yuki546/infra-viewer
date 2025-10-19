"use client";

import Header from "@/components/Header";
import SidePanel from "@/components/SidePanel";
import dynamic from "next/dynamic";

const CesiumViewer = dynamic(() => import("@/components/CesiumViewer"), {
  ssr: false,
});

export default function PageClient() {
  return (
    <main className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1">
        <CesiumViewer />
        <SidePanel />
      </div>
    </main>
  );
}

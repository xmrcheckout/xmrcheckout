"use client";

import dynamic from "next/dynamic";

// The terminal key lives in the URL fragment and device storage, so render only in the browser.
const TerminalScreen = dynamic(() => import("./terminal-screen"), {
  ssr: false,
  loading: () => <main className="min-h-dvh bg-cream" />,
});

export default function TerminalClient({ demo = false }: { demo?: boolean }) {
  return <TerminalScreen demo={demo} />;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StatusRefreshButtonProps = {
  label?: string;
  className?: string;
};

export default function StatusRefreshButton({
  label = "Refresh",
  className = "",
}: StatusRefreshButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <button
      className={`inline-flex min-h-8 items-center justify-center gap-2 rounded-full border border-stroke bg-white/80 px-3 py-1 text-xs font-semibold text-ink transition hover:border-ink/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
      aria-busy={isRefreshing}
    >
      <svg
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
      </svg>
      {isRefreshing ? "Refreshing..." : label}
    </button>
  );
}

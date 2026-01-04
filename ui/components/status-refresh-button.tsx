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
      className={`inline-flex items-center justify-center rounded-full border border-stroke bg-white/50 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
    >
      {isRefreshing ? "Refreshing..." : label}
    </button>
  );
}

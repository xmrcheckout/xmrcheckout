"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type InvoiceStatusAutoRefreshProps = {
  intervalMs?: number;
};

export default function InvoiceStatusAutoRefresh({
  intervalMs = 30000,
}: InvoiceStatusAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, router]);

  return null;
}

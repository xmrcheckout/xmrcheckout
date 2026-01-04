import { useEffect, useState } from "react";

const RATE_TTL_MS = 5 * 60 * 1000;
const RATE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd";

let cachedRate: number | null = null;
let cachedAt: number | null = null;
let inflight: Promise<number | null> | null = null;

const fetchRate = async (): Promise<number | null> => {
  try {
    const response = await fetch(RATE_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      monero?: { usd?: number };
    };
    const rate = data?.monero?.usd;
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      return null;
    }
    cachedRate = rate;
    cachedAt = Date.now();
    return rate;
  } catch {
    return null;
  }
};

export const useXmrUsdRate = () => {
  const [rate, setRate] = useState<number | null>(cachedRate);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cachedAt);

  useEffect(() => {
    let active = true;
    const now = Date.now();
    const hasFreshRate =
      cachedRate !== null && cachedAt !== null && now - cachedAt < RATE_TTL_MS;

    if (hasFreshRate) {
      setRate(cachedRate);
      setUpdatedAt(cachedAt);
      return;
    }

    const request =
      inflight ??
      (inflight = fetchRate().finally(() => {
        inflight = null;
      }));

    request.then((nextRate) => {
      if (!active) {
        return;
      }
      if (nextRate !== null) {
        setRate(nextRate);
        setUpdatedAt(cachedAt);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return { rate, updatedAt, source: "coingecko" as const };
};

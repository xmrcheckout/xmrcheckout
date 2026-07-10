import { useEffect, useState } from "react";

const RATE_TTL_MS = 5 * 60 * 1000;

type CachedRate = {
  rate: number;
  updatedAt: number;
};

const cachedRates = new Map<string, CachedRate>();
const inflight = new Map<string, Promise<number | null>>();

const fetchRate = async (currency: string): Promise<number | null> => {
  try {
    const response = await fetch(
      `/api/core/public/rates/${encodeURIComponent(currency)}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      rate?: string | number;
      quoted_at?: string;
    };
    const rate = Number(data.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return null;
    }
    const quotedAt = data.quoted_at ? Date.parse(data.quoted_at) : Number.NaN;
    cachedRates.set(currency, {
      rate,
      updatedAt: Number.isFinite(quotedAt) ? quotedAt : Date.now(),
    });
    return rate;
  } catch {
    return null;
  }
};

type RateStatus = "idle" | "loading" | "ready" | "error";

export const useXmrFiatRate = (currency: string | null) => {
  const normalized = currency?.trim().toLowerCase() ?? "";
  const cached = normalized ? cachedRates.get(normalized) : null;
  const [rate, setRate] = useState<number | null>(cached?.rate ?? null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.updatedAt ?? null);
  const [status, setStatus] = useState<RateStatus>(() => {
    if (!normalized) {
      return "idle";
    }
    return cached?.rate ? "ready" : "loading";
  });

  useEffect(() => {
    let active = true;
    if (!normalized) {
      setRate(null);
      setUpdatedAt(null);
      setStatus("idle");
      return;
    }

    const now = Date.now();
    const cachedEntry = cachedRates.get(normalized);
    const hasFreshRate =
      cachedEntry && now - cachedEntry.updatedAt < RATE_TTL_MS;

    if (hasFreshRate) {
      setRate(cachedEntry.rate);
      setUpdatedAt(cachedEntry.updatedAt);
      setStatus("ready");
      return;
    }

    setRate(null);
    setUpdatedAt(null);
    setStatus("loading");
    const request =
      inflight.get(normalized) ??
      fetchRate(normalized).finally(() => {
        inflight.delete(normalized);
      });
    inflight.set(normalized, request);

    request.then((nextRate) => {
      if (!active) {
        return;
      }
      const nextCached = cachedRates.get(normalized);
      if (nextRate !== null && nextCached) {
        setRate(nextCached.rate);
        setUpdatedAt(nextCached.updatedAt);
        setStatus("ready");
        return;
      }
      setStatus("error");
    });

    return () => {
      active = false;
    };
  }, [normalized]);

  return { rate, updatedAt, status, source: "coingecko" as const };
};

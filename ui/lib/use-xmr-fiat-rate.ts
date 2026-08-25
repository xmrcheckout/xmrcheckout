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

type RateSnapshot = {
  currency: string;
  rate: number | null;
  updatedAt: number | null;
  status: RateStatus;
};

const snapshotFor = (currency: string): RateSnapshot => {
  if (!currency) {
    return { currency, rate: null, updatedAt: null, status: "idle" };
  }
  const cached = cachedRates.get(currency);
  if (cached && Date.now() - cached.updatedAt < RATE_TTL_MS) {
    return {
      currency,
      rate: cached.rate,
      updatedAt: cached.updatedAt,
      status: "ready",
    };
  }
  return { currency, rate: null, updatedAt: null, status: "loading" };
};

export const useXmrFiatRate = (currency: string | null) => {
  const normalized = currency?.trim().toLowerCase() ?? "";
  const [snapshot, setSnapshot] = useState<RateSnapshot>(() =>
    snapshotFor(normalized),
  );
  if (snapshot.currency !== normalized) {
    setSnapshot(snapshotFor(normalized));
  }
  const current =
    snapshot.currency === normalized ? snapshot : snapshotFor(normalized);

  useEffect(() => {
    let active = true;
    if (!normalized) {
      return;
    }

    const now = Date.now();
    const cachedEntry = cachedRates.get(normalized);
    const hasFreshRate =
      cachedEntry && now - cachedEntry.updatedAt < RATE_TTL_MS;

    if (hasFreshRate) {
      return;
    }

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
        setSnapshot({
          currency: normalized,
          rate: nextCached.rate,
          updatedAt: nextCached.updatedAt,
          status: "ready",
        });
        return;
      }
      setSnapshot({
        currency: normalized,
        rate: null,
        updatedAt: null,
        status: "error",
      });
    });

    return () => {
      active = false;
    };
  }, [normalized]);

  return { ...current, source: "coingecko" as const };
};

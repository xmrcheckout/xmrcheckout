"use client";

import { timestampMs, utcTimestamp } from "../lib/timestamps";
import { useI18n } from "./i18n-provider";

// Deliberately retain UTC after hydration: the same unambiguous timestamp works
// with scripts disabled, in every browser locale, and when copied or printed.
export default function Timestamp({ value }: { value: string | null | undefined }) {
  const { t } = useI18n();
  const milliseconds = timestampMs(value);
  if (milliseconds === null) return <span>{utcTimestamp(value, t)}</span>;
  return <time dateTime={new Date(milliseconds).toISOString()}>{utcTimestamp(value, t)}</time>;
}

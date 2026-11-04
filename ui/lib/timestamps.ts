import type { Translate } from "./i18n/translate";

// API timestamps must include an offset. Never interpret a missing zone using
// the server's or browser's implicit time zone.
export function timestampMs(value: string | null | undefined): number | null {
  if (!value || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  // Date.parse normalizes impossible days such as February 30. Reject these
  // instead of silently displaying a different deadline.
  const datePart = value.slice(0, 10);
  const midnight = Date.parse(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== datePart) return null;
  return milliseconds;
}

export function utcTimestamp(value: string | null | undefined, t: Translate): string {
  const milliseconds = timestampMs(value);
  if (milliseconds === null) return value ? t("time.unavailable") : t("time.notSet");
  return `${new Date(milliseconds).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function timeRemaining(expires: number, now: number, t: Translate): string {
  const seconds = Math.max(0, Math.ceil((expires - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return t("time.remaining", { hours, minutes, seconds: seconds % 60 });
}

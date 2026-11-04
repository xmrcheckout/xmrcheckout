"use client";

import { useState } from "react";
import { useI18n } from "./i18n-provider";

type CredentialCardProps = {
  label: string;
  value: string;
  copyLabel: string;
};

function maskedValue(value: string) {
  return "•".repeat(Math.min(Math.max(value.length, 16), 40));
}

export default function CredentialCard({
  label,
  value,
  copyLabel,
}: CredentialCardProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-4">
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t("common.copiedToClipboard", { label }) : ""}
      </span>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-soft">{label}</p>
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-soft/70">
            {revealed ? t("credentials.visible") : t("credentials.masked")}
          </span>
        </div>
        <code
          className="mt-2 block min-h-[3.25rem] break-all border-l-2 border-clay bg-ink px-3 py-3 text-sm text-cream"
          aria-label={`${label}, ${revealed ? t("credentials.revealedState") : t("credentials.maskedState")}`}
        >
          {revealed ? value : maskedValue(value)}
        </code>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-stroke bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition hover:border-ink/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          type="button"
          aria-pressed={revealed}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? t("credentials.hide") : t("credentials.reveal")}
        </button>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          type="button"
          onClick={handleCopy}
        >
          {copied ? t("common.copied") : copyLabel}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

type SecretCardProps = {
  label: string;
  value: string;
  buttonLabel: string;
};

export default function SecretCard({
  label,
  value,
  buttonLabel,
}: SecretCardProps) {
  const [copied, setCopied] = useState(false);

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
        {copied ? `${label} copied to clipboard` : ""}
      </span>
      <div>
        <p className="text-xs font-semibold text-ink-soft">{label}</p>
        <code className="mt-2 block break-all border-l-2 border-clay bg-ink px-3 py-3 text-sm text-cream">
          {value}
        </code>
      </div>
      <div className="flex justify-end">
        <button
          className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          type="button"
          onClick={handleCopy}
        >
          {copied ? "Copied" : buttonLabel}
        </button>
      </div>
    </div>
  );
}

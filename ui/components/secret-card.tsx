"use client";

import { useState } from "react";

type SecretCardProps = {
  label: string;
  value: string;
  buttonLabel: string;
};

export default function SecretCard({ label, value, buttonLabel }: SecretCardProps) {
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
    <div className="grid gap-4 rounded-2xl border border-stroke bg-white/80 p-6 shadow-soft backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
          {label}
        </p>
        <code className="mt-2 block break-all rounded-xl bg-ink/10 px-3 py-2 text-sm text-ink">
          {value}
        </code>
      </div>
      <div className="flex justify-end">
        <button
          className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5"
          type="button"
          onClick={handleCopy}
        >
          {copied ? "Copied" : buttonLabel}
        </button>
      </div>
    </div>
  );
}

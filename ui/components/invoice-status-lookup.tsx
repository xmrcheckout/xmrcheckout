"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { invoiceLookupId } from "../lib/invoice-display";

type InvoiceStatusLookupProps = {
  initialValue?: string;
  compact?: boolean;
};

export default function InvoiceStatusLookup({
  initialValue = "",
  compact = false,
}: InvoiceStatusLookupProps) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [invoiceId, setInvoiceId] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = invoiceId.trim();
    if (!trimmed) {
      setError("Enter an invoice id to continue.");
      return;
    }
    const id = invoiceLookupId(trimmed, window.location.origin);
    if (!id) {
      setError("Enter a complete invoice ID or an invoice link from this site.");
      return;
    }
    setError(null);
    router.push(`/invoice/${encodeURIComponent(id)}`);
  };

  return (
    <form
      className={`grid gap-3 ${compact ? "text-sm" : "text-base"}`}
      onSubmit={handleSubmit}
    >
      <label
        className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft"
        htmlFor={inputId}
      >
        Invoice ID or link
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-h-12 w-full min-w-0 flex-1 basis-full sm:basis-0 rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          name="invoice_id"
          type="text"
          value={invoiceId}
          onChange={(event) => { setInvoiceId(event.target.value); setError(null); }}
          placeholder="Paste the complete invoice ID or link"
          autoComplete="off"
          spellCheck={false}
          required
        />
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          type="submit"
        >
          Check status
        </button>
      </div>
      {compact ? null : (
        <p className="text-sm text-ink-soft">
          Read-only status view. The invoice page checks for updates every 30 seconds.
        </p>
      )}
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type InvoiceStatusLookupProps = {
  initialValue?: string;
  compact?: boolean;
};

export default function InvoiceStatusLookup({
  initialValue = "",
  compact = false,
}: InvoiceStatusLookupProps) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = invoiceId.trim();
    if (!trimmed) {
      setError("Enter an invoice id to continue.");
      return;
    }
    setError(null);
    router.push(`/invoice/${trimmed}`);
  };

  return (
    <form
      className={`grid gap-3 ${compact ? "text-sm" : "text-base"}`}
      onSubmit={handleSubmit}
    >
      <label
        className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft"
        htmlFor="invoice_id"
      >
        Invoice ID
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
          id="invoice_id"
          name="invoice_id"
          type="text"
          value={invoiceId}
          onChange={(event) => setInvoiceId(event.target.value)}
          placeholder="e.g. 9d2f2b3c-8a77-4c2b-b9d4-..."
          autoComplete="off"
          spellCheck={false}
          required
        />
        <button
          className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5"
          type="submit"
        >
          Check status
        </button>
      </div>
      {compact ? null : (
        <p className="text-sm text-ink-soft">
          Read-only status view. Refresh the page to see new detections.
        </p>
      )}
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

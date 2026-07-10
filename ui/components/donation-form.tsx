"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import {
  createDonationAction,
  type DonationState,
} from "../app/(marketing)/donate/actions";
import { formatUsdAmount } from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";

const initialState: DonationState = {
  error: null,
  invoiceId: null,
};

export default function DonationForm() {
  const router = useRouter();
  const [state, formAction] = useFormState(createDonationAction, initialState);
  const [amountInput, setAmountInput] = useState("");
  const amountValue = useMemo(() => {
    const parsed = Number.parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : null;
  }, [amountInput]);
  const shouldLoadRate = amountValue !== null && amountValue > 0;
  const { rate: usdRate, status: rateStatus } =
    useXmrUsdRate(shouldLoadRate);
  const usdEstimate = useMemo(() => {
    if (!usdRate || !shouldLoadRate || amountValue === null) {
      return null;
    }
    return formatUsdAmount(usdRate * amountValue);
  }, [amountValue, shouldLoadRate, usdRate]);

  useEffect(() => {
    if (state.invoiceId) {
      router.push(`/donate/${state.invoiceId}`);
    }
  }, [router, state.invoiceId]);

  return (
    <form className="grid gap-5" action={formAction}>
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft"
          htmlFor="donation_amount"
        >
          Amount (XMR)
        </label>
        <input
          className="mt-2 min-h-12 w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-base text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
          id="donation_amount"
          name="amount_xmr"
          type="number"
          step="0.000001"
          min="0"
          placeholder="0.10"
          required
          onChange={(event) => setAmountInput(event.target.value)}
        />
      </div>

      <div className="min-h-[3rem] text-sm text-ink-soft" aria-live="polite">
        {usdEstimate ? (
          <>
            <p>Approx. USD reference: ~{usdEstimate}</p>
            <p className="mt-1 text-xs">
              CoinGecko spot reference only. This is not a quote, rate lock, or
              guarantee.
            </p>
          </>
        ) : null}
        {shouldLoadRate && rateStatus === "loading" ? (
          <p>Loading USD reference...</p>
        ) : null}
        {shouldLoadRate && rateStatus === "error" ? (
          <p>USD reference unavailable. You can still continue with XMR.</p>
        ) : null}
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3 border-t border-stroke pt-5">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
          href="/"
        >
          Back home
        </Link>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
          type="submit"
        >
          Create donation request
        </button>
      </div>
    </form>
  );
}

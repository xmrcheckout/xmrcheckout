"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  createDonationAction,
  type DonationState,
} from "../app/(marketing)/donate/actions";
import { formatUsdAmount } from "../lib/formatting";
import { useXmrUsdRate } from "../lib/use-xmr-usd-rate";

const donateParam = "donate";

const initialState: DonationState = {
  error: null,
  invoiceId: null,
};

export default function DonateModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const donationsEnabled = process.env.NEXT_PUBLIC_DONATIONS_ENABLED === "true";
  const isOpen = searchParams.get(donateParam) === "1";
  const [state, formAction] = useFormState(createDonationAction, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const { rate: usdRate } = useXmrUsdRate();

  const openModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(donateParam, "1");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(donateParam);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!state.invoiceId) {
      return;
    }
    closeModal();
    router.push(`/donate/${state.invoiceId}`);
  }, [closeModal, router, state.invoiceId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    formRef.current?.reset();
    setAmountInput("");
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal, isOpen]);
  const amountValue = useMemo(() => {
    const parsed = Number.parseFloat(amountInput);
    return Number.isFinite(parsed) ? parsed : null;
  }, [amountInput]);
  const usdEstimate = useMemo(() => {
    if (!usdRate || amountValue === null || amountValue <= 0) {
      return null;
    }
    return formatUsdAmount(usdRate * amountValue);
  }, [usdRate, amountValue]);

  if (!donationsEnabled) {
    return null;
  }

  return (
    <div className="flex items-center">
      <button
        className="rounded-full border border-stroke bg-white/40 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-clay transition hover:text-ink"
        type="button"
        onClick={openModal}
      >
        Donate
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-30 grid place-items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="donate-title"
        >
          <div className="absolute inset-0 bg-ink/60 backdrop-blur" onClick={closeModal} />
          <div
            className="relative w-[min(420px,92vw)] rounded-3xl border border-stroke bg-card p-7 shadow-deep"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
                  Support xmrcheckout.com
                </p>
                <h3 id="donate-title" className="mt-2 font-serif text-xl">
                  Send a quick donation.
                </h3>
              </div>
              <button
                className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink transition hover:-translate-y-0.5"
                type="button"
                onClick={closeModal}
                aria-label="Close donation modal"
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-ink-soft">
              Choose an amount and we will open a read-only invoice page.
            </p>
            <form className="mt-4 grid gap-4" action={formAction} ref={formRef}>
              <label
                className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft"
                htmlFor="donation_amount"
              >
                Amount (XMR)
              </label>
              <input
                className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                id="donation_amount"
                name="amount_xmr"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0.10"
                required
                onChange={(event) => setAmountInput(event.target.value)}
              />
              <div className="min-h-[2.75rem]">
                {usdEstimate ? (
                  <>
                    <p className="text-sm text-ink-soft">
                      Approx. USD reference: ~{usdEstimate}
                    </p>
                    <details className="w-fit text-xs text-ink-soft">
                      <summary className="cursor-pointer select-none underline underline-offset-4">
                        About this estimate
                      </summary>
                      <p className="mt-2 max-w-[46ch] leading-relaxed">
                        Reference only, uses CoinGecko spot rate. Not a quote or guarantee.
                      </p>
                    </details>
                  </>
                ) : null}
              </div>
              {state.error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {state.error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
                  type="button"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5"
                  type="submit"
                >
                  Donate
                </button>
              </div>
            </form>
            <p className="mt-4 text-sm text-ink-soft">
              Payments go directly to the founder wallet. This checkout never
              moves funds.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

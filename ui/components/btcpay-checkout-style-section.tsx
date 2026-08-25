"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import {
  updateBtcpayCheckoutStyleAction,
  type BtcpayCheckoutPreferenceState,
} from "../app/(app)/dashboard/actions";

type BtcpayCheckoutStyle = "standard" | "btcpay_classic";

type BtcpayCheckoutStyleSectionProps = {
  initialStyle: BtcpayCheckoutStyle;
};

const initialState = (
  style: BtcpayCheckoutStyle,
): BtcpayCheckoutPreferenceState => ({
  style,
  error: null,
  success: null,
});

export default function BtcpayCheckoutStyleSection({
  initialStyle,
}: BtcpayCheckoutStyleSectionProps) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    updateBtcpayCheckoutStyleAction,
    initialState(initialStyle),
  );
  const [style, setStyle] = useState<BtcpayCheckoutStyle>(initialStyle);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <h2 className="font-sans text-xl font-semibold">
          BTCPay checkout layout
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          This setting only applies to BTCPay checkouts (invoices created via
          the BTCPay compatibility endpoints).
        </p>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-ink">
        Layout
        <select
          name="btcpay_checkout_style"
          className="rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
          value={style}
          onChange={(event) =>
            setStyle(event.target.value as BtcpayCheckoutStyle)
          }
        >
          <option value="standard">Standard XMR Checkout</option>
          <option value="btcpay_classic">BTCPay Classic</option>
        </select>
      </label>
      <p className="text-xs text-ink-soft">
        The classic layout mirrors the BTCPay checkout screen for drop-in
        migration.
      </p>
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {state.success}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          className="inline-flex items-center justify-center rounded-full border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2"
          type="submit"
        >
          Save preference
        </button>
      </div>
    </form>
  );
}

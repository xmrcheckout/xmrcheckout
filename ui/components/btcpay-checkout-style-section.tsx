"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import {
  updateBtcpayCheckoutStyleAction,
  type BtcpayCheckoutPreferenceState,
} from "../app/(app)/dashboard/actions";

type BtcpayCheckoutStyle = "standard" | "btcpay_classic";

type BtcpayCheckoutStyleSectionProps = {
  initialStyle: BtcpayCheckoutStyle;
};

const initialState = (
  style: BtcpayCheckoutStyle
): BtcpayCheckoutPreferenceState => ({
  style,
  error: null,
  success: null,
});

export default function BtcpayCheckoutStyleSection({
  initialStyle,
}: BtcpayCheckoutStyleSectionProps) {
  const [state, formAction] = useFormState(
    updateBtcpayCheckoutStyleAction,
    initialState(initialStyle)
  );
  const [style, setStyle] = useState<BtcpayCheckoutStyle>(state.style);

  useEffect(() => {
    setStyle(state.style);
  }, [state.style]);

  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <h3 className="font-serif text-2xl">BTCPay checkout layout</h3>
        <p className="mt-2 text-sm text-ink-soft">
          Choose the hosted invoice layout shown to payers when you use the BTCPay
          compatibility endpoints.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-ink">
        Layout
        <select
          name="btcpay_checkout_style"
          className="rounded-xl border border-stroke bg-white/80 px-3 py-2 text-sm text-ink"
          value={style}
          onChange={(event) =>
            setStyle(event.target.value as BtcpayCheckoutStyle)
          }
        >
          <option value="standard">Standard XMR Checkout</option>
          <option value="btcpay_classic">BTCPay classic</option>
        </select>
      </label>
      <p className="text-xs text-ink-soft">
        The classic layout mirrors the BTCPay checkout screen for drop-in migration.
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
          className="inline-flex items-center justify-center rounded-full border border-stroke bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition hover:-translate-y-0.5"
          type="submit"
        >
          Save preference
        </button>
      </div>
    </form>
  );
}

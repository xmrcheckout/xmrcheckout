"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import {
  updateDefaultConfirmationTargetAction,
  type DefaultConfirmationTargetState,
} from "../app/(app)/dashboard/actions";

const buildInitialState = (value: number): DefaultConfirmationTargetState => ({
  value,
  error: null,
  success: null,
});

export default function DefaultConfirmationTargetSection({
  initialValue,
}: {
  initialValue: number;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    updateDefaultConfirmationTargetAction,
    buildInitialState(initialValue)
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-serif text-2xl">Default confirmations</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Used as the default confirmation target for new invoices.
        </p>
      </div>
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" action={formAction}>
        <div className="grid gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft"
            htmlFor="default_confirmation_target"
          >
            Confirmation target
          </label>
          <input
            className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
            id="default_confirmation_target"
            name="default_confirmation_target"
            type="number"
            min={0}
            max={10}
            step={1}
            defaultValue={state.value}
            required
          />
        </div>
        <div className="flex items-end justify-end">
          <button
            className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5"
            type="submit"
          >
            Save
          </button>
        </div>
      </form>
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
    </div>
  );
}


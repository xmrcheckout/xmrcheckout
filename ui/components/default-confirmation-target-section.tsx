"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import {
  updateDefaultConfirmationTargetAction,
  type DefaultConfirmationTargetState,
} from "../app/(app)/dashboard/actions";
import { useI18n } from "./i18n-provider";
import PendingSubmitButton from "./pending-submit-button";

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
  const { t } = useI18n();
  const router = useRouter();
  // Controlled, so a failed save keeps what the merchant typed.
  const [value, setValue] = useState(String(initialValue));
  const [state, formAction] = useFormState(
    updateDefaultConfirmationTargetAction,
    buildInitialState(initialValue),
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-sans text-xl font-semibold">
          {t("settings.defaultConfirmations")}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          {t("settings.defaultConfirmationsHelp")}
        </p>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        action={formAction}
        onReset={(event) => event.preventDefault()}
      >
        <div className="grid gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft"
            htmlFor="default_confirmation_target"
          >
            {t("settings.confirmationTarget")}
          </label>
          <input
            className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
            id="default_confirmation_target"
            name="default_confirmation_target"
            type="number"
            min={0}
            max={10}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
          />
        </div>
        <div className="flex items-end justify-end">
          <PendingSubmitButton
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:opacity-60"
            pendingLabel={t("common.saving")}
          >
            {t("settings.saveConfirmationTarget")}
          </PendingSubmitButton>
        </div>
      </form>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}

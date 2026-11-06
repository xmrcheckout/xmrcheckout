"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "./i18n-provider";

type ConfirmSubmitButtonProps = {
  label: string;
  confirmLabel: string;
  description: string;
  pendingLabel: string;
};

export default function ConfirmSubmitButton({
  label,
  confirmLabel,
  description,
  pendingLabel,
}: ConfirmSubmitButtonProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const descriptionId = useId();
  const { pending } = useFormStatus();

  if (!confirming) {
    return (
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-red-800 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2"
        type="button"
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="grid gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-left sm:max-w-md"
      role="alertdialog"
      aria-describedby={descriptionId}
      aria-label={t("common.confirmationOf", { label })}
    >
      <p className="text-xs leading-relaxed text-red-900" id={descriptionId}>
        {description}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-red-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2"
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {t("common.cancel")}
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-red-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2"
          type="submit"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
        <span className="sr-only" role="status">{pending ? pendingLabel : ""}</span>
      </div>
    </div>
  );
}

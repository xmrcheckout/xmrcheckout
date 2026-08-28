"use client";

import { useId, useState } from "react";

type ConfirmSubmitButtonProps = {
  label: string;
  confirmLabel: string;
  description: string;
};

export default function ConfirmSubmitButton({
  label,
  confirmLabel,
  description,
}: ConfirmSubmitButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const descriptionId = useId();

  if (!confirming) {
    return (
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-red-800 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2"
        type="button"
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
      aria-label={`${label} confirmation`}
    >
      <p className="text-xs leading-relaxed text-red-900" id={descriptionId}>
        {description}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-red-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-red-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2"
          type="button"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-red-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2"
          type="submit"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

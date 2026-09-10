"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
};

export default function PendingSubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      <span role="status" aria-live="polite">
        {pending ? pendingLabel : children}
      </span>
    </button>
  );
}

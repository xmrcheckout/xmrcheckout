"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "./i18n-provider";

type AccessibleDialogProps = {
  ariaDescribedBy?: string;
  ariaLabelledBy: string;
  children: ReactNode;
  className?: string;
  id?: string;
  initialFocusSelector?: string;
  onClose: () => void;
  panelClassName?: string;
};

const focusableSelector =
  'summary, a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const emptySubscribe = () => () => {};

export default function AccessibleDialog({
  ariaDescribedBy,
  ariaLabelledBy,
  children,
  className = "",
  id,
  initialFocusSelector,
  onClose,
  panelClassName = "",
}: AccessibleDialogProps) {
  const { t } = useI18n();
  // Match the server's empty render before mounting the portal in the browser.
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => {
      const initialFocus = initialFocusSelector
        ? panelRef.current?.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const firstFocusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).find(element => element.getClientRects().length > 0);
      (initialFocus ?? firstFocusable)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getClientRects().length > 0 && !element.closest("[hidden]"));

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!panelRef.current.contains(active) || !focusable.includes(active as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const portal = panelRef.current?.parentElement;
    const siblings = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== portal);
    const inertValues = siblings.map(element => element.inert);
    siblings.forEach(element => { element.inert = true; });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute("data-dialog-open", "true");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      siblings.forEach((element, index) => { element.inert = inertValues[index]; });
      document.body.style.overflow = previousOverflow;
      document.documentElement.removeAttribute("data-dialog-open");
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [initialFocusSelector, isHydrated]);

  if (!isHydrated) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] grid place-items-end overflow-y-auto px-3 py-3 sm:place-items-center sm:px-4 sm:py-4 ${className}`}
    >
      <button
        aria-label={t("common.closeDialog")}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-ink/70"
        type="button"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`relative w-full overflow-y-auto rounded-t-[1.2rem] border border-ink/20 bg-cream shadow-deep sm:rounded-surface ${panelClassName}`}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import LoginForm from "../app/(app)/login/login-form";

const loginParam = "login";

type LoginTriggerProps = {
  className?: string;
  children: React.ReactNode;
};

export function LoginTrigger({ className, children }: LoginTriggerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const openModal = useCallback(() => {
    const params =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    params.set(loginParam, "1");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router]);

  return (
    <button
      className={className}
      type="button"
      onClick={openModal}
      aria-haspopup="dialog"
      aria-controls="login-modal"
    >
      {children}
    </button>
  );
}

export default function LoginModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOpen = searchParams.get(loginParam) === "1";
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(loginParam);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    window.requestAnimationFrame(() => {
      const firstField = modalRef.current?.querySelector<HTMLElement>("#payment_address");
      firstField?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("hidden"));

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [closeModal, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto px-4 py-6 sm:py-10"
      id="login-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      aria-describedby="login-description"
    >
      <div className="absolute inset-0 bg-ink/60 backdrop-blur" onClick={closeModal} />
      <div
        ref={modalRef}
        className="relative max-h-[90dvh] w-[min(480px,92vw)] overflow-y-auto rounded-3xl border border-stroke bg-card p-6 shadow-deep sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-clay">
              View-only setup
            </p>
            <h3 id="login-title" className="mt-2 font-serif text-xl">
              Connect your wallet for payment detection.
            </h3>
          </div>
          <button
            className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink transition hover:-translate-y-0.5"
            type="button"
            onClick={closeModal}
            aria-label="Close login modal"
          >
            Close
          </button>
        </div>
        <div
          id="login-description"
          className="mt-4 rounded-2xl border border-stroke bg-white/60 p-4 text-sm text-ink-soft"
        >
          <p className="font-semibold text-ink">Before you continue</p>
          <p className="mt-2">
            Your primary address identifies the dashboard. Your secret view key
            lets XMR Checkout detect incoming invoice payments. It is stored
            encrypted at rest and cannot spend from your wallet.
          </p>
          <p className="mt-2 font-semibold text-clay">
            Never paste a spend key here.
          </p>
        </div>
        <LoginForm />
        <p className="mt-4 text-sm font-semibold text-sage">
          View-only access is the maximum permission this software asks for.
        </p>
      </div>
    </div>
  );
}

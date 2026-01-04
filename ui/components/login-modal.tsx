"use client";

import { useEffect, useCallback } from "react";
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

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center"
      id="login-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <div className="absolute inset-0 bg-ink/60 backdrop-blur" onClick={closeModal} />
      <div
        className="relative w-[min(480px,92vw)] rounded-3xl border border-stroke bg-card p-7 shadow-deep"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-clay">
              Merchant access
            </p>
            <h3 id="login-title" className="mt-2 font-serif text-xl">
              Sign in to your dashboard.
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
        <p className="mt-3 text-ink-soft">
          Use your primary address and secret view key to access checkout tools.
          Your primary address is the only identifier we need - no email or other
          identifying information required.
          <br />
          Your secret view key is stored encrypted at rest and used only for payment detection.
        </p>
        <LoginForm />
        <p className="mt-4 text-sm font-semibold text-sage">
          We never require more than view-only access to keep your funds safe.
        </p>
      </div>
    </div>
  );
}

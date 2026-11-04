"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import LoginForm from "../app/(app)/login/login-form";
import AccessibleDialog from "./accessible-dialog";
import { useI18n } from "./i18n-provider";

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
    >
      {children}
    </button>
  );
}

export default function LoginModal() {
  const { t } = useI18n();
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

  if (!isOpen) {
    return null;
  }

  return (
    <AccessibleDialog
      id="login-modal"
      ariaLabelledBy="login-title"
      ariaDescribedBy="login-description"
      initialFocusSelector="#payment_address"
      onClose={closeModal}
      panelClassName="max-h-[calc(100dvh-1.5rem)] sm:w-[min(500px,94vw)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-cream/20 bg-ink px-4 py-4 text-cream sm:px-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-cream/70">
            <span
              className="h-2 w-2 rounded-full bg-monero"
              aria-hidden="true"
            />
            {t("login.walletConnection")}
          </p>
          <h3
            id="login-title"
            className="mt-1 font-sans text-lg font-semibold leading-tight"
          >
            {t("login.modalTitle")}
          </h3>
        </div>
        <button
          className="min-h-11 min-w-11 shrink-0 rounded-full border border-cream/30 bg-cream/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-cream transition hover:bg-cream/20"
          type="button"
          onClick={closeModal}
          aria-label={t("login.closeModal")}
        >
          {t("common.close")}
        </button>
      </div>
      <div className="p-4 sm:p-5">
        <div
          id="login-description"
          className="border-l-2 border-sage pl-3 text-xs leading-relaxed text-ink-soft sm:text-sm"
        >
          <p className="font-semibold text-ink">{t("login.beforeContinue")}</p>
          <p className="mt-1">
            {t("login.disclosure")}
          </p>
        </div>
        <LoginForm nextDestination={searchParams.get("next") ?? undefined} />
      </div>
    </AccessibleDialog>
  );
}

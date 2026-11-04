"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { dashboardDestination, walletFormatErrors } from "../../../lib/wallet-connection";

import PendingSubmitButton from "../../../components/pending-submit-button";

import { loginAction, type LoginState } from "./actions";
import { useI18n } from "../../../components/i18n-provider";

const initialState: LoginState = { error: null };

const apiBaseUrl =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
    : "";
const base58Pattern =
  /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
const viewKeyPattern = /^[0-9a-fA-F]{64}$/;
const validationDelayMs = 450;

const isLikelyPrimaryAddress = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length !== 95) {
    return false;
  }
  if (!trimmed.startsWith("4")) {
    return false;
  }
  return base58Pattern.test(trimmed);
};

const isLikelyPrivateViewKey = (value: string) =>
  viewKeyPattern.test(value.trim());

export default function LoginForm({ nextDestination }: { nextDestination?: string }) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(loginAction, initialState);
  const [paymentAddress, setPaymentAddress] = useState("");
  const [viewKey, setViewKey] = useState("");
  const [isViewKeyVisible, setIsViewKeyVisible] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "checking" | "valid" | "invalid" | "error"
  >("idle");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const formatErrors = walletFormatErrors(paymentAddress, viewKey, t);

  const canSubmit = useMemo(() => {
    if (
      !isLikelyPrimaryAddress(paymentAddress) ||
      !isLikelyPrivateViewKey(viewKey)
    ) {
      return false;
    }
    return validationStatus !== "checking" && validationStatus !== "invalid";
  }, [paymentAddress, validationStatus, viewKey]);

  useEffect(() => {
    if (
      !isLikelyPrimaryAddress(paymentAddress) ||
      !isLikelyPrivateViewKey(viewKey)
    ) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setValidationStatus("checking");
      setValidationMessage(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/core/auth/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_address: paymentAddress.trim(),
            view_key: viewKey.trim(),
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          const message =
            detail?.detail ?? t("login.validationFailed");
          setValidationStatus("invalid");
          setValidationMessage(message);
          return;
        }

        setValidationStatus("valid");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setValidationStatus("error");
        setValidationMessage(
          t("login.validationUnavailable"),
        );
      }
    }, validationDelayMs);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [paymentAddress, viewKey, t]);

  return (
    <form className="mt-4 grid gap-3" action={formAction}>
      <input type="hidden" name="next" value={dashboardDestination(nextDestination)} />
      <details className="text-sm text-ink-soft">
        <summary className="min-h-11 cursor-pointer py-3 underline underline-offset-4">{t("login.whereToFind")}</summary>
        <div className="mt-3 grid gap-3">
          <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Monero GUI</summary><p>{t("login.guiSteps")}</p><a className="underline" href="https://github.com/monero-ecosystem/monero-GUI-guide/blob/master/monero-GUI-guide.md#seed-and-keys" target="_blank" rel="noreferrer">{t("login.guiGuide")}</a></details>
          <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Feather</summary><p>{t("login.featherSteps")}</p><a className="underline" href="https://docs.featherwallet.org/guides/primary-address" target="_blank" rel="noreferrer">{t("login.featherGuide")}</a></details>
          <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Cake Wallet</summary><p>{t("login.cakeSteps")}</p><a className="underline" href="https://docs.cakewallet.com/cryptos/monero/" target="_blank" rel="noreferrer">{t("login.cakeGuide")}</a></details>
          <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">{t("login.otherWallets")}</summary><p>{t("login.otherSteps")}</p></details>
        </div>
      </details>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label
            className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink-soft"
            htmlFor="payment_address"
          >
            {t("login.primaryAddress")}
          </label>
          {isLikelyPrimaryAddress(paymentAddress) ? (
            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-800">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  d="M6.4 11.4 3.2 8.2l1.1-1.1 2.1 2.1 5.2-5.2 1.1 1.1-6.3 6.3z"
                  fill="currentColor"
                />
              </svg>
              {t("login.formatOk")}
            </span>
          ) : null}
        </div>
        <textarea
          className="min-h-[72px] w-full resize-none rounded-xl border border-stroke bg-white/80 px-3 py-2.5 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
          id="payment_address"
          aria-describedby="address-help address-format login-feedback"
          aria-invalid={Boolean(paymentAddress.trim() && formatErrors.address) || validationStatus === "invalid"}
          name="payment_address"
          rows={2}
          autoComplete="off"
          required
          value={paymentAddress}
          onChange={(event) => {
            setPaymentAddress(event.target.value);
            setValidationStatus("idle");
            setValidationMessage(null);
          }}
        />
        <p id="address-help" className="text-xs leading-relaxed text-ink-soft">
          {t("login.addressHelp")}
        </p>
        <p id="address-format" className="text-sm text-ink-soft">{formatErrors.address}</p>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label
            className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink-soft"
            htmlFor="view_key"
          >
            {t("login.viewKey")}
          </label>
          {isLikelyPrivateViewKey(viewKey) ? (
            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-800">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  d="M6.4 11.4 3.2 8.2l1.1-1.1 2.1 2.1 5.2-5.2 1.1 1.1-6.3 6.3z"
                  fill="currentColor"
                />
              </svg>
              {t("login.formatOk")}
            </span>
          ) : null}
        </div>
        <div className="relative">
          <input
            className="min-h-[42px] w-full rounded-xl border border-stroke bg-white/80 px-3 py-2.5 pr-20 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
            id="view_key"
            aria-describedby="view-key-help view-key-format login-feedback"
            aria-invalid={Boolean(viewKey.trim() && formatErrors.viewKey) || validationStatus === "invalid"}
            name="view_key"
            type={isViewKeyVisible ? "text" : "password"}
            autoComplete="off"
            required
            value={viewKey}
            onChange={(event) => {
              setViewKey(event.target.value);
              setValidationStatus("idle");
              setValidationMessage(null);
            }}
          />
          <button
            className="min-w-11 absolute inset-y-1 right-1 rounded-lg border border-stroke bg-white px-2.5text-[0.7rem] font-semibold text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
            type="button"
            onClick={() => setIsViewKeyVisible((current) => !current)}
          >
            {isViewKeyVisible ? t("credentials.hide") : t("login.show")}
          </button>
        </div>
        <p id="view-key-help" className="text-xs leading-relaxed text-ink-soft">
          {t("login.viewKeyHelp")}
        </p>
        <p id="view-key-format" className="text-sm text-ink-soft">{formatErrors.viewKey}</p>
        <p className="text-xs text-ink-soft">{t("login.formatOnly")}</p>
      </div>
      <div id="login-feedback" role="status" aria-live="polite" aria-atomic="true">
        {validationStatus === "checking" ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-amber-700">
            {t("login.checking")}
          </p>
        ) : null}
        {validationStatus === "valid" ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-emerald-700">
            {t("login.match")}
          </p>
        ) : null}
        {validationStatus === "invalid" || validationStatus === "error" ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {validationMessage}
          </p>
        ) : null}
        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end">
        <PendingSubmitButton
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_12px_24px_rgba(16,18,23,0.16)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink/60 disabled:text-cream/70 disabled:shadow-none"
          pendingLabel={t("login.connecting")}
          disabled={!canSubmit}
        >
          {t("nav.connect")}
        </PendingSubmitButton>
      </div>
    </form>
  );
}

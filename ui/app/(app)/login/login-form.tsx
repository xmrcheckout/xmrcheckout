"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { loginAction, type LoginState } from "./actions";

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

const isLikelySecretViewKey = (value: string) =>
  viewKeyPattern.test(value.trim());

export default function LoginForm() {
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

  const canSubmit = useMemo(() => {
    if (
      !isLikelyPrimaryAddress(paymentAddress) ||
      !isLikelySecretViewKey(viewKey)
    ) {
      return false;
    }
    return validationStatus !== "checking" && validationStatus !== "invalid";
  }, [paymentAddress, validationStatus, viewKey]);

  useEffect(() => {
    if (
      !isLikelyPrimaryAddress(paymentAddress) ||
      !isLikelySecretViewKey(viewKey)
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
            detail?.detail ?? "Address and view key did not pass validation.";
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
          "Unable to validate the address and view key yet. You can still sign in to confirm.",
        );
      }
    }, validationDelayMs);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [paymentAddress, viewKey]);

  return (
    <form className="mt-4 grid gap-3" action={formAction}>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label
            className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink-soft"
            htmlFor="payment_address"
          >
            Primary address
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
              Valid
            </span>
          ) : null}
        </div>
        <textarea
          className="min-h-[72px] w-full resize-none rounded-xl border border-stroke bg-white/80 px-3 py-2.5 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
          id="payment_address"
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
        <p className="text-xs leading-relaxed text-ink-soft">
          Use the 95-character primary address that starts with 4. Subaddresses
          and integrated addresses are not used for dashboard access.
        </p>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label
            className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink-soft"
            htmlFor="view_key"
          >
            Secret view key
          </label>
          {isLikelySecretViewKey(viewKey) ? (
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
              Valid
            </span>
          ) : null}
        </div>
        <div className="relative">
          <input
            className="min-h-[42px] w-full rounded-xl border border-stroke bg-white/80 px-3 py-2.5 pr-20 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
            id="view_key"
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
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border border-stroke bg-white/70 px-2.5 py-1 text-[0.7rem] font-semibold text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50"
            type="button"
            onClick={() => setIsViewKeyVisible((current) => !current)}
          >
            {isViewKeyVisible ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-ink-soft">
          Paste the 64-character secret view key, not a spend key. This allows
          detection only.
        </p>
      </div>
      {validationStatus === "checking" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-amber-700">
          Checking address and view key
        </p>
      ) : null}
      {validationStatus === "valid" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-emerald-700">
          Address and view key match
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
      <div className="flex items-center justify-end">
        <button
          className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream shadow-[0_12px_24px_rgba(16,18,23,0.16)] transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink/60 disabled:text-cream/70 disabled:shadow-none"
          type="submit"
          disabled={!canSubmit}
        >
          Sign in
        </button>
      </div>
    </form>
  );
}

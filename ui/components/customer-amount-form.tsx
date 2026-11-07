"use client";

import { useState } from "react";

import { formatFiatAmount, formatXmrAmount } from "../lib/formatting";
import { useXmrFiatRate } from "../lib/use-xmr-fiat-rate";
import { useI18n } from "./i18n-provider";

type CustomerAmountLink = {
  action_url: string;
  confirmation_target: number;
  minimum_amount_xmr: string | null;
  supported_currencies?: string[];
};

const AMOUNT_PATTERN = /^[0-9]{1,7}([.][0-9]{1,12})?$/;
// Reference currency shown when the buyer enters XMR.
const XMR_REFERENCE_CURRENCY = "USD";

export default function CustomerAmountForm({ link }: { link: CustomerAmountLink }) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XMR");
  const isXmr = currency === "XMR";
  const rateCurrency = isXmr ? XMR_REFERENCE_CURRENCY : currency;
  const { rate } = useXmrFiatRate(rateCurrency);

  const trimmed = amount.trim();
  const value = AMOUNT_PATTERN.test(trimmed) ? Number.parseFloat(trimmed) : null;
  let estimate: string | null = null;
  if (rate && value !== null && value > 0) {
    estimate = isXmr
      ? t("paymentLink.estimateFiat", {
          amount: formatFiatAmount(value * rate, rateCurrency, locale),
        })
      : t("paymentLink.estimateXmr", {
          amount: formatXmrAmount((value / rate).toFixed(6)),
        });
  }

  const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-ink";
  return (
    <>
      <form method="post" action={link.action_url} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <label htmlFor="customer-amount">{t("paymentLink.amount")}</label>
            <input
              id="customer-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              pattern="[0-9]{1,7}([.][0-9]{1,12})?"
              autoComplete="off"
              required
              aria-describedby="customer-amount-help customer-amount-estimate"
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="customer-currency">{t("paymentLink.currency")}</label>
            <select
              id="customer-currency"
              name="currency"
              className={inputClass}
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option>XMR</option>
              {(link.supported_currencies ?? []).map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </div>
        </div>
        <p id="customer-amount-estimate" aria-live="polite" className="min-h-6 text-ink">
          {estimate}
        </p>
        <p id="customer-amount-help" className="text-sm text-ink-soft">
          {t("paymentLink.amountHelp")}
          {link.minimum_amount_xmr
            ? ` ${t("paymentLink.minimum", { amount: formatXmrAmount(link.minimum_amount_xmr) })}`
            : ""}
        </p>
        <p>{t("paymentLink.customerFiatNote")}</p>
        <p>{t("paymentLink.directToWallet", { target: link.confirmation_target })}</p>
        <button className="min-h-11 justify-self-start rounded-full bg-ink px-6 py-3 text-cream">
          {t("paymentLink.create")}
        </button>
      </form>
      <p className="text-sm text-ink-soft">{t("paymentLink.separateInvoices")}</p>
    </>
  );
}

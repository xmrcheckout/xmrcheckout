"use client";

import { useEffect, useId, useState } from "react";
import CopyCodeBlock from "./copy-code-block";
import { useI18n } from "./i18n-provider";
import { buttonWidth, DEFAULT_BUTTON_SUB, paymentButtonHtml, paymentButtonImageUrl, validButtonText, type ButtonOptions, type ButtonTheme } from "../lib/payment-button";

const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-4 py-3 text-ink";
const codeClass = "overflow-x-auto rounded-xl bg-ink p-5 pt-16 font-mono text-sm text-cream";

// Edits are not saved: the copied HTML carries the colour and both lines.
export default function PaymentButtonEditor({ url, initialText, previewHref, autoCreate }: { url: string; initialText: string; previewHref: string; autoCreate: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const [theme, setTheme] = useState<ButtonTheme>("dark");
  const [text, setText] = useState(initialText);
  const [sub, setSub] = useState(DEFAULT_BUTTON_SUB);
  const textValid = validButtonText(text);
  const subValid = sub === "" || validButtonText(sub);
  const valid = textValid && subValid;
  const current: ButtonOptions = { text, sub, theme };
  const [preview, setPreview] = useState(current);

  // Wait for a pause in typing before requesting a new preview image.
  useEffect(() => {
    if (!valid) return;
    const timer = window.setTimeout(() => setPreview({ text, sub, theme }), 250);
    return () => window.clearTimeout(timer);
  }, [text, sub, theme, valid]);

  const field = (name: "text" | "sub", label: string, value: string, set: (value: string) => void, ok: boolean, help: string) => <div>
    <label htmlFor={`${id}-${name}`}>{label}</label>
    <input id={`${id}-${name}`} className={inputClass} value={value} maxLength={32} required={name === "text"} onChange={event => set(event.target.value)}
      aria-invalid={!ok} aria-describedby={`${id}-${name}-help`} />
    <p id={`${id}-${name}-help`} className={`mt-2 text-sm ${ok ? "text-ink-soft" : "text-red-700"}`}>{ok ? help : t("paymentLinks.buttonTextInvalid")}</p>
  </div>;

  return <div className="grid min-w-0 gap-4">
    <fieldset className="grid gap-1">
      <legend>{t("paymentLinks.buttonStyle")}</legend>
      {(["dark", "light"] as const).map(option => <label key={option} className="flex min-h-11 items-center gap-3">
        <input type="radio" name={`${id}-theme`} value={option} checked={theme === option} onChange={() => setTheme(option)} />
        {option === "dark" ? t("paymentLinks.themeDark") : t("paymentLinks.themeLight")}
      </label>)}
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      {field("text", t("paymentLinks.primaryText"), text, setText, textValid, t("paymentLinks.buttonTextLimit"))}
      {field("sub", t("paymentLinks.secondaryText"), sub, setSub, subValid, t("paymentLinks.secondaryTextHelp"))}
    </div>
    <div className={`grid min-w-0 justify-items-start gap-3 rounded-xl border border-stroke p-4 ${preview.theme === "dark" ? "bg-white/50" : "bg-ink"}`}>
      <p className={`text-sm ${preview.theme === "dark" ? "text-ink-soft" : "text-cream"}`}>{t("paymentLinks.buttonPreview")}</p>
      <a href={previewHref} className="inline-block max-w-full rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay">
        {/* eslint-disable-next-line @next/next/no-img-element -- the preview must load the same URL the copied HTML uses */}
        <img src={paymentButtonImageUrl(url, preview)} alt={t("paymentLinks.buttonAlt", { text: preview.text })} width={buttonWidth(preview.text, preview.sub)} height={80} className="block h-auto max-w-full" />
      </a>
      <p className={`text-sm ${preview.theme === "dark" ? "text-ink-soft" : "text-cream"}`}>{autoCreate ? t("paymentLinks.autoCreates") : t("paymentLinks.opensReview")}</p>
    </div>
    {valid ? <CopyCodeBlock className={codeClass} label={t("paymentLinks.htmlButton")}>{paymentButtonHtml(url, current)}</CopyCodeBlock>
      : <p role="status" className="text-sm text-red-700">{t("paymentLinks.buttonFixText")}</p>}
    <p className="text-sm text-ink-soft">{t("paymentLinks.pasteHtml", { behavior: autoCreate ? t("paymentLinks.graphicAuto") : t("paymentLinks.graphicReview") })}</p>
  </div>;
}

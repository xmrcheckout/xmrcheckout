"use client";

import { useEffect, useId, useState } from "react";
import CopyCodeBlock from "./copy-code-block";
import { useI18n } from "./i18n-provider";
import { buttonWidth, DEFAULT_BUTTON_SUB, paymentButtonHtml, paymentButtonImageUrl, validButtonText, type ButtonOptions } from "../lib/payment-button";

export const inputClass = "mt-1 w-full rounded-xl border border-stroke bg-white px-4 py-3 text-ink";
const codeClass = "overflow-x-auto rounded-xl bg-ink p-5 pt-16 font-mono text-sm text-cream";

export type ButtonDesign = ReturnType<typeof useButtonDesign>;

// Holds the button's colour and two lines. `preview` follows the current
// values after a pause in typing, so the image route is not hit on every key.
export function useButtonDesign(initial: ButtonOptions) {
  const [current, setCurrent] = useState(initial);
  const [preview, setPreview] = useState(initial);
  const textValid = validButtonText(current.text);
  const subValid = current.sub === "" || validButtonText(current.sub);
  const valid = textValid && subValid;
  useEffect(() => {
    if (!valid) return;
    const timer = window.setTimeout(() => setPreview(current), 250);
    return () => window.clearTimeout(timer);
  }, [current, valid]);
  const set = (change: Partial<ButtonOptions>) => setCurrent(value => ({ ...value, ...change }));
  return { current, preview, set, textValid, subValid, valid };
}

export function ButtonDesignFields({ design }: { design: ButtonDesign }) {
  const { t } = useI18n();
  const id = useId();
  const { current, set } = design;
  const field = (name: "text" | "sub", label: string, ok: boolean, help: string) => <div>
    <label htmlFor={`${id}-${name}`}>{label}</label>
    <input id={`${id}-${name}`} className={inputClass} value={current[name]} maxLength={32} required={name === "text"} onChange={event => set({ [name]: event.target.value })}
      aria-invalid={!ok} aria-describedby={`${id}-${name}-help`} />
    <p id={`${id}-${name}-help`} className={`mt-2 text-sm ${ok ? "text-ink-soft" : "text-red-700"}`}>{ok ? help : t("paymentLinks.buttonTextInvalid")}</p>
  </div>;
  return <>
    <fieldset className="grid gap-1">
      <legend>{t("paymentLinks.buttonStyle")}</legend>
      {(["dark", "light"] as const).map(option => <label key={option} className="flex min-h-11 items-center gap-3">
        <input type="radio" name={`${id}-theme`} value={option} checked={current.theme === option} onChange={() => set({ theme: option })} />
        {option === "dark" ? t("paymentLinks.themeDark") : t("paymentLinks.themeLight")}
      </label>)}
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      {field("text", t("paymentLinks.primaryText"), design.textValid, t("paymentLinks.buttonTextLimit"))}
      {field("sub", t("paymentLinks.secondaryText"), design.subValid, t("paymentLinks.secondaryTextHelp"))}
    </div>
  </>;
}

export function ButtonImage({ url, options, className = "block h-auto max-w-full" }: { url: string; options: ButtonOptions; className?: string }) {
  const { t } = useI18n();
  // eslint-disable-next-line @next/next/no-img-element -- the preview must load the same URL the copied HTML uses
  return <img src={paymentButtonImageUrl(url, options)} alt={t("paymentLinks.buttonAlt", { text: options.text })} width={buttonWidth(options.text, options.sub)} height={80} className={className} />;
}

// Edits are not saved: the copied HTML carries the colour and both lines.
export default function PaymentButtonEditor({ url, initialText, previewHref, autoCreate }: { url: string; initialText: string; previewHref: string; autoCreate: boolean }) {
  const { t } = useI18n();
  const design = useButtonDesign({ text: initialText, sub: DEFAULT_BUTTON_SUB, theme: "dark" });
  const { preview } = design;
  return <div className="grid min-w-0 gap-4">
    <ButtonDesignFields design={design} />
    <div className={`grid min-w-0 justify-items-start gap-3 rounded-xl border border-stroke p-4 ${preview.theme === "dark" ? "bg-white/50" : "bg-ink"}`}>
      <p className={`text-sm ${preview.theme === "dark" ? "text-ink-soft" : "text-cream"}`}>{t("paymentLinks.buttonPreview")}</p>
      <a href={previewHref} className="inline-block max-w-full rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay">
        <ButtonImage url={url} options={preview} />
      </a>
      <p className={`text-sm ${preview.theme === "dark" ? "text-ink-soft" : "text-cream"}`}>{autoCreate ? t("paymentLinks.autoCreates") : t("paymentLinks.opensReview")}</p>
    </div>
    {design.valid ? <CopyCodeBlock className={codeClass} label={t("paymentLinks.htmlButton")}>{paymentButtonHtml(url, design.current)}</CopyCodeBlock>
      : <p role="status" className="text-sm text-red-700">{t("paymentLinks.buttonFixText")}</p>}
    <p className="text-sm text-ink-soft">{t("paymentLinks.pasteHtml", { behavior: autoCreate ? t("paymentLinks.graphicAuto") : t("paymentLinks.graphicReview") })}</p>
  </div>;
}

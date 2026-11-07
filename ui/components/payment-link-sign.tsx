"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import QRCode from "qrcode";
import { useI18n } from "./i18n-provider";
import { ButtonDesignFields, ButtonImage, inputClass, useButtonDesign } from "./payment-button-editor";

export function SignQrCode({ url, className = "w-64 sm:w-80" }: { url: string; className?: string }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(svg => setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => setQr(null));
  }, [url]);
  if (!qr) return <p className="text-sm text-ink-soft">{t("paymentLinks.preparingQr")}</p>;
  return <Image src={qr} alt={t("paymentLinks.signQrAlt")} width={320} height={320} unoptimized data-qr-url={url} className={`h-auto max-w-full bg-white ${className}`} />;
}

export function PrintSignButton() {
  const { t } = useI18n();
  return <button type="button" onClick={() => window.print()} className="min-h-11 rounded-full bg-ink px-5 py-2 text-cream">{t("paymentLinks.printSign")}</button>;
}

type PaperSize = "full" | "half" | "card";

// Each size sets the printed page and scales the sign to fit it.
const sizes: Record<PaperSize, { page: string; article: string; header: string; heading: string; price: string; qr: string; cta: string; note: string }> = {
  full: { page: "@page { margin: 12mm; }", article: "max-w-2xl gap-5 p-8", header: "w-80", heading: "text-3xl", price: "text-2xl", qr: "w-64 sm:w-80", cta: "text-xl", note: "text-lg" },
  half: { page: "@page { size: A5; margin: 10mm; }", article: "max-w-md gap-4 p-6", header: "w-64", heading: "text-2xl", price: "text-xl", qr: "w-56", cta: "text-lg", note: "text-base" },
  card: { page: "@page { size: A6; margin: 6mm; }", article: "max-w-xs gap-3 p-4", header: "w-52", heading: "text-xl", price: "text-lg", qr: "w-40", cta: "text-base", note: "text-sm" },
};

// Nothing here is saved: the merchant arranges the sign, then prints it.
export function SignEditor({ url, title, price }: { url: string; title: string; price: string | null }) {
  const { t } = useI18n();
  const id = useId();
  const design = useButtonDesign({ text: t("paymentLinks.signPage.headerText"), sub: t("paymentLinks.signPage.headerSub"), theme: "dark" });
  const [showHeader, setShowHeader] = useState(true);
  const [heading, setHeading] = useState(title);
  const [note, setNote] = useState("");
  const [cta, setCta] = useState(() => t("paymentLinks.signPage.scan"));
  const [showPrice, setShowPrice] = useState(true);
  const [showUrl, setShowUrl] = useState(true);
  const [size, setSize] = useState<PaperSize>("full");
  const look = sizes[size];
  const text = (name: string, label: string, value: string, set: (value: string) => void, maxLength: number, placeholder?: string) => <div>
    <label htmlFor={`${id}-${name}`}>{label}</label>
    <input id={`${id}-${name}`} className={inputClass} value={value} maxLength={maxLength} placeholder={placeholder} onChange={event => set(event.target.value)} />
  </div>;
  const check = (label: string, checked: boolean, set: (value: boolean) => void) => <label className="flex min-h-11 items-center gap-3">
    <input type="checkbox" checked={checked} onChange={event => set(event.target.checked)} />{label}
  </label>;

  return <>
    <style>{`@media print { ${look.page} }`}</style>
    <section aria-labelledby={`${id}-title`} className="no-print mx-auto mt-6 grid max-w-2xl gap-4 rounded-2xl border border-stroke p-5">
      <div>
        <h2 id={`${id}-title`} className="font-sans text-xl font-semibold">{t("paymentLinks.signPage.editorTitle")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("paymentLinks.signPage.notSaved")}</p>
      </div>
      <fieldset className="grid gap-1">
        <legend>{t("paymentLinks.signPage.paperSize")}</legend>
        {([["full", t("paymentLinks.signPage.sizeFull")], ["half", t("paymentLinks.signPage.sizeHalf")], ["card", t("paymentLinks.signPage.sizeCard")]] as const).map(([option, label]) => <label key={option} className="flex min-h-11 items-center gap-3">
          <input type="radio" name={`${id}-size`} value={option} checked={size === option} onChange={() => setSize(option)} />
          {label}
        </label>)}
      </fieldset>
      {check(t("paymentLinks.signPage.showHeader"), showHeader, setShowHeader)}
      {showHeader ? <div className="grid gap-4 border-l-2 border-stroke pl-4"><ButtonDesignFields design={design} /></div> : null}
      {text("heading", t("paymentLinks.signPage.heading"), heading, setHeading, 120)}
      {text("note", t("paymentLinks.signPage.note"), note, setNote, 120, t("paymentLinks.signPage.notePlaceholder"))}
      {text("cta", t("paymentLinks.signPage.cta"), cta, setCta, 80)}
      <fieldset className="grid gap-1">
        <legend>{t("paymentLinks.signPage.show")}</legend>
        {price ? check(t("paymentLinks.signPage.showPrice"), showPrice, setShowPrice) : null}
        {check(t("paymentLinks.signPage.showUrl"), showUrl, setShowUrl)}
      </fieldset>
    </section>
    <article aria-label={t("paymentLinks.signPage.preview")} className={`print-sign mx-auto mt-8 grid justify-items-center rounded-2xl border border-stroke bg-white text-center ${look.article}`}>
      {showHeader ? <ButtonImage url={url} options={design.preview} className={`block h-auto max-w-full ${look.header}`} /> : null}
      {heading.trim() ? <p className={`break-words font-sans font-semibold ${look.heading}`}>{heading}</p> : null}
      {note.trim() ? <p className={`break-words ${look.note}`}>{note}</p> : null}
      {price && showPrice ? <p className={`font-semibold ${look.price}`}>{price}</p> : null}
      <SignQrCode url={url} className={look.qr} />
      {cta.trim() ? <p className={`break-words font-semibold ${look.cta}`}>{cta}</p> : null}
      {showUrl ? <p className="break-all font-mono text-sm text-ink-soft">{url}</p> : null}
    </article>
  </>;
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function SignQrCode({ url }: { url: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(svg => setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => setQr(null));
  }, [url]);
  if (!qr) return <p className="text-sm text-ink-soft">Preparing QR code…</p>;
  return <Image src={qr} alt="QR code for this payment link" width={320} height={320} unoptimized data-qr-url={url} className="h-auto w-64 max-w-full bg-white sm:w-80" />;
}

export function PrintSignButton() {
  return <button type="button" onClick={() => window.print()} className="min-h-11 rounded-full bg-ink px-5 py-2 text-cream">Print sign</button>;
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";

import {
  updateDefaultQrLogoAction,
  type DefaultQrLogoState,
} from "../app/(app)/dashboard/actions";

const buildInitialState = (logo: "monero" | "none" | "custom", logoDataUrl: string | null) => ({
  logo,
  logoDataUrl,
  error: null,
  success: null,
});

export default function DefaultQrLogoSection({
  initialLogo,
  initialLogoDataUrl,
}: {
  initialLogo: "monero" | "none" | "custom";
  initialLogoDataUrl: string | null;
}) {
  const router = useRouter();
  const [logo, setLogo] = useState<"monero" | "none" | "custom">(initialLogo);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(initialLogoDataUrl);
  const [state, formAction] = useFormState(
    updateDefaultQrLogoAction,
    buildInitialState(initialLogo, initialLogoDataUrl)
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  useEffect(() => {
    setLogo(initialLogo);
    setLogoDataUrl(initialLogoDataUrl);
  }, [initialLogo, initialLogoDataUrl]);

  const previewSrc = useMemo(() => {
    if (logo === "monero") {
      return "/monero-logo.svg";
    }
    if (logo === "custom") {
      return logoDataUrl;
    }
    return null;
  }, [logo, logoDataUrl]);

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setLogoDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-serif text-2xl">Default QR logo</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Applies to new invoices unless overridden at creation time.
        </p>
      </div>
      <form className="grid gap-4" action={formAction}>
        <div className="grid gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft"
            htmlFor="default_qr_logo"
          >
            Logo mode
          </label>
          <select
            className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
            id="default_qr_logo"
            name="default_qr_logo"
            value={logo}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "none" || value === "custom" || value === "monero") {
                setLogo(value);
              }
            }}
          >
            <option value="monero">Monero logo</option>
            <option value="none">No logo</option>
            <option value="custom">Custom image</option>
          </select>
        </div>

        {logo === "custom" ? (
          <div className="grid gap-2">
            <label
              className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft"
              htmlFor="default_qr_logo_file"
            >
              Custom logo image
            </label>
            <input
              className="w-full rounded-xl border border-stroke bg-white/80 px-4 py-3 text-sm text-ink"
              id="default_qr_logo_file"
              type="file"
              accept="image/*"
              onChange={handleLogoFileChange}
            />
            <p className="text-sm text-ink-soft">
              Stored as a data URL for use on public invoice pages. Keep it small.
            </p>
            {logoDataUrl ? (
              <button
                className="inline-flex w-fit items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
                type="button"
                onClick={() => setLogoDataUrl(null)}
              >
                Remove image
              </button>
            ) : null}
          </div>
        ) : null}

        <input
          type="hidden"
          name="default_qr_logo_data_url"
          value={logo === "custom" ? logoDataUrl ?? "" : ""}
        />

        {previewSrc ? (
          <div className="flex items-center gap-3 rounded-2xl border border-stroke bg-white/70 p-4 shadow-soft">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_6px_12px_rgba(16,18,23,0.18)]">
              <Image
                src={previewSrc}
                alt="QR logo preview"
                width={32}
                height={32}
                unoptimized={logo === "custom"}
              />
            </span>
            <p className="text-sm text-ink-soft">Preview (used in the QR center).</p>
          </div>
        ) : null}

        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {state.success}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-[0_16px_30px_rgba(16,18,23,0.18)] transition hover:-translate-y-0.5"
            type="submit"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}


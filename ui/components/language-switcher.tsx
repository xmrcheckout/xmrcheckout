"use client";

import { useId } from "react";

import { setLocaleAction } from "../app/locale-actions";
import { localeNames, locales } from "../lib/i18n/config";
import { useI18n } from "./i18n-provider";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  const id = useId();
  return (
    <form action={setLocaleAction} className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <label htmlFor={id}>{t("language.label")}</label>
      {/* React resets a form after its action runs, restoring each field's
          initial default. Remounting on locale change makes that default the
          newly chosen language instead of the previous one. */}
      <select
        key={locale}
        id={id}
        name="locale"
        defaultValue={locale}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="min-h-11 max-w-full rounded-xl border border-[#71716c] bg-white px-3 py-2 text-ink"
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="min-h-11 px-3 py-2 underline underline-offset-4">
          {t("language.apply")}
        </button>
      </noscript>
    </form>
  );
}

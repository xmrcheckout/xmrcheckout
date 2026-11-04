"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Locale } from "../lib/i18n/config";
import { createTranslator, type Messages, type Translate } from "../lib/i18n/translate";

type I18nValue = { locale: Locale; t: Translate };

const I18nContext = createContext<I18nValue | null>(null);

// One translator per locale keeps `t` stable across router refreshes, which
// resend the catalog as a new object. Effects that depend on `t` then rerun
// only when the language changes.
const translators = new Map<Locale, Translate>();
const translatorFor = (locale: Locale, messages: Messages): Translate => {
  let t = translators.get(locale);
  if (!t) {
    t = createTranslator(locale, messages);
    translators.set(locale, t);
  }
  return t;
};

export default function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: translatorFor(locale, messages) }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}

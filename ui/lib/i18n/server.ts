import { cache } from "react";
import { cookies, headers } from "next/headers";

import { getTranslator } from "./catalogs";
import { isLocale, localeCookie, matchLocale, type Locale } from "./config";

/** The visitor's chosen language, else their browser's, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(localeCookie)?.value;
  if (isLocale(chosen)) return chosen;
  return matchLocale((await headers()).get("accept-language"));
});

export const getI18n = cache(async () => {
  const locale = await getLocale();
  return { locale, t: getTranslator(locale) };
});

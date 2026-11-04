import en from "../../messages/en.json";
import es from "../../messages/es.json";
import type { Locale } from "./config";
import { createTranslator, mergeMessages, type Messages, type Translate } from "./translate";

const catalogs: Record<Locale, Messages> = {
  en,
  es: mergeMessages(en, es),
};

export const getCatalog = (locale: Locale): Messages => catalogs[locale];

export const getTranslator = (locale: Locale): Translate =>
  createTranslator(locale, catalogs[locale]);

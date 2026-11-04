import en from "../../messages/en.json";
import es from "../../messages/es.json";
import ru from "../../messages/ru.json";
import de from "../../messages/de.json";
import type { Locale } from "./config";
import { createTranslator, mergeMessages, type Messages, type Translate } from "./translate";

const catalogs: Record<Locale, Messages> = {
  en,
  es: mergeMessages(en, es),
  ru: mergeMessages(en, ru),
  de: mergeMessages(en, de),
};

export const getCatalog = (locale: Locale): Messages => catalogs[locale];

export const getTranslator = (locale: Locale): Translate =>
  createTranslator(locale, catalogs[locale]);

import en from "../../messages/en.json";
import es from "../../messages/es.json";
import ru from "../../messages/ru.json";
import de from "../../messages/de.json";
import fr from "../../messages/fr.json";
import pt from "../../messages/pt.json";
import it from "../../messages/it.json";
import pl from "../../messages/pl.json";
import zh from "../../messages/zh.json";
import uk from "../../messages/uk.json";
import cs from "../../messages/cs.json";
import type { Locale } from "./config";
import { createTranslator, mergeMessages, type Messages, type Translate } from "./translate";

const catalogs: Record<Locale, Messages> = {
  en,
  es: mergeMessages(en, es),
  ru: mergeMessages(en, ru),
  de: mergeMessages(en, de),
  fr: mergeMessages(en, fr),
  pt: mergeMessages(en, pt),
  it: mergeMessages(en, it),
  pl: mergeMessages(en, pl),
  zh: mergeMessages(en, zh),
  uk: mergeMessages(en, uk),
  cs: mergeMessages(en, cs),
};

export const getCatalog = (locale: Locale): Messages => catalogs[locale];

export const getTranslator = (locale: Locale): Translate =>
  createTranslator(locale, catalogs[locale]);

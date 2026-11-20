import type en from "../../messages/en.json";
import type { TranslationValues } from "./translate";

// Dotted paths to every message in en.json. A plural message (an object with
// an "other" form) counts as one leaf, so no other key may be named "other".
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends { other: string }
      ? `${P}${K}`
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof en>;

/** The app's translator: only keys that exist in en.json type-check. */
export type T = (key: MessageKey, values?: TranslationValues) => string;

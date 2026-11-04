// A small, dependency-free message translator.
//
// Messages are nested JSON objects addressed with dotted keys. Strings may use
// {name} placeholders. A message that varies by count is an object of plural
// forms ("one", "other", ...) selected with Intl.PluralRules from values.count.
export type Messages = { [key: string]: string | Messages };
export type TranslationValues = Record<string, string | number>;
export type Translate = (key: string, values?: TranslationValues) => string;

export function mergeMessages(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      typeof value === "object" && typeof current === "object"
        ? mergeMessages(current, value)
        : value;
  }
  return merged;
}

export function createTranslator(locale: string, messages: Messages): Translate {
  const plurals = new Intl.PluralRules(locale);
  return (key, values = {}) => {
    let entry: string | Messages | undefined = messages;
    for (const part of key.split(".")) {
      entry = typeof entry === "object" ? entry[part] : undefined;
    }
    if (typeof entry === "object" && typeof values.count === "number") {
      entry = entry[plurals.select(values.count)] ?? entry.other;
    }
    // A missing key is shown as-is so it is noticed; tests check every key exists.
    if (typeof entry !== "string") return key;
    return entry.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}

export type RichSegment = { tag: string | null; text: string };

/**
 * Splits a translated string on simple <tag>text</tag> markers so a component
 * can wrap parts in links or emphasis without putting markup in translations.
 */
export function splitRich(message: string): RichSegment[] {
  const segments: RichSegment[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  for (const match of message.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ tag: null, text: message.slice(last, start) });
    segments.push({ tag: match[1], text: match[2] });
    last = start + match[0].length;
  }
  if (last < message.length) segments.push({ tag: null, text: message.slice(last) });
  return segments;
}

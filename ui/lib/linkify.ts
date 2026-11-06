export type MessageSegment =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; href: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'")\]}]+$/;

/** The parsed link when the value is an http(s) URL with a host; null for anything else. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname) return parsed.href;
  } catch {
    // Not an absolute URL.
  }
  return null;
}

/** Split merchant plain text into text and http(s) link segments; never emits HTML. */
export function linkifyMessage(message: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last?.kind === "text") last.text += text;
    else segments.push({ kind: "text", text });
  };
  for (const match of message.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let candidate = match[0];
    const trailing = candidate.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    // Keep a closing bracket that balances one inside the URL.
    let kept = "";
    for (const char of trailing) {
      const open = char === ")" ? "(" : char === "]" ? "[" : char === "}" ? "{" : null;
      const body = candidate.slice(0, candidate.length - trailing.length) + kept;
      if (open && body.split(open).length > body.split(char).length) kept += char;
      else break;
    }
    candidate = candidate.slice(0, candidate.length - trailing.length) + kept;
    pushText(message.slice(cursor, start));
    const href = safeHttpUrl(candidate);
    if (href) segments.push({ kind: "link", text: candidate, href });
    else pushText(candidate);
    cursor = start + candidate.length;
  }
  pushText(message.slice(cursor));
  return segments;
}

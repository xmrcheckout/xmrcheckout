import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buttonSvg, DEFAULT_BUTTON_SUB, DEFAULT_BUTTON_TEXT, primaryTextWidth, validButtonText } from "../../../lib/payment-button";

export const runtime = "nodejs";

const headers = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=86400",
  "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
};
const invalid = () => new Response("Button text must contain 1–32 printable characters.", { status: 400 });
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

let template: Promise<string> | null = null;
const loadTemplate = () => template ??= readFile(join(process.cwd(), "public/buttons/buy-with-monero.svg"), "utf8");

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const text = params.get("text") ?? DEFAULT_BUTTON_TEXT;
  if (!validButtonText(text)) return invalid();
  const svgTemplate = await loadTemplate();

  // Snippets copied before themes existed carry only `text`: keep them pixel-identical.
  if (!params.has("theme") && !params.has("sub")) {
    const fit = primaryTextWidth(text) > 180 ? ' textLength="180" lengthAdjust="spacingAndGlyphs"' : "";
    const svg = svgTemplate.replace("Buy with Monero via xmrcheckout", () => escape(`${text} via xmrcheckout`))
      .replace('font-weight="700">Buy with Monero</text>', () => `font-weight="700"${fit}>${escape(text)}</text>`);
    return new Response(svg, { headers });
  }

  const theme = params.get("theme") ?? "dark";
  const sub = params.get("sub") ?? DEFAULT_BUTTON_SUB;
  if ((theme !== "dark" && theme !== "light") || (sub !== "" && !validButtonText(sub))) return invalid();
  const logo = svgTemplate.match(/xlink:href="(data:image\/png;base64,[^"]+)"/)?.[1];
  if (!logo) return new Response("Button graphic unavailable.", { status: 500 });
  return new Response(buttonSvg({ text, sub, theme }, logo), { headers });
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const label = new URL(request.url).searchParams.get("text") ?? "Buy with Monero";
  if (!label.trim() || Array.from(label).length > 32 || /[\u0000-\u001f\u007f-\u009f]/u.test(label)) {
    return new Response("Button text must contain 1–32 printable characters.", { status: 400 });
  }
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  const template = await readFile(join(process.cwd(), "public/buttons/buy-with-monero.svg"), "utf8");
  const estimatedWidth = Array.from(label).reduce((width, char) => width +
    (/\s/u.test(char) ? 6 : /[MW@%]/u.test(char) ? 18 : /[A-Z]/u.test(char) ? 14 : /[a-z0-9]/u.test(char) ? 11 : 18), 0);
  const fit = estimatedWidth > 180 ? ' textLength="180" lengthAdjust="spacingAndGlyphs"' : "";
  const svg = template.replace("Buy with Monero via xmrcheckout", () => escape(`${label} via xmrcheckout`))
    .replace('font-weight="700">Buy with Monero</text>', () => `font-weight="700"${fit}>${escape(label)}</text>`);
  return new Response(svg, { headers: {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
    "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
  } });
}

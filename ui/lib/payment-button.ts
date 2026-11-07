const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const escapeXml = (value: string) => escapeHtml(value).replaceAll("'", "&apos;");

export type ButtonTheme = "dark" | "light";
export type ButtonOptions = { text: string; sub: string; theme: ButtonTheme };

export const DEFAULT_BUTTON_TEXT = "Buy with Monero";
export const DEFAULT_BUTTON_SUB = "xmrcheckout";
export const BUTTON_HEIGHT = 80;
const TEXT_X = 82;
const RIGHT_PADDING = 28;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;
const MAX_TEXT_WIDTH = MAX_WIDTH - TEXT_X - RIGHT_PADDING;

// Each line on the graphic must hold 1–32 printable characters.
export function validButtonText(value: string) {
  return value.trim().length > 0 && Array.from(value).length <= 32 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

// Rough glyph widths for the bold 18px first line, in pixels.
export function primaryTextWidth(text: string) {
  return Array.from(text).reduce((width, char) => width +
    (/\s/u.test(char) ? 6 : /[MW@%]/u.test(char) ? 18 : /[A-Z]/u.test(char) ? 14 : /[a-z0-9]/u.test(char) ? 11 : 18), 0);
}

// The 13px second line is about 0.72 of the first line's size, plus letter spacing.
export function secondaryTextWidth(text: string) {
  return Math.ceil(primaryTextWidth(text) * 0.72 + Array.from(text).length * 0.6);
}

export function buttonWidth(text: string, sub: string) {
  const widest = Math.max(primaryTextWidth(text), sub ? secondaryTextWidth(sub) : 0);
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, TEXT_X + widest + RIGHT_PADDING));
}

const themes = {
  dark: { frame: '<rect width="WIDTH" height="80" rx="40" fill="#101217"/>', primary: "#f8f2e9", secondary: "#f1e5d2" },
  light: { frame: '<rect x="1" y="1" width="INNER" height="78" rx="39" fill="#f8f2e9" stroke="#101217" stroke-width="2"/>', primary: "#101217", secondary: "#3d3a36" },
} as const;

// Builds the button graphic. logoHref is the data URI of the round Monero logo.
export function buttonSvg({ text, sub, theme }: ButtonOptions, logoHref: string) {
  const width = buttonWidth(text, sub);
  const colors = themes[theme];
  const squeeze = (measured: number) => measured > MAX_TEXT_WIDTH ? ` textLength="${MAX_TEXT_WIDTH}" lengthAdjust="spacingAndGlyphs"` : "";
  const title = `${text} via xmrcheckout`;
  const lines = sub
    ? `<text x="${TEXT_X}" y="36" fill="${colors.primary}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700"${squeeze(primaryTextWidth(text))}>${escapeXml(text)}</text>
  <text x="${TEXT_X}" y="57" fill="${colors.secondary}" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="0.6"${squeeze(secondaryTextWidth(sub))}>${escapeXml(sub)}</text>`
    : `<text x="${TEXT_X}" y="46" fill="${colors.primary}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700"${squeeze(primaryTextWidth(text))}>${escapeXml(text)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${BUTTON_HEIGHT}" viewBox="0 0 ${width} ${BUTTON_HEIGHT}" role="img" aria-labelledby="title">
  <title id="title">${escapeXml(title)}</title>
  ${colors.frame.replace("WIDTH", String(width)).replace("INNER", String(width - 2))}
  <defs><clipPath id="logo"><rect x="12" y="12" width="56" height="56" rx="28"/></clipPath></defs>
  <image x="12" y="12" width="56" height="56" clip-path="url(#logo)" xlink:href="${escapeXml(logoHref)}"/>
  ${lines}
</svg>
`;
}

// Without options the snippet points at the static default graphic.
export function paymentButtonImageUrl(url: string, options?: ButtonOptions) {
  if (!options) return new URL("/buttons/buy-with-monero.svg", url).href;
  const image = new URL("/buttons/payment.svg", url);
  image.searchParams.set("theme", options.theme);
  image.searchParams.set("text", options.text);
  image.searchParams.set("sub", options.sub);
  return image.href;
}

export function paymentButtonHtml(url: string, options?: ButtonOptions) {
  const text = options?.text ?? DEFAULT_BUTTON_TEXT;
  const width = options ? buttonWidth(options.text, options.sub) : 280;
  return `<a href="${escapeHtml(url)}">\n  <img src="${escapeHtml(paymentButtonImageUrl(url, options))}" alt="${escapeHtml(`${text} via xmrcheckout`)}" width="${width}" height="${BUTTON_HEIGHT}" style="display:block;max-width:100%;height:auto;border:0;" />\n</a>`;
}

type SignPriceFields = { customer_amount: boolean; amount_xmr: string | null; amount_fiat: string | null };

// Signs show a price only for links fixed in XMR. Fiat-priced links are
// converted at invoice time, so a printed fiat figure could mislead payers.
export function signXmrAmount(link: SignPriceFields): string | null {
  return !link.customer_amount && link.amount_xmr && !link.amount_fiat ? link.amount_xmr : null;
}

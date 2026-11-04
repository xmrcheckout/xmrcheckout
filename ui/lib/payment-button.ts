const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function paymentButtonImageUrl(url: string, buttonText?: string) {
  if (buttonText === undefined) return new URL("/buttons/buy-with-monero.svg", url).href;
  const image = new URL("/buttons/payment.svg", url);
  image.searchParams.set("text", buttonText);
  return image.href;
}

export function paymentButtonHtml(url: string, buttonText?: string) {
  return `<a href="${escapeHtml(url)}">\n  <img src="${escapeHtml(paymentButtonImageUrl(url, buttonText))}" alt="${escapeHtml(`${buttonText ?? "Buy with Monero"} via xmrcheckout`)}" width="280" height="80" style="display:block;max-width:100%;height:auto;border:0;" />\n</a>`;
}

export type BadgeVariant = "dark" | "light";

export function badgeImageUrl(siteUrl: string, variant: BadgeVariant = "dark") {
  return new URL(variant === "light" ? "/badges/monero-accepted-here-light.svg" : "/badges/monero-accepted-here.svg", siteUrl).href;
}

export function badgeHtml(siteUrl: string, variant: BadgeVariant = "dark") {
  return `<img src="${escapeHtml(badgeImageUrl(siteUrl, variant))}" alt="Monero accepted here" width="300" height="80" style="display:block;max-width:100%;height:auto;border:0;" />`;
}

type SignPriceFields = { customer_amount: boolean; amount_xmr: string | null; amount_fiat: string | null };

// Signs show a price only for links fixed in XMR. Fiat-priced links are
// converted at invoice time, so a printed fiat figure could mislead payers.
export function signXmrAmount(link: SignPriceFields): string | null {
  return !link.customer_amount && link.amount_xmr && !link.amount_fiat ? link.amount_xmr : null;
}

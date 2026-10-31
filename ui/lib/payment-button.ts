export function paymentButtonImageUrl(url: string, buttonText?: string) {
  if (buttonText === undefined) return new URL("/buttons/buy-with-monero.svg", url).href;
  const image = new URL("/buttons/payment.svg", url);
  image.searchParams.set("text", buttonText);
  return image.href;
}

export function paymentButtonHtml(url: string, buttonText?: string) {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<a href="${escape(url)}">\n  <img src="${escape(paymentButtonImageUrl(url, buttonText))}" alt="${escape(`${buttonText ?? "Buy with Monero"} via xmrcheckout`)}" width="280" height="80" style="display:block;max-width:100%;height:auto;border:0;" />\n</a>`;
}

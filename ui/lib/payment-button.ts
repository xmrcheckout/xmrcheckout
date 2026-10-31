export function paymentButtonImageUrl(url: string) {
  return new URL("/buttons/buy-with-monero.svg", url).href;
}

export function paymentButtonHtml(url: string) {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<a href="${escape(url)}">\n  <img src="${escape(paymentButtonImageUrl(url))}" alt="Buy with Monero via xmrcheckout" width="280" height="80" style="display:block;max-width:100%;height:auto;border:0;" />\n</a>`;
}

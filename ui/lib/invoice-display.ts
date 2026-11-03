const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function invoiceLookupId(value: string, origin: string): string | null {
  const input = value.trim();
  if (uuid.test(input)) return input;
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) return null;
    const match = url.pathname.match(/^\/(?:invoice|i)\/([^/]+)$/);
    return match && uuid.test(match[1]) ? match[1] : null;
  } catch { return null; }
}

export function invoiceContext(metadata: unknown): { title: string | null; details: string[] } {
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const data = record(metadata);
  const product = record(data.payment_link);
  let woo: Record<string, unknown> = {};
  if (typeof data.posData === 'string') {
    try { woo = record(record(JSON.parse(data.posData)).WooCommerce); } catch { /* Malformed optional metadata has no display context. */ }
  }
  const order = text(data.order_id) || text(woo['Order Number']) || text(woo['Order ID']) || (typeof woo['Order ID'] === 'number' ? String(woo['Order ID']) : null);
  const terminal = record(data.terminal);
  const sale = text(terminal.name) ? `Terminal: ${text(terminal.name)}${text(terminal.note) ? ` · ${text(terminal.note)}` : ''}` : null;
  const details = [text(data.description), text(product.title), sale, order ? `Order ${order}` : null, text(data.recipient_name)].filter((value): value is string => Boolean(value));
  return { title: details[0] ?? null, details: [...new Set(details)] };
}

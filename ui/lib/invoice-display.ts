const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function invoiceLookupId(value: string, origin: string): string | null {
  const input = value.trim();
  if (uuid.test(input)) return input;
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) return null;
    // Invoice, BTCPay, receipt and older donation page links all name the invoice.
    const match = url.pathname.match(/^\/(?:(?:invoice|donate)\/([^/]+)|i\/([^/]+)(?:\/receipt)?)$/);
    const found = match ? (match[1] ?? match[2]) : null;
    return found && uuid.test(found) ? found : null;
  } catch { return null; }
}

export type InvoiceSource = 'payment_link' | 'terminal';

// `orderLabel` lets callers translate the order-number line.
export function invoiceContext(
  metadata: unknown,
  orderLabel: (order: string) => string = (order) => `Order ${order}`,
): { title: string | null; details: string[]; source: InvoiceSource | null } {
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
  // The source badge names the terminal, so the sale line carries only its name and note.
  const sale = text(terminal.name) ? `${text(terminal.name)}${text(terminal.note) ? ` · ${text(terminal.note)}` : ''}` : null;
  const source: InvoiceSource | null = data.origin === 'terminal' || (data.origin === undefined && sale) ? 'terminal'
    : data.origin === 'payment_link' || (data.origin === undefined && text(product.title)) ? 'payment_link' : null;
  const details = [text(data.description), text(product.title), sale, order ? orderLabel(order) : null, text(data.recipient_name)].filter((value): value is string => Boolean(value));
  return { title: details[0] ?? null, details: [...new Set(details)], source };
}

export function invoiceSourceLabel(source: InvoiceSource | null, t: (key: string) => string): string | null {
  if (source === 'terminal') return t('dashboard.invoices.sourceTerminal');
  if (source === 'payment_link') return t('dashboard.invoices.sourcePaymentLink');
  return null;
}

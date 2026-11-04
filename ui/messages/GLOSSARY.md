# Translation glossary

UI text is a regulatory and trust surface (see DESIGN_PRINCIPLES.md §9).
Translations must describe the same non-custodial reality as the English
source: funds go directly to the merchant's wallet, and XMR Checkout only
detects payments with view-only access.

`tests/i18n.test.mjs` fails if a forbidden term below appears in a catalog.
Add new languages to both this file and the `forbidden` table in that test.

## Rules for every language

- Never translate XMR amounts, addresses, payment URIs, invoice IDs, API
  field names, or code. Amounts typed or copied into wallets always use `.` as
  the decimal separator.
- Keep `{placeholders}` exactly as in English. Keep `<tag>…</tag>` markers and
  translate only the text between them.
- Plural messages are objects with Intl.PluralRules forms (`one`, `other`,
  and any others the language needs).
- Do not imply custody, reversibility, guaranteed rates, or that the service
  holds, moves, or pays out funds.

## English (source)

| Use | Avoid |
| --- | --- |
| checkout, invoice, detection, confirmation, relay, automation | processor (except "not a payment processor"), settlement, payout, balance, payments company |

## Spanish (`es`)

Informal *tú* throughout. "Merchant" is *el comercio*.

| English | Spanish |
| --- | --- |
| checkout | pago / página de pago (product name "XMR Checkout" stays as is) |
| invoice | factura |
| payment detected | pago detectado |
| confirmation | confirmación |
| view-only / view key | de solo lectura / clave de visualización |
| wallet | billetera |
| subaddress | subdirección |
| expired | vencida |
| on-chain | en la cadena de bloques |
| fiat (reference) | moneda fiduciaria (de referencia) |

| Avoid (Spanish) | Why |
| --- | --- |
| procesador (de pagos) | implies a payment processor; allowed only as "no es un procesador de pagos" |
| liquidación, liquidar | "settlement" |
| desembolso, retiro, retirar fondos | "payout" / withdrawal implies custody |
| saldo | "balance" implies held funds |
| empresa de pagos | "payments company" |

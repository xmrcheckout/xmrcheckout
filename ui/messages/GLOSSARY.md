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

## Russian (`ru`)

Formal *вы* throughout, lowercase. "Merchant" is *продавец*, "customer" is
*покупатель*. Use *ё* in *платёж*, *счёт*, *кошелёк*.

| English | Russian |
| --- | --- |
| checkout | оплата / страница оплаты (product name "XMR Checkout" stays as is) |
| invoice | счёт (plural *счета*) |
| payment detected | платёж обнаружен |
| confirmation | подтверждение |
| view-only / view key | только для просмотра / ключ просмотра |
| spend key / seed | ключ траты / сид-фраза |
| wallet | кошелёк |
| subaddress | субадрес |
| expired | истёк (срок действия истёк) |
| on-chain | в блокчейне |
| fiat (reference) | фиатная валюта (справочный ориентир) |
| webhook / endpoint | вебхук / конечная точка |
| dashboard | панель управления |
| self-host | разместить у себя |

| Avoid (Russian) | Why |
| --- | --- |
| процессор, процессинг | implies a payment processor; allowed only as "не является платёжным процессором" |
| расчёт, взаиморасчёты | "settlement" (use *пересчитывается* for conversion) |
| выплата, вывод/снятие средств | "payout" / withdrawal implies custody |
| баланс | "balance" implies held funds |
| платёжная компания | "payments company" |

## German (`de`)

Formal *Sie* throughout. "Merchant" is *der Händler*, "customer" is
*der Kunde*. Common English terms used by German Monero users stay as is:
*Wallet* (feminine, *die Wallet*), *View-Key*, *Spend-Key*, *Seed*, *Webhook*,
*Dashboard*.

| English | German |
| --- | --- |
| checkout | Checkout / Zahlungsseite (product name "XMR Checkout" stays as is) |
| invoice | Rechnung |
| payment detected | Zahlung erkannt |
| confirmation | Bestätigung |
| view-only / view key | nur Lesezugriff / Wallet mit Lesezugriff / privater View-Key |
| spend key / seed | Spend-Key / Wiederherstellungs-Seed |
| subaddress | Subadresse |
| expired | abgelaufen |
| on-chain | in der Blockchain |
| fiat (reference) | Fiat-Richtwert / Richtkurs |
| custody / non-custodial | Verwahrung / ohne Verwahrung |
| reconciler | Abgleichdienst |
| self-host | selbst hosten |

| Avoid (German) | Why |
| --- | --- |
| Zahlungsabwickler, Zahlungsdienstleister, Prozessor | implies a payment processor; allowed only as "kein Zahlungsabwickler" |
| Abrechnung, abrechnen | "settlement" |
| Auszahlung, auszahlen, Abhebung, abheben | "payout" / withdrawal implies custody |
| Guthaben, Saldo, Kontostand | "balance" implies held funds |
| Zahlungsunternehmen | "payments company" |

## French (`fr`)

Formal *vous* throughout. "Merchant" is *le commerçant*, "customer" is
*le client*. Use typographic apostrophes (’). *Webhook* stays as is, and
menu labels of wallets without a French interface (e.g. *Settings → Wallet*)
stay in English.

| English | French |
| --- | --- |
| checkout | paiement / page de paiement (product name "XMR Checkout" stays as is) |
| invoice | facture |
| payment detected | paiement détecté |
| confirmation | confirmation |
| view-only / view key | en lecture seule / clé de visualisation (privée) |
| spend key / seed | clé de dépense / phrase de récupération (seed) |
| wallet | portefeuille |
| subaddress | sous-adresse |
| expired | expirée |
| on-chain | sur la blockchain |
| fiat (reference) | monnaie fiduciaire (de référence) |
| custody / non-custodial | garde / sans garde des fonds |
| reconciler | service de rapprochement |
| allowance | quota |
| endpoint | point de terminaison |
| dashboard | tableau de bord |
| self-host | auto-héberger |

| Avoid (French) | Why |
| --- | --- |
| processeur / prestataire de paiement | implies a payment processor; allowed only as "n’est pas un processeur de paiement" |
| règlement | "settlement" |
| versement, retrait, retirer des fonds | "payout" / withdrawal implies custody |
| solde | "balance" implies held funds |
| société / entreprise de paiement | "payments company" |

## Portuguese (`pt`)

Brazilian Portuguese, informal *você* throughout. "Merchant" is
*o comerciante*, "customer" is *o cliente*. *Webhook*, *endpoint*, *payload*
and *handler* stay as is, and menu labels of wallets without a Portuguese
interface (e.g. *Settings → Wallet*) stay in English.

| English | Portuguese |
| --- | --- |
| checkout | pagamento / página de pagamento (product name "XMR Checkout" stays as is) |
| invoice | fatura |
| payment detected | pagamento detectado |
| confirmation | confirmação |
| confirmation target | meta de confirmações |
| view-only / view key | somente leitura / chave de visualização (privada) |
| spend key / seed | chave de gasto / frase de recuperação (seed) |
| wallet | carteira |
| subaddress | subendereço |
| expired | expirada |
| on-chain | na blockchain |
| fiat (reference) | moeda fiduciária (de referência) |
| rate / quote | cotação |
| custody / non-custodial | custódia / sem custódia |
| reconciler | serviço de conciliação |
| allowance | cota |
| relay (events) | encaminhar |
| dashboard | painel |
| self-host | auto-hospedar |

| Avoid (Portuguese) | Why |
| --- | --- |
| processador / intermediador de pagamento | implies a payment processor; allowed only as "não é um processador" |
| liquidação, liquidar | "settlement" |
| repasse | "payout" to the merchant |
| saque, sacar, retirada/retirar fundos | withdrawal implies custody |
| saldo | "balance" implies held funds |
| empresa de pagamentos | "payments company" |

## Italian (`it`)

Informal *tu* throughout. "Merchant" is *l'esercente*, "customer" is
*il cliente*. *Webhook*, *endpoint*, *dashboard* (feminine, *la dashboard*),
*payload* and *self-hosting* stay as is, and menu labels of wallets without an
Italian interface (e.g. *Settings → Wallet*) stay in English.

| English | Italian |
| --- | --- |
| checkout | pagamento / pagina di pagamento (product name "XMR Checkout" stays as is) |
| invoice | fattura |
| payment detected | pagamento rilevato |
| confirmation | conferma |
| confirmation target | obiettivo di conferme |
| view-only / view key | in sola lettura / chiave di visualizzazione (privata) |
| spend key / seed | chiave di spesa / frase di recupero (seed) |
| wallet | portafoglio |
| subaddress | sottoindirizzo |
| expired | scaduta |
| on-chain | sulla blockchain |
| fiat (reference) | valuta fiat (di riferimento) |
| rate / quote | tasso / quotazione |
| custody / non-custodial | custodia / senza custodia |
| reconciler | servizio di riconciliazione |
| allowance | quota |
| snapshot | istantanea |
| relay (events) | inoltrare |
| self-host | ospitare in autonomia |

| Avoid (Italian) | Why |
| --- | --- |
| processore / elaboratore di pagamenti, istituto di pagamento | implies a payment processor; allowed only as "non è un processore" |
| liquidazione, regolamento | "settlement" |
| erogazione, accredito / accreditare | "payout" / crediting implies the service moves funds |
| prelievo, prelevare | withdrawal implies custody |
| saldo | "balance" implies held funds |
| società di pagamenti | "payments company" |

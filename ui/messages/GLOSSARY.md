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
| invoice | richiesta di pagamento (plural *richieste di pagamento*); for API calls use *chiamata*, not *richiesta* |
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
| fattura | a formal tax document in Italy (mandatory e-invoicing); XMR Checkout does not issue one |

## Polish (`pl`)

Informal *ty* throughout (lowercase), and gender-neutral phrasing: avoid
second-person past tense (*zgubiłeś*) and adjectives such as *gotowy* that
assume the reader's gender. "Merchant" is *sprzedawca*, "customer" is
*klient*. *Webhook* (plural *webhooki*), *endpoint*, *seed* and *checkout* stay
as is, and menu labels of wallets without a Polish interface (e.g.
*Settings → Wallet*) stay in English. Plural messages need `one`, `few`,
`many` and `other`.

| English | Polish |
| --- | --- |
| checkout | płatność / strona płatności (product name "XMR Checkout" stays as is) |
| invoice | prośba o płatność (plural *prośby o płatność*, genitive plural *próśb o płatność*); for API calls use *wywołanie* |
| receipt | potwierdzenie płatności |
| payment detected | wykryto płatność |
| confirmation / confirmation target | potwierdzenie / (wymagana) liczba potwierdzeń |
| view-only / view key | tylko do odczytu / (prywatny) klucz widoku |
| spend key / seed | klucz wydawania / fraza odzyskiwania (seed) |
| wallet | portfel |
| subaddress | podadres |
| expired | wygasła |
| on-chain | w blockchainie |
| fiat (reference) | waluta fiat (wartość orientacyjna) |
| rate / quote | kurs / notowanie |
| custody / non-custodial | przechowywanie środków / bez powierzania środków |
| reconciler | usługa uzgadniania |
| allowance | limit |
| address capacity | pula adresów |
| snapshot | migawka |
| relay (events) | przekazywać |
| dashboard | panel |
| self-host | hostować samodzielnie |

| Avoid (Polish) | Why |
| --- | --- |
| procesor / operator płatności, agent rozliczeniowy | implies a payment processor; allowed only as "nie jest procesorem płatności" |
| rozliczenie, rozliczać | "settlement" |
| wypłata, wypłacać | "payout" / withdrawal implies custody |
| saldo | "balance" implies held funds |
| instytucja / firma płatnicza | "payments company" |
| faktura, rachunek | formal tax documents in Poland (mandatory KSeF e-invoicing); *rachunek* also means a bank account |

## Simplified Chinese (`zh`)

Mainland Simplified Chinese, informal *你* throughout. "Merchant" is *商家*,
"customer" is *顾客*. Use full-width punctuation (，。：；？！（）) in Chinese
text, with a space between Chinese and Latin words or numbers (*12 位小数*,
*XMR 账单*). *Webhook*, *API*, *URL*, *HTTPS* and code stay as is, and menu
labels of wallets (e.g. *Settings → Wallet*) stay in English. Plural messages
need only the `other` form.

| English | Chinese |
| --- | --- |
| checkout | 结账 / 付款页面 (product name "XMR Checkout" stays as is) |
| invoice | 账单 |
| payment request | 付款请求 |
| payment detected | 已检测到付款 |
| confirmation / confirmation target | 确认 / 确认目标 |
| view-only / view key | 只读 / 私有查看密钥 |
| spend key / seed | 花费密钥 / 恢复助记词 |
| wallet | 钱包 |
| primary address / subaddress | 主地址 / 子地址 |
| expired | 已过期 |
| on-chain | 链上 |
| fiat (reference) | 法币（参考） |
| rate / quote | 汇率 / 报价 |
| custody / non-custodial | 托管 / 非托管 |
| reconciler | 对账服务 |
| allowance | 限额 |
| relay (events) | 转发 |
| delivery (webhook) | 投递 |
| endpoint | 端点 |
| dashboard | 控制台 |
| terminal | 收款终端 |
| self-host | 自托管 |

| Avoid (Chinese) | Why |
| --- | --- |
| 支付处理商, 处理器, 收单 | implies a payment processor or acquirer; allowed only as "不是支付处理商" |
| 结算, 清算 | "settlement" (use 换算 for conversion, 结账 for checkout) |
| 提现, 出款, 打款, 代付 | "payout" / withdrawal implies the service moves funds |
| 余额 | "balance" implies held funds |
| 支付公司 | "payments company" |
| 发票 | a formal tax document (fapiao) in China; XMR Checkout does not issue one |

## Ukrainian (`uk`)

Formal *ви* throughout, lowercase. "Merchant" is *продавець*, "customer" is
*покупець*. Use the typographic apostrophe (’) in words such as *з’єднання*,
*пам’ятає*, *необов’язково*, and «» quotes for UI labels. Menu labels of
wallets without a Ukrainian interface (e.g. *Settings → Wallet*) stay in
English. Plural messages need `one`, `few`, `many` and `other`.

| English | Ukrainian |
| --- | --- |
| checkout | оплата / сторінка оплати (product name "XMR Checkout" stays as is) |
| invoice | рахунок (plural *рахунки*) |
| payment request | запит на оплату |
| payment detected | платіж виявлено |
| confirmation / confirmation target | підтвердження / цільова кількість підтверджень |
| view-only / view key | лише для перегляду / ключ перегляду |
| spend key / seed | ключ витрачання / сид-фраза |
| wallet | гаманець |
| primary address / subaddress | основна адреса / підадреса |
| expired | термін дії минув |
| on-chain | у блокчейні |
| fiat (reference) | фіатна валюта (довідково) |
| conversion | перерахунок |
| custody / non-custodial | зберігання коштів / некастодіальний |
| reconciler / reconciliation | сервіс звірки / звірка |
| allowance | ліміт |
| relay (events) | пересилати |
| webhook / endpoint | вебхук / кінцева точка |
| dashboard | панель керування |
| terminal | термінал |
| self-host | розмістити у себе |

| Avoid (Ukrainian) | Why |
| --- | --- |
| процесор, процесинг, еквайринг | implies a payment processor or acquirer; allowed only as "не є платіжним процесором" |
| розрахунок, взаєморозрахунки | "settlement" (use *перерахунок* for conversion, *звірка* for reconciliation) |
| виплата, виведення/зняття коштів | "payout" / withdrawal implies custody |
| баланс, залишок коштів | "balance" implies held funds |
| платіжна компанія | "payments company" |
| рахунок-фактура | a formal tax document; XMR Checkout does not issue one |

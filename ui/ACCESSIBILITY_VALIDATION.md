# UX accessibility and wallet validation

Automated checks and source verification do not establish screen-reader or
wallet-application verification. Do not record credentials in evidence.

## Manual application checks — pending

| Application / platform | Version | Date | Result | Observed menu labels |
| --- | --- | --- | --- | --- |
| Monero GUI / desktop | Not tested | — | Pending — requires manual application testing | — |
| Feather / desktop | Not tested | — | Pending — requires manual application testing | — |
| Cake Wallet / Android | Not tested | — | Pending — requires manual application testing | — |
| Cake Wallet / iOS | Not tested | — | Pending — requires manual application testing | — |

Use a disposable, unfunded wallet. Follow the connection dialog's walkthrough,
verify the primary address and private view key can be located, and compare
menu labels against the installed application. Confirm the guidance distinguishes
private and public view keys and excludes recovery seeds and private spend keys.
Record only version, platform, date, result, and non-secret menu labels. Never
attach a screenshot of a keys screen. Existing guidance has documentation/source
verification only; application verification remains pending.

SVG illustration text and complex background contrast: pending manual visual review.
The automated screenshot sampler covers HTML text and form-field boundaries.

## Manual assistive technology checks — pending

| Screen reader / browser | OS and versions | Date | Result |
| --- | --- | --- | --- |
| VoiceOver / Safari | Not tested | — | Pending — requires manual application testing |
| NVDA / Firefox | Not tested | — | Pending — requires manual application testing |

For each combination, test wallet connection and invoice creation dialogs:

1. Open using the keyboard. Verify the dialog name, guidance, and initial field
   are announced and background content cannot be reached while the dialog is open.
2. Navigate forward and backward through controls. Expand and collapse wallet
   guidance. Verify hidden disclosure contents are skipped and labels/help remain clear.
3. Use isolated fixture credentials to exercise format checks, matching, and
   errors. Confirm changes are announced without reading every keystroke.
4. Create a simulated invoice, switch every available state, and verify one
   coherent status/confirmation announcement. Confirm sidebar and timeline agree.
5. Close using Escape, Close, Cancel, and Done in separate runs. Verify focus
   returns to the exact initiating control and background navigation works again.
6. At 200% text, scroll long dialogs and verify all controls remain reachable.

## Repeatable browser verification

From `ui`, build and run the fixture service with unused local ports:

```sh
npm run build
PORT=3335 FIXTURE_PROXY_PORT=3336 FIXTURE_API_PORT=8035 \
FIXTURE_UI_URL=http://127.0.0.1:3336 API_BASE_URL=http://127.0.0.1:8035 \
node tests/fixture-server.cjs
```

In a separate terminal:

```sh
node tests/browser-accessibility.cjs http://127.0.0.1:3336
node tests/browser-ux.cjs http://127.0.0.1:3336
node tests/browser-layout.cjs http://127.0.0.1:3336 http://127.0.0.1:8035
node tests/browser-subaddress-status.cjs http://127.0.0.1:3336 http://127.0.0.1:8035
node tests/browser-link-errors.cjs http://127.0.0.1:3336 http://127.0.0.1:8035
node tests/browser-checkout-clarity.cjs http://127.0.0.1:3336 http://127.0.0.1:8035
node tests/browser-expiry.cjs http://127.0.0.1:3336 http://127.0.0.1:8035
node tests/browser-wallet-connection.cjs http://127.0.0.1:3336
node tests/browser-polish.cjs http://127.0.0.1:3336
```

Screenshot contrast sampling requires Python 3 with Pillow. Set `CONTRAST_PYTHON`
to that interpreter when using a virtual environment. Sampling checks HTML text
against rendered backgrounds; it does not certify SVG illustration text or
replace the manual assistive-technology checks above.

Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` when using an external Playwright
installation. The accessibility script scans with axe-core, including rendered
text contrast, and tests focus, touch targets, announcements' accessibility
structure, enlarged text, and simulated state agreement. It is not a manual
screen-reader test. Automated incomplete findings require review; do not silently
count them as passes. Preserve the script output with release evidence.

## Automated verification record — 2026-10-31

This original record covers the listed flows only. The expanded public-page
checks and follow-up results below supersede it for the smaller UX fixes.

- Six unit tests passed, including simulated targets of zero, one, and two.
- Browser coverage completed at 320px, 390px, 768px, and 1440px with reduced
  motion: state agreement, both keyboard directions, exact-trigger focus return,
  dialog entry/exit controls, 200% text, and reachable invoice-dialog actions.
- Axe scans reported no WCAG-tagged violations in the tested homepage, invoice
  list, creation dialog, wallet dialog, and all simulated payment states.
- Gradient-related HTML text contrast findings were checked using screenshot
  samples at the top and bottom of dialogs. Visible form-field boundaries were
  sampled against their fills at 3:1. SVG text remains pending manual review.
- Fixture login, invoice failure/recovery/success, invoice metadata, and public
  payment-state regression checks passed. No real wallet credentials were used.

These results do not change any manual row from Pending to Passed.

## Dashboard layout regression coverage

The layout script uses isolated long-amount fixtures and checks 320, 390, 768,
1024, 1280, 1420, 1422, and 1440px, including either side of the invoice table's
60rem content-width threshold. It verifies amount containment, complete selected
filter labels, compact address disclosures and warnings, and invoice/webhook
page overflow at normal and 200% text sizes. Run fixture browser scripts
sequentially because they share mutable fixture state.

Dashboard layout verification (2026-10-31): lint, six unit tests, the eight-width
layout checks, and existing UX, accessibility, and address-availability browser
checks passed using isolated fixtures. Accessibility scans reported no tagged
violations; screenshot sampling resolved HTML contrast findings. Existing manual
assistive-technology checks above remain pending.

## Smaller UX fixes — follow-up on 2026-11-01

The earlier record covered a narrower set of pages. Expanded checks found and
corrected low-contrast guide navigation numbers, the lookup input boundary, and
horizontal overflow in opened integration examples at 200% text.

- All 40 public-page axe scans at 320, 390, 768, and 1440px passed with no
  WCAG-tagged violations. Opened code examples, keyboard scrolling, skip links,
  mobile-menu Escape/focus return, dashboard headings, titles, and footers were
  included. These pages also fit at 200% text with reduced motion.
- The existing accessibility suite passed all 56 scans with no WCAG-tagged
  violations. HTML screenshot contrast sampling checked 7,535 public-page
  samples and 3,389 samples in the existing flows. The sampler clips text to
  scroll containers and image bounds; hidden offscreen text is not sampled as
  if it were visible. SVG illustration contrast remains a manual check.
- Link-error, checkout-clarity, wallet-connection, UX, layout, and address-status
  browser checks passed using isolated fixtures. Coverage includes unavailable
  status recovery, terminal polling, wallet format guidance, dashboard return
  paths, an actual rendering failure and recovery, and script-disabled invoice
  404 content. No real wallet credentials or production writes were used.
- Lint, all 11 unit tests, the production UI image build, and a build from the
  staged snapshot passed. The isolated API/PostgreSQL/Nginx payment-link checks
  and UI request-protection checks also passed, including credential-log checks.
- Privacy, terms, and contact links were omitted at the maintainer's request.
  Both footers use neutral project attribution. BTCPay protocol status values
  remain compatible; visible demo text uses “Demo” while keeping `/tour` URLs.

Script-free error documents use rendered routes with HTTP 404. Document requests
for `/invoice/...` and `/pay/...` make a read-only public lookup before rendering;
valid document requests therefore make an additional lookup. Client navigation
and refresh data requests retain Next's native error flow. Dashboard invoice
links are not prefetched. These changes do not alter payment detection,
confirmation thresholds, webhook payloads, or wallet permissions.

For the full API/PostgreSQL/Nginx payment-link fixture checks, from the repository
root after building the UI image:

```sh
python3 tests/check_payment_links.py --playwright-module /path/to/playwright
python3 tests/check_ui_request_protection.py --playwright-module /path/to/playwright
```

All manual wallet-application and assistive-technology rows above remain Pending.

## Checkout expiry integration — 2026-11-01

The remaining expiry work is now integrated across invoice, donation, compact
checkout, classic checkout, and receipt pages. Dates use the shared explicit-UTC
formatter. A pending invoice shows its deadline and a visual countdown before
the QR code; reaching zero requests a status check without changing invoice
state. Script-disabled pages retain the deadline and refresh guidance.

Lint, all 11 unit tests, the production build, and the dedicated expiry browser
checks passed using isolated fixtures. Browser coverage includes 320, 390, 768,
and 1440px, 200% text, reduced motion, Tokyo/en-GB and New York/en-US, scripts
enabled and disabled, null/invalid/past deadlines, receipt timestamps, hydration,
and crossing zero while the server still reports pending.

Feature review: display and read-only status refresh only; no new key access,
fund movement, price guarantees, invoice states, or payment-detection changes.
Underpayment behavior is not part of this integration. Existing manual checks
remain pending.

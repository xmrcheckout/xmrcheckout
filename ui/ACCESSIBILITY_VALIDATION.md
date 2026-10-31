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

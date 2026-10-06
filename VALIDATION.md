# Validation and Better Interface review

**Completion: Complete for the stated scope of the bounded Ethereum demonstration and static website.** Production backfill, 24/7 hosting, additional chains and authenticated IMD submission require the external setup documented in the README. This is the worker's validation record, not independent network certification.

## Scope and assumptions

Reviewed overview, deployment history, buyer network, shared funding, selling/proceeds, watchlists, alerts, live search, network availability, coverage, methodology and evidence/IMD dialogs. The production export is `dist/`. The working integration is Ethereum: real RPC receipt verification, indexed Swap events, live Blockscout browser lookup and transaction polling. All other target networks are explicitly unsupported.

The dataset is a selected May 2020 Uniswap V2 factory case, captured on 2026-10-06. Four ERC-20 LP tokens prove repeated **contract** deployment; this benign protocol example is not evidence of a common human owner or malicious coordination. No production feed, current market-wide totals or AI-generated verdict is simulated. Test-only synthetic funding and alert inputs are explicitly marked in test source.

`app.lighte.xyz` could not be retrieved (TLS failure). The chosen dark workspace, compact data tables and lime action system are an interpretation, not a verified reproduction. The supplied Better Interface and documentation guide were read before implementation; all six core domains were applied. The supplied licenses are retained in `docs/licenses/better-interface.txt` and `THIRD-PARTY.md`.

## Actual verification

Final source build and browser run completed on **2026-10-06**, with final browser completion at **09:16:44 UTC**.

| Check | Actual command / method | Result |
| --- | --- | --- |
| TypeScript | `/tmp/trace-deps/node_modules/.bin/tsc --noEmit -p /tmp/trace-tsconfig.json` | Exit 0. Temporary config extends repository `tsconfig.json` and points type resolution at externally installed dependencies. No type rules weakened. |
| Production build | `FRONTEND_DEPENDENCIES=/tmp/trace-deps/node_modules /tmp/trace-deps/node_modules/.bin/vite build --configLoader native` | Exit 0; 73 modules, final build 696ms; relative JS/CSS URLs and local WOFF2 font. |
| Detection/regression tests | `npm test` | Exit 0; **7 tests passed**. Real receipt/block/pool matching, repeat deployer, 128 Swap events, duplicate prevention, synthetic funding chronology and movement, sell ordering and polling baseline/gaps. |
| Production browser interactions | `PLAYWRIGHT_MODULE=/opt/pwmcp/node_modules/playwright/index.mjs BROWSER_EXECUTABLE=/opt/ms-playwright/chromium_headless_shell-1246/chrome-headless-shell-linux64/chrome-headless-shell AXE_PATH=/tmp/trace-deps/node_modules/axe-core/axe.min.js node tests/browser.mjs` | Exit 0; **19 interaction/check groups passed**, Chromium **154.0.8037.0**. Full record: `docs/validation/browser-validation.json`. |
| Independent worker | `node scripts/monitor.mjs --config /tmp/trace-watch-config.json --state /tmp/trace-worker-test-state.json` (two consecutive passes) | Both exit 0, real factory transaction page, no provider failures, initial baseline and repeat pass both correctly produced zero alerts. Final state retained in `docs/validation/worker-validation.json`. |
| Provider capture | `node scripts/collect.mjs` | Four real creations and 128 swaps obtained. PublicNode rejected archive logs; indexed-log fallback worked. Five funding-history requests returned 429; remaining history returned its 100-item cap. These gaps are preserved, not counted as complete negative findings. |

Normal development equivalents are `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:browser`. Dependencies and caches were installed only under `/tmp` during this assignment. A Rollup tree-shaking pass stalled in this environment; the final Vite configuration disables that pass and uses individual icon imports while retaining minification. The final JS is about 257 KB raw / 77 KB gzip. No vendor registry or dependency archives are delivered.

The assigned browser connector failed because its expected `chrome-for-testing` path did not exist. A full Chrome binary also failed to initialize crashpad in the restricted environment. The installed Chromium **headless shell** worked. `tests/browser.mjs` starts its own temporary local server, serves the actual export under `/preview/`, and closes browser and server in the same bounded foreground command. No background service was left running.

### Interaction coverage

The browser suite exercised: real production assets and local font; table filtering, empty recovery and sorting; keyboard evidence opening, Escape and focus return; transaction URLs; buyer-overlap switch; six repeated-buyer rows; incomplete funding state; fifteen subsequent-sell links; editable IMD JSON download and not-submitted status; full evidence JSON export; invalid and captured token search; all three unsupported networks; route-preserving skip link; watchlist storage across reload and invalid input; real public polling baseline; synthetic two-page alert creation/deduplication and mark-read; real WETH live lookup; synthetic 503 recovery; hash navigation and eight recurring pairs; responsive reflow; keyboard focus; reduced motion; rendered contrast; runtime and local-resource errors.

The real public lookup included pending transactions and the final site handled missing block/timestamp fields. Synthetic alert replay is necessary to validate new-alert behavior deterministically; no test hashes are present in `public/data/ethereum-case.json` or the shipped UI's initial storage.

No uncaught runtime exceptions or failed **local** asset requests occurred in the final run. The deliberate synthetic 503 is an expected external failure test. Browser screenshots are actual captures, not mockups:

- [Desktop, 1440px](docs/validation/overview-1440.jpg)
- [Mobile, 390px](docs/validation/overview-390.jpg)
- [Reflow, 320px](docs/validation/overview-320.jpg)
- [Keyboard focus](docs/validation/keyboard-focus.jpg)

Screenshots were visually inspected. The 1440px composition retained the four metrics, two research panels and evidence/insight columns. At 390/320px, panels stacked, navigation became a compact top row and the table remained horizontally scrollable within its own region. A visible lime perimeter surrounded the keyboard-focused IMD action. No root-level overflow was measured on overview, watchlist or alerts at **1440, 1024, 768, 390 or 320 CSS px**. Intermediate widths were measured, not all separately screenshot-reviewed.

## Six-domain coverage

| Domain | Status | Evidence and limits |
| --- | --- | --- |
| Accessibility | **Checked** | Native buttons/forms/links, labels, named mobile navigation, landmarks, route-preserving skip link, focusable table regions, modal containment and focus return, Escape, persistent status region and reduced-motion fallback. axe-core 4.10.3: zero violations in desktop overview, evidence dialog and 1440/390/320px overview states. Some `color-contrast` and `aria-prohibited-attr` checks remained incomplete in axe; this is not a full compliance verdict. Screen-reader and physical-device sessions **not verified**. |
| Layout | **Checked** | Main alignment, grouping, card/table relationship, narrow reflow and five measured widths. Data table keeps an intentional internal scroll region. Native 200% browser zoom, RTL and pseudo-localization **not verified**; only English is supplied. |
| Writing | **Checked** | Action labels match handlers; actual/observed/unsupported terms are explicit; provider errors state recovery; sparse/capped histories do not imply innocence or ownership; IMD says not submitted. Static controls that suggested nonexistent dropdowns were corrected. |
| Typography | **Checked** | Local Inter loading confirmed by browser, heading/body hierarchy and numeric stability inspected, full addresses reachable, mobile inputs at 16px, no unintended wrapping observed at screenshot widths. Compact technical metadata intentionally uses 8–11px. OS/browser fallback-font differences and native text enlargement **not verified**. |
| Colors | **Checked** | Semantic neutral/accent/status tokens, redundant text/icon confidence cues and six actual rendered contrast pairs measured. Ratios range **7.05–15.40:1**, all above 4.5:1 for those text pairs. All gradient/graph marks and every hover/disabled combination were **not individually measured**. A light theme is **not applicable**. |
| UI | **Checked** | Default, selected, focus, loading, empty, error and disabled patterns exercised; real export, inputs, downloads, hashes and local storage tested. Native overlay/focus behavior inspected. Static loading cue under reduced motion verified. Timeline entrances/autoplay are **not applicable**; a slowed browser animation-panel review was **not performed**. |

## Findings and fixes

Locations refer to the final source, where fixes now live.

| Severity / domain | Source | Evidence and impact | Fix and recheck |
| --- | --- | --- | --- |
| **HIGH · UI / data** | `src/components.tsx:5`, `src/types.ts` (`Transaction`) | Real WETH lookup returned a pending transaction with a null block. Formatting threw and blanked the page in the initial browser run. | Model nullable blocks/timestamps and render “pending”/“Pending”. Final real WETH lookup passed with zero runtime exceptions. |
| **HIGH · Accessibility** | `src/App.tsx` (main navigation `aria-label={n.label}`) | Source review found visible link labels hidden in compact navigation, removing accessible names from icon links. | Explicit names persist at every breakpoint. Mobile axe runs at 390/320px passed. |
| **MEDIUM · Accessibility / layout** | `src/App.tsx` (`table-scroll` regions), `src/styles.css:1143` | Tables deliberately overflow on mobile; keyboard users need an explicit scroll target and description. | Named regions with `tabIndex=0`; internal scrolling retained, root overflow measured zero down to 320px. |
| **MEDIUM · Accessibility / navigation** | `src/App.tsx:827` | A plain `#main` skip target would conflict with hash routing and reset the active view. | Skip handler focuses/scrolls main without changing the route. Keyboard test on the watchlist passed. |
| **MEDIUM · Writing / forms** | `src/App.tsx:978` | Network selector's accessible name included the decorative Ethereum symbol; exact name lookup failed. | Symbol hidden from assistive naming, explicit “Network” name. Selection of every unsupported chain passed. |
| **MEDIUM · Writing / evidence** | `src/App.tsx:780`, `src/App.tsx:2138` | Five rate-limited funding queries and one capped page cannot establish complete proceeds tracing. | Persist per-wallet coverage, display incomplete-proceeds guidance and distinguish “not observed” from “does not exist”. Empty funding and coverage text inspected; core chronology tested with explicitly synthetic inputs. |
| **LOW · UI** | `src/App.tsx` (`workspace`, `chart-range`) | Static workspace/month labels initially carried chevrons suggesting controls with no action. | Remove decorative dropdown chevrons; real network and sort controls retain native interaction. Final screenshots inspected. |
| **HIGH · Deliverable integrity** | `evidence/`, `docs/validation/`, `tests/detection.test.mjs:15` | Repository-local exclusions omit `artifacts/`; storing required receipts only there would break a clean submission's evidence tests. | Preserve receipts, detector output, browser report, screenshots and licenses in normal source paths; keep tool outputs in `artifacts/` as additional artifacts. Tests passed using `evidence/`. No ignore file changed. |

No known unresolved primary-interaction defect remained after final verification. Two test-harness issues were also corrected: navigation assertions now wait for React's active-route state, and focus measurement uses keyboard modality before checking the custom perimeter. Earlier failed runs were not treated as passes.

## Limits and operating requirements

- Only Ethereum works. Base, Solana and Robinhood Chain are design/availability states requiring actual adapters and verification.
- The snapshot covers four selected LP tokens, not arbitrary token-deployer surveillance. Live address lookup is one bounded page, not a complete wallet history. Factory traces and outer transaction initiators remain distinct.
- Funding data is incomplete: five HTTP 429 failures, one 100-transaction cap, no established shared funding or subsequent native movement. There is no internal-ETH/token-flow attribution or proved provenance of sale proceeds.
- Repeated transaction senders and wallet pairs are observations. Bundle inclusion, common ownership and malicious intent are not confirmed.
- Browser monitoring is visible-tab/session scoped; the standalone worker needs scheduling, durable storage and operational monitoring. Top-level transactions only, no reorg reconciliation or finality guarantee. No email/webhook delivery is configured.
- IMD packet preparation works. Automatic or authenticated investigation was not possible without an IMD endpoint/key and was not fabricated. No AI requests are part of routine polling.
- No contracts, tokens, trades or purchases were made. No deployment to an external hosting service was attempted.
- Browser/screen-reader/device/zoom and contrast limits are listed by domain above; no blanket accessibility certification is claimed.

## Submission integrity

The source, lockfile, complete static export, raw creation evidence and source-copy validation are preserved. The final tree audit is [docs/validation/size-audit.json](docs/validation/size-audit.json). It checks the candidate submission files against **8,388,608 bytes** using their uncompressed total, a conservative size check rather than a fabricated Git-bundle measurement. No dependency directory, package cache, npm archive, source map, Git submodule or scratch file is included. No `.git/`, `.github/`, environment file or ignore rule was modified. Artifact outputs are separate from the source copies because the repository already excludes `artifacts/`.

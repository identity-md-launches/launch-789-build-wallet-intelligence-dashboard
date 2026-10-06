# Trace — wallet intelligence

A static, read-only research dashboard for token deployments, repeated buyers and transaction evidence. Built with React, TypeScript and Vite. The finished website is in **`dist/`**; publish that directory as-is.

The demonstration contains **real Ethereum transactions**, not fabricated dashboard figures. It follows four Uniswap V2 liquidity-pool tokens created in May 2020. A factory repeatedly creating LP tokens is normal protocol behavior. The interface makes no claim of malicious activity, common ownership or a transaction bundle.

## Start and publish

Requires Node 22.12+ (verified with Node 24.9.0) and npm. On a normal development machine:

```sh
npm ci
npm run dev
```

For the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Upload **the complete `dist/` directory** to an HTTPS static host: `index.html`, `assets/`, `data/`, `licenses/` and `favicon.svg`. Do not upload only the HTML. Vite uses `base: './'`, and navigation uses hashes; no server route rewrites are needed. The export was exercised under `/preview/`, including its local variable font and JSON evidence. HTTPS enables clipboard access. No wallet connection is required.

No backend, credentials, CDN font or runtime npm registry is required for the captured case. Live address search and polling require browser access to Blockscout. Live searches send the searched address to that public indexer. Watchlists and alert history stay in this browser's local storage; they are not synced between devices. Nothing has been deployed or published externally by this delivery.

Do not include `node_modules`, caches, browser binaries or temporary state in a source submission. No ignore file was created or modified. The worker installed dependencies under `/tmp` to keep this repository free of generated dependency directories; the lockfile is included for normal installation.

## What works

| Feature | Delivered behavior |
| --- | --- |
| Address search | Exact Ethereum wallet or token address. Known case addresses show captured evidence; other addresses fetch public indexed metadata, up to 50 recent transactions and 50 internal traces. “Fetch live history” refreshes a captured address. Pending transactions are labeled pending. |
| Deployment history | Four verified ERC-20 LP-token creations, block numbers, factory and initiator distinction, receipt evidence and public explorer links. Live lookup identifies successful contract creations in the returned pages; those contracts are not automatically classified as tokens. |
| Repeated early buyers | Six outer transaction senders observed buying in two or more selected pools. Swap recipients remain available in evidence and exports. |
| Recurring groups | Eight wallet pairs that each participated in at least two of the same pools. Explicitly co-occurrence, not proven coordination. |
| Shared funding | Deterministic detection of a common native ETH sender funding two repeated buyers before their first captured buys. No shared source established in this capture; five history queries were rate limited and the sixth was capped. |
| Subsequent selling | Fifteen sells following prior buys by the same sender in the same pool, with transaction links. |
| Proceeds movement | Detector associates later top-level native ETH transfers with selling senders. The current incomplete history establishes no such movement. A later transfer cannot prove the funds came from that sale. |
| Watchlists and alerts | Save/remove up to 20 Ethereum addresses; persist locally; export JSON. Manual checks and optional 60-second polling create in-app transaction alerts. First check sets a baseline; later checks report activity. Hidden tabs pause polling; closed tabs stop it. |
| Independent monitoring | A standalone Node polling worker with durable cursors, bounded alert retention, gap reporting, atomic state writes and a process lock. No AI calls. Hosting and scheduling are operator setup. |
| IMD | Editable investigation question plus downloadable evidence packet, provenance, transaction links and limitations. No IMD endpoint or credentials were supplied, so the packet is **not automatically submitted**. Import it into your IMD contributor workflow for deeper review. |
| Other networks | Base, Solana and Robinhood Chain have explicit unsupported states and adapter requirements. They never show Ethereum data labeled as another network. |

## Evidence and detection verification

Open the overview, choose **USDC / WETH**, then **Open creation transaction**. Inspect the factory, transaction initiator, block and observed swaps. The four distinct creation transactions are:

| Pool-token | Creation block | Public transaction |
| --- | ---: | --- |
| USDC / WETH | 10,008,355 | [0xd07cbde8…](https://eth.blockscout.com/tx/0xd07cbde817318492092cc7a27b3064a69bd893c01cb593d6029683ffd290ab3a) |
| DAI / WETH | 10,042,267 | [0xc4c1840d…](https://eth.blockscout.com/tx/0xc4c1840db940f5075c5404266efe50d7c65bc079f318ab8e5a10b8a432b49d30) |
| WBTC / WETH | 10,091,097 | [0x7578a3b3…](https://eth.blockscout.com/tx/0x7578a3b32f0c884422126d606098d164eca40d0e51bae3d997bb993cc1646b13) |
| USDT / WETH | 10,093,341 | [0xe64069ac…](https://eth.blockscout.com/tx/0xe64069acd123ec94b8a3316378183ba8bf42b40979df3b0bb57b0e7b9e47ef38) |

Each successful receipt contains a `PairCreated` event from `0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f`, encoding the corresponding distinct pool. Blockscout also identifies that factory as each ERC-20 LP token's creator. The repeat-deployer rule requires at least two distinct creations; this case verifies **four**. The factory is a contract, not an identified human deployer or proof that the transaction initiators share ownership.

- [Captured case](public/data/ethereum-case.json): 128 decoded real Swap events, creation metadata, sources, exact ranges and funding-coverage failures.
- [Creation receipts](evidence/creation-receipts.json): RPC receipt evidence, checked against decoded decimal block numbers and block hashes.
- [Detection verification](evidence/detection-verification.json): actual repeat-deployer output, buyers, groups and subsequent selling.
- `src/detection.mjs`: shared, deterministic rules used in the UI and capture verification.

“Early” means the **first 32 captured Swap logs per pool**, within 100,000 blocks of creation, not necessarily the launch block or the first day. The factory existed before active public trading, so this window deliberately includes sparse initial pool activity. WETH into the pool is a buy of the other asset; WETH out is a sell. Actor identity is the outer transaction sender, which may be a router, service or bot, not a beneficial owner. No mempool ordering, private relay bundle or common control is inferred.

To reproduce the capture (network required):

```sh
npm run collect
npm test
npm run build
```

This replaces the evidence files with newly fetched results. The frozen-capture tests expect four creations, 128 swaps, six repeated buyers, eight pairs and fifteen subsequent sells; partial provider failures can change a recapture and should be investigated before publishing. Creation receipts and block identity are verified through Ethereum PublicNode. PublicNode refused historical `eth_getLogs` without a personal token, so the collector falls back to Blockscout's indexed log API. The log API returned up to 1,000 entries; the detector uses only the first 32 sorted events per pool. A result page is not a complete lifetime history.

## Continuous monitoring setup

Export a watchlist from the UI, then run one polling pass:

```sh
node scripts/monitor.mjs --config /path/to/trace-watchlist.json --state /path/to/durable/trace-state.json
```

The JSON configuration requires `{"chainId":1,"addresses":["0x…"]}` with complete 40-hex-character addresses, maximum 20. The first pass sets a durable baseline without reporting old activity as new. Schedule the command once per minute with your host's scheduler; overlapping passes are rejected by a lock. State retains the latest 200 deduplicated alerts and reports per-address errors. Exit 0 means the pass succeeded; exit 2 means at least one provider request failed; invalid configuration/state fails without overwriting it. If a process crashes, check that it stopped before removing its `.lock` file.

Use durable storage, protect state files and keep any future provider keys server-side. No email, webhook or messaging delivery is configured; results are in the worker's JSON state and stdout. Browser alerts and worker state are separate. Importing worker results into the static UI would require an authenticated feed adapter.

Monitoring currently checks the latest **top-level transaction page**, not every internal call, token transfer or trace. At high activity, a cursor can leave the page; a coverage-gap alert marks incomplete history. There is no reorg reconciliation, finalized-block guarantee, backfill or exactly-once delivery SLA. A production service should add these before making completeness claims. Broad historical analysis and 24/7 service operation require the setup in [DATA-PLAN.md](DATA-PLAN.md).

## Providers, keys and cost

[DATA-PLAN.md](DATA-PLAN.md) records the provider and cost plan made before implementation. Demonstration services cost $0 and use no private keys. Planning estimates for continuous operation: static hosting $0–10/month, compute $5–20, storage $0–25, dedicated historical data $50–300+ depending on usage. These are allowances, not vendor quotes. IMD integration and pricing are unknown and require operator configuration. No services were purchased.

## Validation and design

Run the browser suite after building:

```sh
npx playwright install chromium
npm run test:browser
```

It owns a temporary foreground HTTP server under `/preview/`, closes both server and browser on completion, and writes validation evidence to `artifacts/`. Live public lookup and polling are real requests. The alert and provider-error replays are explicitly **synthetic test fixtures**, never part of the shipped Ethereum dataset. `BROWSER_EXECUTABLE`, `PLAYWRIGHT_MODULE` and `AXE_PATH` optionally point to existing installations.

Worker results, corrections and remaining limits are in [VALIDATION.md](VALIDATION.md) and [docs/validation/browser-validation.json](docs/validation/browser-validation.json). [DESIGN.md](DESIGN.md) documents the implemented visual system and responsive behavior. [THIRD-PARTY.md](THIRD-PARTY.md) preserves design-reference, font and icon attribution.

The final production build and typecheck passed, all **7 detection tests** passed, and **19 browser check groups** passed. Desktop/mobile screenshots, six measured text-contrast pairs and the independent worker's successful baseline checks are retained in `docs/validation/`. The final browser run reported zero runtime exceptions and zero failed local resources. `artifacts/` is excluded by the pre-existing repository configuration, so required evidence and validation copies are also delivered in normal source paths.

The requested reference, `app.lighte.xyz`, could not be retrieved in this environment (TLS failure). The delivered interpretation is a dark, restrained research terminal with lime accents, compact navigation, evidence tables and explicit confidence labels; it is not a claim of a pixel-identical reproduction.

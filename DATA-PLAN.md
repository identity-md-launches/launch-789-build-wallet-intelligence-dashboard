# Data and operation plan

Recorded before implementation, 2026-10-06. No services will be purchased.

| Requirement | Selected provider / setup | Credentials | Coverage and limits | Planning cost (USD/month) |
| --- | --- | --- | --- | --- |
| Ethereum blocks, receipts and V2 events | `https://ethereum-rpc.publicnode.com` | None | Bounded historical log scans; public rate limits and availability are not guaranteed. Verify chain ID and block numbers. | $0 for this demonstration |
| Ethereum address metadata, creation traces, wallet transactions | `https://eth.blockscout.com/api/v2` | None for public access | Indexed history; the UI explicitly reports its page cap. Internal creation traces distinguish factories from transaction senders. | $0 for this demonstration |
| Static frontend | Any HTTPS static host | Host account only when publishing | Committed `dist/`, no backend or secret needed for captured evidence and local watchlists. | $0–10 estimate |
| Continuous monitoring | Node 24 worker on a small VPS or scheduled job; durable output/state storage | Optional dedicated RPC/indexer key stored on host | Poll saved addresses independently of AI. Browser polling works only while the page is open. Continuous deployment requires operator setup. | $5–20 compute + $0–25 storage estimate |
| Production historical indexing | Dedicated Ethereum RPC/archive traces and indexed address-history API | Provider API keys, server-side | Broad wallet histories, full token lifecycles and cross-chain joins require pagination, backfill and storage. Public sample is not chain-wide surveillance. | $50–300+ provider allowance; usage dependent |
| IMD investigations | Export evidence and investigation questions for the contributor's IMD workflow | Operator-supplied IMD integration, if automatic submission is desired | No authenticated IMD endpoint or key was supplied. Delivery prepares a reviewable case packet; it does not claim an AI verdict or submit externally. | Unknown IMD pricing; separately budget per investigation |
| Base | Planned EVM adapter | Dedicated RPC/indexer setup | Unsupported in delivery; no Ethereum data relabeled as Base. | Included in future provider budget; unquoted |
| Solana | Planned RPC + transaction/indexer adapter | Likely archival indexer key | Unsupported; SPL mint creation and program-aware swap decoding are required. | $50–300+ allowance; unquoted |
| Robinhood Chain | Planned adapter pending verified network/provider configuration | To be established | Unsupported; no assumed chain ID, endpoints or history. | Unknown |

These are engineering budget estimates, not current vendor price quotes. No key, wallet connection, transaction signing, contracts or trading is needed.

## Evidence scope

Start with a reproducible Ethereum factory case: Uniswap V2 creates ERC-20 liquidity-pool tokens. Multiple distinct pool creation receipts and factory `PairCreated` events establish a repeat **contract deployer**, not a repeat human owner or malicious activity. This is an intentionally benign baseline.

Collect bounded early Swap events from several WETH pools. Attribute observations to the outer transaction sender, not the router's Swap `sender`; recipients may differ. Repeated senders and co-occurrence across launches are observations. Funding and movement of proceeds are bounded top-level ETH transfers, and do not establish beneficial ownership. A transfer following a sale is not proof that the transferred ETH was derived from that sale. Swaps are pool-relative buys/sells, not claims about an address's full portfolio.

The delivered UI will separate captured real evidence, live address lookups, and unavailable coverage. Any synthetic inputs used to validate detection logic will remain test fixtures and will not be presented as public transactions. Routine monitoring is deterministic code, independent of IMD or any AI requests.

import { mkdir, writeFile } from "node:fs/promises";
import { detect } from "../src/detection.mjs";

const RPC = process.env.RPC_URL || "https://ethereum-rpc.publicnode.com";
const API = "https://eth.blockscout.com/api/v2";
const FACTORY = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const SWAP =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const CREATED =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";
const pools = [
  ["USDC / WETH", "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc"],
  ["DAI / WETH", "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11"],
  ["USDT / WETH", "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852"],
  ["WBTC / WETH", "0xbb2b8038a1640196fbe3e38816f3e67cba72d940"],
];
const hex = (n) => "0x" + n.toString(16);
const address = (word) => "0x" + word.slice(-40).toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(url, opts) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, {
        ...opts,
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j;
    } catch (e) {
      if (i === 3) throw e;
      await sleep(600 * (i + 1));
    }
  }
}
async function rpc(method, params) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const value = (
      await request(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      })
    ).result;
    if (value !== null && value !== undefined) return value;
    await sleep(400);
  }
  throw new Error(`${method}: unavailable after five attempts`);
}
if ((await rpc("eth_chainId", [])) !== "0x1")
  throw new Error("Expected Ethereum mainnet");
const txCache = new Map();
async function tx(hash) {
  if (!txCache.has(hash))
    txCache.set(hash, await rpc("eth_getTransactionByHash", [hash]));
  return txCache.get(hash);
}
const launches = [],
  swaps = [],
  receipts = [],
  errors = [];
for (const [name, pool] of pools) {
  try {
    const info = await request(`${API}/addresses/${pool}`);
    if (
      info.creator_address_hash?.toLowerCase() !== FACTORY ||
      info.token?.type !== "ERC-20"
    )
      throw new Error("Unexpected creator/token");
    const receipt = await rpc("eth_getTransactionReceipt", [
      info.creation_transaction_hash,
    ]);
    const blockNumber = Number(BigInt(receipt.blockNumber));
    const block = await rpc("eth_getBlockByNumber", [hex(blockNumber), false]);
    if (Number(BigInt(block.number)) !== blockNumber)
      throw new Error("Block round-trip mismatch");
    const event = receipt.logs.find(
      (l) =>
        l.address.toLowerCase() === FACTORY &&
        l.topics[0] === CREATED &&
        address(l.data.slice(0, 66)) === pool,
    );
    if (receipt.status !== "0x1" || !event)
      throw new Error("No successful PairCreated evidence");
    const token0 = address(event.topics[1]),
      token1 = address(event.topics[2]);
    if (![token0, token1].includes(WETH))
      throw new Error("Expected WETH quote");
    const creationTx = await tx(receipt.transactionHash);
    const launch = {
      name,
      address: pool,
      deployer: FACTORY,
      initiator: creationTx.from,
      transactionHash: receipt.transactionHash,
      block: blockNumber,
      blockHash: block.hash,
      timestamp: new Date(Number(BigInt(block.timestamp)) * 1000).toISOString(),
      token0,
      token1,
      kind: "ERC-20 LP token",
      fromBlock: blockNumber,
      toBlock: blockNumber + 100000,
      swapLimit: 32,
    };
    launches.push(launch);
    receipts.push({
      address: pool,
      receipt,
      creator: info.creator_address_hash,
      tokenType: info.token.type,
    });
    let logs;
    try {
      logs = await rpc("eth_getLogs", [
        {
          address: pool,
          fromBlock: hex(launch.fromBlock),
          toBlock: hex(launch.toBlock),
          topics: [SWAP],
        },
      ]);
      launch.logSource = RPC;
    } catch (e) {
      console.log(
        `PublicNode log query refused (${e.message}); using Blockscout indexed logs`,
      );
      const url = new URL("https://eth.blockscout.com/api");
      Object.entries({
        module: "logs",
        action: "getLogs",
        fromBlock: launch.fromBlock,
        toBlock: launch.toBlock,
        address: pool,
        topic0: SWAP,
      }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      const fallback = await request(url);
      if (!Array.isArray(fallback.result))
        throw new Error("Indexed log fallback unavailable");
      logs = fallback.result;
      launch.logSource = "https://eth.blockscout.com/api";
    }
    launch.totalSwapLogs = logs.length;
    logs.sort(
      (a, b) =>
        Number(BigInt(a.blockNumber)) - Number(BigInt(b.blockNumber)) ||
        Number(BigInt(a.logIndex)) - Number(BigInt(b.logIndex)),
    );
    for (const log of logs.slice(0, launch.swapLimit)) {
      const t = await tx(log.transactionHash);
      const words = log.data
        .slice(2)
        .match(/.{64}/g)
        .map((w) => BigInt("0x" + w));
      const [in0, in1, out0, out1] = words;
      const wethIn = token0 === WETH ? in0 : in1;
      const wethOut = token0 === WETH ? out0 : out1;
      const side =
        wethIn > 0n && wethOut === 0n
          ? "buy"
          : wethOut > 0n && wethIn === 0n
            ? "sell"
            : "complex";
      swaps.push({
        pool,
        wallet: t.from.toLowerCase(),
        recipient: address(log.topics[2]),
        router: address(log.topics[1]),
        side,
        eth: Number(side === "buy" ? wethIn : wethOut) / 1e18,
        block: Number(BigInt(log.blockNumber)),
        transactionHash: log.transactionHash,
        logIndex: Number(BigInt(log.logIndex)),
      });
    }
    console.log(
      `${name}: creation ${blockNumber}; ${Math.min(logs.length, launch.swapLimit)}/${logs.length} Swap logs captured`,
    );
  } catch (e) {
    errors.push({ pool, message: e.message });
    console.error(`${name}: ${e.message}`);
  }
}
if (launches.length < 2) throw new Error("Need two verified creations");
const preliminary = detect({ launches, swaps, transfers: [] });
const wallets = preliminary.repeatBuyers.slice(0, 6).map((x) => x.wallet);
const transfers = [],
  coverage = [];
for (const wallet of wallets) {
  // Legacy Blockscout indexed history gives a bounded historic range, not a recent page.
  const min = Math.min(
    ...swaps.filter((s) => s.wallet === wallet).map((s) => s.block),
  );
  const max = Math.max(
    ...swaps.filter((s) => s.wallet === wallet).map((s) => s.block),
  );
  try {
    const url = new URL("https://eth.blockscout.com/api");
    Object.entries({
      module: "account",
      action: "txlist",
      address: wallet,
      startblock: Math.max(0, min - 7200),
      endblock: max + 7200,
      page: 1,
      offset: 100,
      sort: "asc",
    }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const r = await request(url);
    if (!Array.isArray(r.result)) throw new Error(String(r.result));
    for (const t of r.result)
      if (t.isError === "0" && BigInt(t.value || "0") > 0n && t.to) {
        transfers.push({
          from: t.from.toLowerCase(),
          to: t.to.toLowerCase(),
          eth: Number(BigInt(t.value)) / 1e18,
          block: Number(t.blockNumber),
          transactionHash: t.hash,
          timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
        });
      }
    coverage.push({
      wallet,
      fromBlock: min - 7200,
      toBlock: max + 7200,
      returned: r.result.length,
      cap: 100,
      complete: r.result.length < 100,
    });
  } catch (e) {
    coverage.push({ wallet, error: e.message });
  }
}
const uniqueTransfers = [
  ...new Map(transfers.map((t) => [t.transactionHash, t])).values(),
];
const data = {
  schemaVersion: 1,
  chainId: 1,
  capturedAt: new Date().toISOString(),
  source: { rpc: RPC, indexer: API },
  title: "Uniswap V2 · first pool activity",
  description:
    "Real historical public transactions. Selected liquidity-pool tokens, not a market-wide sample. Repeat factory deployment is expected protocol behavior.",
  launches,
  swaps,
  transfers: uniqueTransfers,
  fundingCoverage: coverage,
  errors,
};
await mkdir("public/data", { recursive: true });
await mkdir("artifacts", { recursive: true });
await mkdir("evidence", { recursive: true });
await writeFile(
  "public/data/ethereum-case.json",
  JSON.stringify(data, null, 2) + "\n",
);
await writeFile(
  "evidence/creation-receipts.json",
  JSON.stringify(
    { chainId: 1, capturedAt: data.capturedAt, source: RPC, receipts },
    null,
    2,
  ) + "\n",
);
const summary = detect(data);
await writeFile(
  "evidence/detection-verification.json",
  JSON.stringify(
    {
      verifiedAt: data.capturedAt,
      repeatDeployers: summary.repeatDeployers,
      repeatBuyers: summary.repeatBuyers.length,
      groups: summary.groups.length,
      funding: summary.sharedFunding.length,
      sells: summary.sells.length,
      proceeds: summary.movements.length,
      coverage,
      errors,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    launches: launches.length,
    swaps: swaps.length,
    repeatBuyers: summary.repeatBuyers.length,
    groups: summary.groups.length,
    transfers: uniqueTransfers.length,
    errors,
  }),
);

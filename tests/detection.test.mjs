import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { detect } from "../src/detection.mjs";
import { diffActivity } from "../src/monitor.mjs";

const fixture = JSON.parse(
  await readFile(
    new URL("../public/data/ethereum-case.json", import.meta.url),
    "utf8",
  ),
);
const receipts = JSON.parse(
  await readFile(
    new URL("../evidence/creation-receipts.json", import.meta.url),
    "utf8",
  ),
);

test("real evidence detects one factory deploying four distinct ERC-20 LP tokens", () => {
  const facts = detect(fixture);
  assert.equal(facts.repeatDeployers.length, 1);
  assert.equal(
    facts.repeatDeployers[0].address,
    "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f",
  );
  assert.equal(facts.repeatDeployers[0].count, 4);
  assert.equal(new Set(facts.repeatDeployers[0].transactions).size, 4);
  for (const launch of fixture.launches) {
    const evidence = receipts.receipts.find(
      (r) => r.address === launch.address,
    );
    assert.equal(evidence.receipt.status, "0x1");
    assert.equal(Number(BigInt(evidence.receipt.blockNumber)), launch.block);
    assert.equal(evidence.receipt.blockHash, launch.blockHash);
    assert.equal(evidence.creator.toLowerCase(), launch.deployer);
    assert.equal(evidence.tokenType, "ERC-20");
    assert.ok(
      evidence.receipt.logs.some(
        (l) =>
          l.address.toLowerCase() === launch.deployer &&
          l.topics[0] ===
            "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9" &&
          "0x" + l.data.slice(26, 66) === launch.address,
      ),
    );
  }
});
test("real early buyers and subsequent sells have evidence and respect capture bounds", () => {
  const result = detect(fixture);
  assert.equal(fixture.swaps.length, 128);
  assert.equal(result.repeatBuyers.length, 6);
  assert.equal(result.groups.length, 8);
  assert.equal(result.sells.length, 15);
  for (const s of fixture.swaps) {
    const l = fixture.launches.find((x) => x.address === s.pool);
    assert.ok(s.block >= l.fromBlock && s.block <= l.toBlock);
    assert.match(s.transactionHash, /^0x[0-9a-f]{64}$/);
    assert.match(s.wallet, /^0x[0-9a-f]{40}$/);
  }
});
// Synthetic unit fixtures below test edge conditions, not public-chain claims.
test("duplicate creation evidence does not produce a repeat deployer", () => {
  const launch = fixture.launches[0];
  assert.equal(
    detect({ launches: [launch, launch] }).repeatDeployers.length,
    0,
  );
});
test("duplicate buys in one pool do not establish repeated launch participation", () => {
  const buy = fixture.swaps.find((s) => s.side === "buy");
  assert.equal(
    detect({ launches: fixture.launches, swaps: [buy, buy] }).repeatBuyers
      .length,
    0,
  );
});
test("synthetic: common native funding must precede first buys; movement follows sells", () => {
  const launches = [
    { address: "pool-a", deployer: "factory", block: 10, toBlock: 100 },
    { address: "pool-b", deployer: "factory", block: 10, toBlock: 100 },
  ];
  const swaps = [
    ...["alice", "bob"].flatMap((wallet) =>
      launches.map((l, i) => ({
        wallet,
        pool: l.address,
        block: 20 + i,
        side: "buy",
        eth: 1,
        transactionHash: `${wallet}-${i}`,
        logIndex: 1,
      })),
    ),
    {
      wallet: "alice",
      pool: "pool-a",
      block: 30,
      side: "sell",
      eth: 1,
      transactionHash: "sale",
      logIndex: 1,
    },
  ];
  const transfers = [
    { from: "fund", to: "alice", block: 15, eth: 1, transactionHash: "fund-a" },
    { from: "fund", to: "bob", block: 15, eth: 1, transactionHash: "fund-b" },
    {
      from: "alice",
      to: "destination",
      block: 31,
      eth: 0.7,
      transactionHash: "move",
    },
  ];
  const result = detect({ launches, swaps, transfers });
  assert.equal(result.sharedFunding.length, 1);
  assert.equal(result.groups.length, 1);
  assert.equal(result.sells.length, 1);
  assert.equal(result.movements.length, 1);
  assert.equal(
    detect({
      launches,
      swaps,
      transfers: transfers.map((t) => ({ ...t, block: 50 })),
    }).sharedFunding.length,
    0,
  );
  assert.equal(
    detect({
      launches,
      swaps,
      transfers: transfers.map((t) => ({ ...t, block: 1 })),
    }).movements.length,
    0,
  );
});
test("a sell before any buy is excluded from subsequent selling", () => {
  const buy = fixture.swaps.find((s) => s.side === "buy");
  assert.equal(
    detect({
      launches: fixture.launches,
      swaps: [buy, { ...buy, side: "sell", block: buy.block - 1 }],
    }).sells.length,
    0,
  );
});
test("polling baseline is silent, stable pages dedupe, new activity and gaps are explicit", () => {
  const page = [{ hash: "c" }, { hash: "b" }, { hash: "a" }];
  assert.deepEqual(diffActivity(null, page, true), {
    cursor: "c",
    hashes: [],
    gap: false,
  });
  assert.deepEqual(diffActivity("c", page, true), {
    cursor: "c",
    hashes: [],
    gap: false,
  });
  assert.deepEqual(diffActivity("b", page, true), {
    cursor: "c",
    hashes: ["c"],
    gap: false,
  });
  assert.deepEqual(diffActivity("z", page, true), {
    cursor: "c",
    hashes: ["c", "b", "a"],
    gap: true,
  });
  assert.deepEqual(diffActivity("z", [], false), {
    cursor: "z",
    hashes: [],
    gap: false,
  });
});

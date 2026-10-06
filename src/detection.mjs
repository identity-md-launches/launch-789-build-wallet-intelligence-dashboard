/** Deterministic evidence rules shared by the browser and capture verification. */
export function detect({ launches = [], swaps = [], transfers = [] }) {
  const low = (s) => s.toLowerCase();
  const unique = (list) => [...new Set(list)];
  const byDeployer = new Map();
  for (const l of launches) {
    const key = low(l.deployer);
    byDeployer.set(key, [...(byDeployer.get(key) || []), l]);
  }
  const repeatDeployers = [...byDeployer]
    .map(([address, items]) => ({
      address,
      count: unique(items.map((x) => low(x.address))).length,
      transactions: unique(items.map((x) => x.transactionHash)),
    }))
    .filter((x) => x.count >= 2);
  // "Early" means the first captured Swap logs, bounded by each launch's declared range/cap.
  const buys = swaps.filter(
    (s) =>
      s.side === "buy" &&
      launches.some(
        (l) =>
          low(l.address) === low(s.pool) &&
          s.block >= l.block &&
          s.block <= l.toBlock,
      ),
  );
  const repeatBuyers = unique(buys.map((s) => low(s.wallet)))
    .map((wallet) => {
      const evidence = buys.filter((s) => low(s.wallet) === wallet);
      return {
        wallet,
        pools: unique(evidence.map((x) => low(x.pool))),
        count: unique(evidence.map((x) => low(x.pool))).length,
        transactions: unique(evidence.map((x) => x.transactionHash)),
        eth: evidence.reduce((a, b) => a + b.eth, 0),
      };
    })
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count || b.eth - a.eth);
  const groups = [];
  for (let i = 0; i < repeatBuyers.length; i++)
    for (let j = i + 1; j < repeatBuyers.length; j++) {
      const a = repeatBuyers[i],
        b = repeatBuyers[j];
      const commonPools = a.pools.filter((p) => b.pools.includes(p));
      if (commonPools.length >= 2)
        groups.push({
          wallets: [a.wallet, b.wallet],
          pools: commonPools,
          count: commonPools.length,
          status: "co-occurrence, not proven coordination",
        });
    }
  const firstBuy = (wallet) =>
    Math.min(
      ...buys.filter((s) => low(s.wallet) === wallet).map((x) => x.block),
    );
  const funding = transfers.filter(
    (t) =>
      repeatBuyers.some((w) => w.wallet === low(t.to)) &&
      t.eth > 0 &&
      t.block < firstBuy(low(t.to)),
  );
  const sharedFunding = unique(funding.map((t) => low(t.from)))
    .map((funder) => ({
      funder,
      wallets: unique(
        funding.filter((t) => low(t.from) === funder).map((t) => low(t.to)),
      ),
      transactions: unique(
        funding
          .filter((t) => low(t.from) === funder)
          .map((t) => t.transactionHash),
      ),
    }))
    .filter((x) => x.wallets.length >= 2);
  // A subsequent sell requires a prior buy by this transaction sender in this pool.
  const sells = swaps.filter(
    (s) =>
      s.side === "sell" &&
      buys.some(
        (b) =>
          low(b.wallet) === low(s.wallet) &&
          low(b.pool) === low(s.pool) &&
          (b.block < s.block ||
            (b.block === s.block && b.logIndex < s.logIndex)),
      ),
  );
  const movements = transfers.filter((t) =>
    sells.some((s) => low(s.wallet) === low(t.from) && t.block > s.block),
  );
  return {
    repeatDeployers,
    repeatBuyers,
    groups,
    sharedFunding,
    sells,
    movements,
  };
}

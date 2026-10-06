import {
  readFile,
  writeFile,
  rename,
  mkdir,
  open,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { diffActivity } from "../src/monitor.mjs";

// One deterministic polling pass. Schedule externally; no AI, keys, signing or trades.
const args = process.argv.slice(2);
const configPath = args[args.indexOf("--config") + 1];
const statePath = args.includes("--state")
  ? args[args.indexOf("--state") + 1]
  : "/tmp/trace-monitor-state.json";
if (!args.includes("--config") || !configPath || configPath.startsWith("--")) {
  console.error(
    "Usage: node scripts/monitor.mjs --config watchlist.json --state /durable/path/state.json",
  );
  process.exit(1);
}
const config = JSON.parse(await readFile(configPath, "utf8"));
if (
  config.chainId !== 1 ||
  !Array.isArray(config.addresses) ||
  config.addresses.length > 20 ||
  !config.addresses.every((a) => /^0x[0-9a-f]{40}$/i.test(a))
)
  throw new Error("Expected chainId 1 and up to 20 Ethereum addresses");
await mkdir(path.dirname(statePath), { recursive: true });
const lockPath = statePath + ".lock";
const lock = await open(lockPath, "wx").catch(() => {
  throw new Error(
    `Another pass may be running: ${lockPath}. Check the process before removing a stale lock.`,
  );
});
let state;
try {
  try {
    state = JSON.parse(await readFile(statePath, "utf8"));
    if (state.chainId !== 1 || !state.cursors || !Array.isArray(state.alerts))
      throw new Error("Invalid state file; refusing to overwrite");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    state = { chainId: 1, cursors: {}, alerts: [] };
  }
  const failures = [];
  for (const address of [
    ...new Set(config.addresses.map((a) => a.toLowerCase())),
  ]) {
    try {
      const r = await fetch(
        `https://eth.blockscout.com/api/v2/addresses/${address}/transactions`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const page = await r.json();
      if (!Array.isArray(page.items))
        throw new Error("Malformed transaction page");
      const diff = diffActivity(
        state.cursors[address],
        page.items,
        !!page.next_page_params,
      );
      if (diff.cursor) state.cursors[address] = diff.cursor;
      for (const hash of diff.hashes)
        state.alerts.unshift({
          id: `${address}:${hash}`,
          address,
          transactionHash: hash,
          observedAt: new Date().toISOString(),
          kind: diff.gap ? "coverage gap" : "new activity",
          evidence: `https://eth.blockscout.com/tx/${hash}`,
        });
      console.log(
        `${address}: ${diff.hashes.length} new indexed transactions${diff.gap ? "; page gap, history incomplete" : ""}`,
      );
    } catch (e) {
      failures.push({ address, error: e.message });
    }
  }
  state.alerts = [
    ...new Map(state.alerts.map((a) => [a.id, a])).values(),
  ].slice(0, 200);
  state.checkedAt = new Date().toISOString();
  state.failures = failures;
  const pending = statePath + ".pending";
  await writeFile(pending, JSON.stringify(state, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(pending, statePath);
  console.log(
    JSON.stringify({
      checkedAt: state.checkedAt,
      addresses: config.addresses.length,
      storedAlerts: state.alerts.length,
      failures,
    }),
  );
  if (failures.length) process.exitCode = 2;
} finally {
  await lock.close();
  await unlink(lockPath);
}

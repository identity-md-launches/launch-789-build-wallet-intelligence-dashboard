import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const root = path.resolve("dist");
const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  consoleErrors: [],
  failedLocalResources: [],
  live: {},
  accessibility: [],
  viewports: [],
  contrast: [],
  limitations: [
    "Headless Chromium, not a physical device or screen-reader session.",
    "No native browser 200% zoom or translated locale session.",
    "Public APIs can change or throttle. Alert replay is explicitly synthetic.",
  ],
};
const check = (name, detail) => {
  report.checks.push({ name, result: "passed", detail });
  console.log(`PASS ${name}`);
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://local").pathname,
    );
    if (!pathname.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = path.join(root, pathname.slice(9) || "index.html");
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ["--no-sandbox"],
});
report.browser = await browser.version();
await mkdir("artifacts", { recursive: true });
const base = `http://127.0.0.1:${server.address().port}/preview/`;
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
page.on("pageerror", (e) => report.consoleErrors.push(e.message));
page.on("response", (r) => {
  if (r.url().startsWith(base) && r.status() >= 400)
    report.failedLocalResources.push({ url: r.url(), status: r.status() });
});
const axeSource = await readFile(
  process.env.AXE_PATH || require.resolve("axe-core/axe.min.js"),
  "utf8",
);
async function axe(label) {
  await page.evaluate(axeSource);
  const r = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    }),
  );
  report.accessibility.push({
    label,
    violations: r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    passes: r.passes.length,
    incomplete: r.incomplete.map((x) => x.id),
  });
  assert.equal(
    r.violations.length,
    0,
    `axe violations in ${label}: ${r.violations.map((x) => x.id).join(", ")}`,
  );
}
async function go(view) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: view, exact: true })
    .click();
  await page.waitForFunction(
    (name) =>
      [
        ...document.querySelectorAll('nav[aria-label="Main navigation"] a'),
      ].some(
        (el) =>
          el.getAttribute("aria-label") === name &&
          el.getAttribute("aria-current") === "page",
      ),
    view,
  );
}
async function overflow(label) {
  const m = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  report.viewports.push({ label, ...m });
  assert.ok(m.documentWidth <= m.width + 1, `${label}: root overflow`);
}
try {
  await page.goto(base);
  await page.locator("tbody tr").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator("tbody tr").count(), 4);
  assert.equal(await page.title(), "Trace — Wallet intelligence");
  assert.ok(await page.evaluate(() => document.fonts.check("12px Inter")));
  check(
    "production subpath and local font",
    "Export served under /preview/, four real creation rows present.",
  );
  await axe("desktop overview");
  await page.getByRole("textbox", { name: "Filter evidence" }).fill("DAI");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("textbox", { name: "Filter evidence" })
    .fill("no-matching-token");
  await page
    .getByRole("heading", { name: "No deployments match this filter" })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Sort deployments").selectOption("newest");
  assert.match(await page.locator("tbody tr").first().innerText(), /USDT/);
  await page.getByLabel("Sort deployments").selectOption("oldest");
  check("table filter, empty state and chronological sort");
  const evidence = page.getByRole("button", {
    name: "USDC / WETH UNI-V2 · ERC-20 LP",
  });
  await evidence.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "USDC / WETH" }).waitFor();
  assert.ok(
    await page.evaluate(() =>
      document.querySelector("dialog").contains(document.activeElement),
    ),
  );
  assert.ok(
    (
      await page
        .getByRole("link", { name: /Open creation transaction/ })
        .getAttribute("href")
    ).includes("0xd07cbde8"),
  );
  await axe("creation evidence dialog");
  await page.keyboard.press("Escape");
  assert.ok(await evidence.evaluate((el) => el === document.activeElement));
  check("keyboard evidence dialog, real transaction link and focus return");
  await page
    .getByRole("button", { name: "Buyer overlap", exact: true })
    .click();
  await page.getByText("6 buyers", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Deployments", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Early buyers", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 6);
  await page
    .getByRole("button", { name: "Shared funding", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "No shared funder observed" })
    .waitFor();
  await page
    .getByRole("button", { name: "Selling & proceeds", exact: true })
    .click();
  assert.equal(
    await page.getByRole("link", { name: /Sell evidence/ }).count(),
    15,
  );
  check("buyer overlap, funding limitation and 15 subsequent sell links");
  await page
    .getByRole("button", { name: "Investigate with IMD", exact: true })
    .click();
  await page
    .getByLabel("Investigation question")
    .fill(
      "Verify the repeat factory; distinguish observations from ownership.",
    );
  const imdDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download IMD case" }).click();
  const packet = JSON.parse(
    await readFile(await (await imdDownload).path(), "utf8"),
  );
  assert.equal(packet.status, "not submitted");
  assert.equal(packet.data.launches.length, 4);
  assert.match(packet.question, /Verify the repeat factory/);
  await page.keyboard.press("Escape");
  check(
    "IMD packet export",
    "Downloaded JSON contains edited question, real evidence and not-submitted status.",
  );
  const exportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = JSON.parse(
    await readFile(await (await exportDownload).path(), "utf8"),
  );
  assert.equal(exported.swaps.length, 128);
  check("evidence JSON export");
  const search = page.getByRole("textbox", {
    name: "Search wallet or token address",
  });
  await search.fill("not-an-address");
  await page
    .getByRole("button", { name: "Search address", exact: true })
    .click();
  assert.equal(await search.getAttribute("aria-invalid"), "true");
  await page
    .getByText("Enter an Ethereum address:", { exact: false })
    .waitFor();
  await search.fill("0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc");
  await search.press("Enter");
  await page.getByText("Address in captured case").waitFor();
  await page.getByRole("button", { name: "Clear selected address" }).click();
  check("address validation and captured token search");
  for (const n of ["Base", "Solana", "Robinhood Chain"]) {
    await page.getByLabel("Network", { exact: true }).selectOption(n);
    await page
      .getByRole("heading", { name: `${n} is not connected` })
      .waitFor();
    assert.ok(await search.isDisabled());
  }
  await page.getByRole("button", { name: "Explore Ethereum" }).click();
  check("all three unsupported networks explicitly labeled");
  await go("Watchlist");
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  assert.ok(page.url().endsWith("#watchlist"));
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");
  check("skip link preserves the current route");
  await page.getByRole("button", { name: "Watch the demo factory" }).click();
  await page.reload();
  await page.getByText("Uniswap V2 factory", { exact: true }).waitFor();
  assert.equal(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("trace.watch.v1")),
    ).length,
    1,
  );
  await page.getByLabel("Ethereum address", { exact: true }).fill("bad");
  await page.getByRole("button", { name: "Add address", exact: true }).click();
  await page
    .getByText("Use 0x followed by 40 hexadecimal characters.")
    .waitFor();
  check("watchlist persistence and input validation");
  await page.getByRole("button", { name: "Check now", exact: true }).click();
  await page
    .getByRole("button", { name: "Check now", exact: true })
    .waitFor({ timeout: 30000 });
  const baseline = await page.locator(".check-status").innerText();
  report.live.monitorBaseline = baseline;
  const savedAlerts = JSON.parse(
    await page.evaluate(() => localStorage.getItem("trace.alerts.v1")),
  );
  assert.equal(savedAlerts.length, 0);
  if (!baseline.includes("Checked 1/1"))
    throw new Error(`Public monitoring baseline failed: ${baseline}`);
  check("real public-indexer monitoring baseline", baseline);
  // Synthetic replay isolates alert creation from unpredictable live block timing.
  let replay = 0;
  const fixtureAddress = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f";
  const hash1 = "0x" + "1".repeat(64),
    hash2 = "0x" + "2".repeat(64);
  await page.route(
    `https://eth.blockscout.com/api/v2/addresses/${fixtureAddress}/transactions`,
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          items: replay++
            ? [{ hash: hash2 }, { hash: hash1 }]
            : [{ hash: hash1 }],
          next_page_params: null,
        }),
      }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Check now", exact: true }).click();
  await page.getByRole("button", { name: "Check now", exact: true }).waitFor();
  await page.getByRole("button", { name: "Check now", exact: true }).click();
  await page.getByRole("button", { name: "Check now", exact: true }).waitFor();
  await go("Alerts");
  await page.getByText("new activity", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: /View transaction/ }).count(),
    1,
  );
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.getByText("0 unread", { exact: true }).waitFor();
  await page.unrouteAll();
  check(
    "synthetic monitoring replay and mark-read",
    "Two mocked pages generate one deduplicated alert; test-only hashes never enter shipped data.",
  );
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.locator("tbody tr").first().waitFor();
  await search.fill("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
  await search.press("Enter");
  await page
    .getByText("Live indexer response", { exact: true })
    .waitFor({ timeout: 60000 });
  report.live.lookup = await page.locator(".live-panel").innerText();
  assert.match(report.live.lookup, /Wrapped Ether|WETH/i);
  check(
    "real live token lookup",
    "Public Blockscout browser request for WETH succeeded.",
  );
  await page.getByRole("button", { name: "Return to captured case" }).click();
  await page.route("https://eth.blockscout.com/api/v2/addresses/**", (r) =>
    r.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await search.fill("0x" + "3".repeat(40));
  await search.press("Enter");
  await page
    .getByText("The public indexer returned 503. Try again shortly.")
    .waitFor();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.unrouteAll();
  check(
    "recoverable provider failure",
    "Synthetic 503 shown with retry guidance; captured evidence remains available.",
  );
  await go("Buyer network");
  assert.equal(await page.locator(".pair-panel .finding-row").count(), 8);
  await go("Deployments");
  assert.equal(await page.locator("tbody tr").count(), 4);
  await go("Overview");
  check("hash navigation, dedicated deployments and recurring groups");
  const noticeClose = page.getByRole("button", {
    name: "Dismiss notification",
  });
  if (await noticeClose.isVisible()) await noticeClose.click();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await overflow(`overview ${width}`);
    if ([1440, 390, 320].includes(width)) {
      await axe(`overview ${width}`);
      await page.screenshot({
        path: `artifacts/overview-${width}.jpg`,
        fullPage: true,
        type: "jpeg",
        quality: 78,
      });
    }
    await go("Watchlist");
    await overflow(`watchlist ${width}`);
    await go("Alerts");
    await overflow(`alerts ${width}`);
    await go("Overview");
  }
  check(
    "responsive reflow",
    "No root horizontal overflow at 1440, 1024, 768, 390 and 320 CSS px; evidence tables scroll within their region.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Investigate with IMD", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const focus = await page
    .getByRole("button", { name: "Investigate with IMD", exact: true })
    .evaluate((el) => ({
      color: getComputedStyle(el).outlineColor,
      width: getComputedStyle(el).outlineWidth,
      style: getComputedStyle(el).outlineStyle,
    }));
  assert.equal(focus.width, "2px");
  await page.screenshot({
    path: "artifacts/keyboard-focus.jpg",
    type: "jpeg",
    quality: 78,
  });
  report.focus = focus;
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animations = await page.evaluate(() => {
    const el = document.createElement("i");
    el.className = "spinner";
    document.body.append(el);
    const value = getComputedStyle(el).animationName;
    el.remove();
    return value;
  });
  assert.equal(animations, "none");
  check("visible focus styles and reduced-motion spinner fallback");
  report.contrast = await page.evaluate(() => {
    const lum = (rgb) => {
      const parts = rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
    };
    return [
      ".page-heading p",
      ".metric-top",
      ".metric-value",
      ".badge.green",
      ".primary-button",
      '.tabs button[aria-pressed="true"]',
    ].map((selector) => {
      const el = document.querySelector(selector);
      let p = el;
      let bg = "rgba(0, 0, 0, 0)";
      while (p && bg === "rgba(0, 0, 0, 0)") {
        bg = getComputedStyle(p).backgroundColor;
        p = p.parentElement;
      }
      const fg = getComputedStyle(el).color;
      const a = lum(fg),
        b = lum(bg);
      return {
        selector,
        foreground: fg,
        background: bg,
        ratio: Number(
          ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2),
        ),
      };
    });
  });
  assert.ok(report.contrast.every((p) => p.ratio >= 4.5));
  check("measured rendered contrast pairs", report.contrast);
  assert.equal(report.consoleErrors.length, 0);
  assert.equal(report.failedLocalResources.length, 0);
  check("no runtime exceptions or failed local resources");
  report.result = "passed";
} catch (e) {
  report.result = "failed";
  report.error = e.stack;
  console.error(e);
  process.exitCode = 1;
  await page
    .screenshot({ path: "/tmp/trace-browser-failure.png", fullPage: true })
    .catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(
    "artifacts/browser-validation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((r) => server.close(r));
}

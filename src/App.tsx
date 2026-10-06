import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  Fingerprint,
  GitBranch,
  Globe2,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Network,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Wallet,
  X,
} from "./icons";
import { detect } from "./detection.mjs";
import { diffActivity } from "./monitor.mjs";
import {
  API,
  FACTORY,
  getJson,
  lookup,
  validAddress,
  type TxPage,
} from "./api";
import {
  Address,
  Badge,
  CopyButton,
  download,
  Empty,
  EvidenceLink,
  Modal,
  amount,
  date,
  num,
  short,
} from "./components";
import type { Alert, CaseData, Launch, LiveResult, Watch } from "./types";

type View =
  | "overview"
  | "deployments"
  | "buyers"
  | "watchlist"
  | "alerts"
  | "coverage";
type Tab = "deployments" | "buyers" | "funding" | "selling";
const views: View[] = [
  "overview",
  "deployments",
  "buyers",
  "watchlist",
  "alerts",
  "coverage",
];
const networkNames = ["Ethereum", "Base", "Solana", "Robinhood Chain"];
const getView = (): View =>
  views.includes(location.hash.slice(1) as View)
    ? (location.hash.slice(1) as View)
    : "overview";
function stored<T>(
  key: string,
  fallback: T,
  check: (value: unknown) => boolean,
): T {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) || "null");
    return check(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}
const validWatch = (x: unknown) =>
  Array.isArray(x) &&
  x.length <= 20 &&
  x.every(
    (w) =>
      w &&
      validAddress(w.address) &&
      typeof w.name === "string" &&
      typeof w.addedAt === "string",
  );
const validAlerts = (x: unknown) =>
  Array.isArray(x) &&
  x.every(
    (a) =>
      a &&
      typeof a.id === "string" &&
      validAddress(a.address) &&
      /^0x[0-9a-f]{64}$/i.test(a.transactionHash) &&
      typeof a.timestamp === "string",
  );

export default function App() {
  const [data, setData] = useState<CaseData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>(getView);
  const [network, setNetwork] = useState("Ethereum");
  const [query, setQuery] = useState("");
  const [queryError, setQueryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [tab, setTab] = useState<Tab>("deployments");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("oldest");
  const [dialog, setDialog] = useState<"imd" | "method" | Launch | null>(null);
  const [notice, setNotice] = useState("");
  const [watch, setWatch] = useState<Watch[]>(() =>
    stored("trace.watch.v1", [], validWatch),
  );
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    stored("trace.alerts.v1", [], validAlerts),
  );
  const [monitor, setMonitor] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState(
    "Not checked yet. The first check establishes a baseline.",
  );
  const [watchInput, setWatchInput] = useState("");
  const [watchError, setWatchError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const watchRef = useRef<HTMLInputElement>(null);
  const checkingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cursors = useRef<Record<string, string>>({});
  const [graphMode, setGraphMode] = useState("deployments");
  const analysis = useMemo(() => detect(data || {}), [data]);
  const unread = alerts.filter((a) => !a.read).length;

  const loadCase = useCallback(() => {
    setLoadError("");
    getJson<CaseData>(new URL("data/ethereum-case.json", document.baseURI).href)
      .then(setData)
      .catch(() =>
        setLoadError(
          "The evidence file could not load. Reload the page or check that the complete dist folder is published.",
        ),
      );
  }, []);
  useEffect(loadCase, [loadCase]);
  useEffect(() => {
    const handler = () => {
      setView(getView());
      setFilter("");
      setSelectedAddress("");
      setLive(null);
      setQueryError("");
      abortRef.current?.abort();
      setBusy(false);
    };
    window.addEventListener("hashchange", handler);
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !document.querySelector("dialog[open]") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("keydown", key);
      abortRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("trace.watch.v1", JSON.stringify(watch));
    } catch {
      setNotice(
        "Browser storage is unavailable. Keep this tab open or export your watchlist.",
      );
    }
  }, [watch]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "trace.alerts.v1",
        JSON.stringify(alerts.slice(0, 200)),
      );
    } catch {
      setNotice(
        "Alerts could not be saved to this browser. Export them before closing.",
      );
    }
  }, [alerts]);

  function navigate(v: View) {
    if (location.hash === `#${v}`) {
      setLive(null);
      setSelectedAddress("");
      setFilter("");
    } else location.hash = v;
  }
  function addWatch(address: string, name = short(address)) {
    const normalized = address.toLowerCase();
    if (!validAddress(normalized)) {
      setWatchError("Use 0x followed by 40 hexadecimal characters.");
      watchRef.current?.focus();
      return;
    }
    if (watch.some((w) => w.address === normalized)) {
      setNotice("This address is already on your watchlist.");
      return;
    }
    if (watch.length >= 20) {
      setNotice(
        "This local watchlist supports 20 addresses. Remove one before adding another.",
      );
      return;
    }
    setWatch((w) => [
      ...w,
      { address: normalized, name, addedAt: new Date().toISOString() },
    ]);
    setWatchInput("");
    setWatchError("");
    setNotice("Address added to your Ethereum watchlist.");
  }
  function toggleWatch(address: string, name: string) {
    if (watch.some((w) => w.address === address.toLowerCase())) {
      setWatch((w) => w.filter((x) => x.address !== address.toLowerCase()));
      delete cursors.current[address.toLowerCase()];
      setNotice("Address removed from the watchlist.");
    } else addWatch(address, name);
  }
  async function checkActivity() {
    if (checkingRef.current || !watch.length) return;
    checkingRef.current = true;
    setChecking(true);
    const incoming: Alert[] = [];
    const failures: string[] = [];
    try {
      for (const w of watch) {
        try {
          const page = await getJson<TxPage>(
            `${API}/addresses/${w.address}/transactions`,
          );
          const diff = diffActivity(
            cursors.current[w.address],
            page.items,
            !!page.next_page_params,
          );
          if (diff.cursor) cursors.current[w.address] = diff.cursor;
          for (const hash of diff.hashes)
            incoming.push({
              id: `${w.address}:${hash}`,
              address: w.address,
              transactionHash: hash,
              timestamp: new Date().toISOString(),
              read: false,
              kind: diff.gap ? "coverage gap" : "new activity",
            });
        } catch {
          failures.push(short(w.address));
        }
      }
      setAlerts((old) =>
        [
          ...new Map([...incoming, ...old].map((a) => [a.id, a])).values(),
        ].slice(0, 200),
      );
      const message = `Checked ${watch.length - failures.length}/${watch.length} addresses at ${new Date().toLocaleTimeString()}. ${incoming.length} new transaction observations.${failures.length ? ` Unavailable: ${failures.join(", ")}. Try again shortly.` : ""}`;
      setCheckStatus(message);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }
  const checkFn = useRef(checkActivity);
  checkFn.current = checkActivity;
  useEffect(() => {
    if (!monitor) return;
    void checkFn.current();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void checkFn.current();
    }, 60000);
    return () => clearInterval(id);
  }, [monitor]);

  async function liveLookup(address: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setQueryError("");
    setLive(null);
    setSelectedAddress("");
    try {
      const result = await lookup(address, controller.signal);
      if (!controller.signal.aborted) {
        setLive(result);
        setNotice(`Loaded public history for ${short(address)}.`);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setQueryError(
          e instanceof Error
            ? e.message
            : "Lookup failed. Check your connection and retry.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function search(e: FormEvent) {
    e.preventDefault();
    const address = query.trim().toLowerCase();
    if (!validAddress(address)) {
      setQueryError(
        "Enter an Ethereum address: 0x followed by 40 hexadecimal characters.",
      );
      searchRef.current?.focus();
      return;
    }
    if (network !== "Ethereum") return;
    const found =
      data &&
      (address === FACTORY ||
        data.launches.some((l) => [l.address, l.initiator].includes(address)) ||
        data.swaps.some((s) => s.wallet === address));
    if (found) {
      setSelectedAddress(address);
      setLive(null);
      setQueryError("");
      setFilter("");
      setNotice(
        "Found in the captured Ethereum case. Use Fetch live history for current indexed activity.",
      );
    } else void liveLookup(address);
  }
  function exportCase() {
    if (data) {
      download("trace-ethereum-evidence.json", {
        ...data,
        analysis,
        limitations: limitations(),
      });
      setNotice("Evidence export downloaded.");
    }
  }
  function limitations() {
    return [
      "Selected historical Uniswap V2 LP tokens; expected factory behavior.",
      "First 32 Swap logs per pool within 100,000 blocks of creation. Sparse or capped histories are not complete lifecycles.",
      "Transaction sender is an observed actor, not a proven beneficial owner. Routers and aggregators can confound attribution.",
      "Shared funding and repeated co-occurrence do not establish coordination or a bundle.",
      "Native ETH transfers after selling cannot establish the origin of funds.",
      "No bundle, common ownership, or malicious intent is confirmed.",
    ];
  }
  const currentTab =
    view === "deployments" ? "deployments" : view === "buyers" ? "buyers" : tab;
  const launches = (data?.launches || [])
    .filter(
      (l) =>
        !filter ||
        `${l.name} ${l.address} ${l.deployer}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "newest" ? b.block - a.block : a.block - b.block,
    );
  const scopeLaunches = selectedAddress
    ? launches.filter(
        (l) =>
          [l.address, l.deployer, l.initiator].includes(selectedAddress) ||
          data?.swaps.some(
            (s) => s.wallet === selectedAddress && s.pool === l.address,
          ),
      )
    : launches;
  const isUnsupported = network !== "Ethereum";
  const titles: Record<View, string> = {
    overview: "Wallet intelligence",
    deployments: "Deployment history",
    buyers: "Buyer network",
    watchlist: "Watchlist",
    alerts: "Activity alerts",
    coverage: "Data & coverage",
  };
  const nav = [
    { view: "overview" as View, label: "Overview", icon: LayoutDashboard },
    { view: "deployments" as View, label: "Deployments", icon: Layers3 },
    { view: "buyers" as View, label: "Buyer network", icon: Network },
    { view: "watchlist" as View, label: "Watchlist", icon: Star },
    { view: "alerts" as View, label: "Alerts", icon: Bell },
  ];

  function renderTable() {
    return (
      <section
        className="panel evidence-panel"
        aria-label="Captured on-chain evidence"
      >
        <div className="panel-heading">
          <div>
            <h2>
              {view === "overview" ? "Follow the evidence" : titles[view]}
            </h2>
            <p>Selected Ethereum history · May 2020</p>
          </div>
          <button
            className="icon-button"
            aria-label="Read detection methodology"
            onClick={() => setDialog("method")}
          >
            <CircleHelp size={17} />
          </button>
        </div>
        {view === "overview" && (
          <div className="tabs" aria-label="Evidence categories">
            {(["deployments", "buyers", "funding", "selling"] as Tab[]).map(
              (t) => (
                <button
                  key={t}
                  aria-pressed={currentTab === t}
                  onClick={() => {
                    setTab(t);
                    setFilter("");
                  }}
                >
                  {
                    {
                      deployments: "Deployments",
                      buyers: "Early buyers",
                      funding: "Shared funding",
                      selling: "Selling & proceeds",
                    }[t]
                  }
                </button>
              ),
            )}
          </div>
        )}
        <div className="table-tools">
          <label className="filter">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Filter evidence</span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={
                currentTab === "deployments"
                  ? "Filter by token or address…"
                  : "Filter by wallet address…"
              }
            />
          </label>
          {currentTab === "deployments" && (
            <label className="sort">
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span className="sr-only">Sort deployments</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          )}
        </div>
        {currentTab === "deployments" && (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Evidence table, scroll horizontally for all columns"
            >
              <table>
                <caption className="sr-only">
                  Verified pool-token deployments
                </caption>
                <thead>
                  <tr>
                    <th>Token / pool</th>
                    <th>Deployer</th>
                    <th>Created</th>
                    <th>Evidence</th>
                    <th>
                      <span className="sr-only">Watch</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scopeLaunches.map((l, i) => (
                    <tr key={l.address}>
                      <td>
                        <button
                          className="token-cell"
                          onClick={() => setDialog(l)}
                        >
                          <span
                            className={`token-icon token-${l.name.split(" ")[0].toLowerCase()}`}
                          >
                            {l.name.startsWith("USDC")
                              ? "$"
                              : l.name.startsWith("DAI")
                                ? "◈"
                                : l.name.startsWith("USDT")
                                  ? "₮"
                                  : "₿"}
                          </span>
                          <span>
                            <strong>{l.name}</strong>
                            <span className="subtext">
                              UNI-V2 <span className="dot-separator">·</span>{" "}
                              ERC-20 LP
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <Address value={l.deployer} />
                        <span className="subtext">Uniswap V2 factory</span>
                      </td>
                      <td>
                        <span>{date(l.timestamp)}</span>
                        <span className="subtext mono">#{num(l.block)}</span>
                      </td>
                      <td>
                        <button
                          className="verified-button"
                          onClick={() => setDialog(l)}
                        >
                          <ShieldCheck size={14} /> Verified{" "}
                          <ChevronRight size={12} />
                        </button>
                      </td>
                      <td>
                        <button
                          className={`icon-button ${watch.some((w) => w.address === l.address) ? "saved" : ""}`}
                          aria-label={`${watch.some((w) => w.address === l.address) ? "Remove" : "Watch"} ${l.name}`}
                          onClick={() => toggleWatch(l.address, l.name)}
                        >
                          <Star
                            size={16}
                            fill={
                              watch.some((w) => w.address === l.address)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!scopeLaunches.length && (
              <Empty title="No deployments match this filter">
                <button
                  className="text-button"
                  onClick={() => {
                    setFilter("");
                    setSelectedAddress("");
                  }}
                >
                  Clear filters
                </button>
              </Empty>
            )}
          </>
        )}
        {currentTab === "buyers" && (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Evidence table, scroll horizontally for all columns"
            >
              <table>
                <caption className="sr-only">
                  Transaction senders buying in at least two captured pools
                </caption>
                <thead>
                  <tr>
                    <th>Transaction sender</th>
                    <th>Pools</th>
                    <th>Observed WETH in</th>
                    <th>Evidence</th>
                    <th>
                      <span className="sr-only">Watch</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.repeatBuyers
                    .filter(
                      (b) =>
                        b.wallet.includes(filter.toLowerCase()) &&
                        (!selectedAddress ||
                          selectedAddress === FACTORY ||
                          selectedAddress === b.wallet ||
                          b.pools.includes(selectedAddress)),
                    )
                    .map((b) => (
                      <tr key={b.wallet}>
                        <td>
                          <div className="wallet-cell">
                            <span className="wallet-icon">
                              <Wallet size={16} />
                            </span>
                            <Address value={b.wallet} />
                          </div>
                        </td>
                        <td>
                          <Badge tone="purple">{b.count} pools</Badge>
                        </td>
                        <td className="mono">{amount(b.eth)} ETH</td>
                        <td>
                          <EvidenceLink
                            hash={b.transactions[0]}
                            label="First buy"
                          />
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Watch buyer ${short(b.wallet)}`}
                            onClick={() =>
                              toggleWatch(b.wallet, `Buyer ${short(b.wallet)}`)
                            }
                          >
                            <Star
                              size={15}
                              fill={
                                watch.some((w) => w.address === b.wallet)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!analysis.repeatBuyers.some((b) =>
              b.wallet.includes(filter.toLowerCase()),
            ) && (
              <Empty title="No repeated buyers in this selection">
                Repeated buying requires the same transaction sender in at least
                two pools.{" "}
                <button className="text-button" onClick={() => setFilter("")}>
                  Clear filter
                </button>
              </Empty>
            )}
          </>
        )}
        {currentTab === "funding" && (
          <div className="evidence-body">
            <div className="inline-note">
              <CircleHelp size={16} />
              <p>
                Shared incoming ETH before a first observed buy is a funding
                link. Exchanges and services can fund unrelated wallets.
              </p>
            </div>
            {analysis.sharedFunding
              .filter((f) =>
                [f.funder, ...f.wallets].some((w) =>
                  w.includes(filter.toLowerCase()),
                ),
              )
              .map((f) => (
                <div className="finding-row" key={f.funder}>
                  <div>
                    <Address value={f.funder} />
                    <p>
                      Funded {f.wallets.length} repeated buyers before their
                      first observed buy
                    </p>
                  </div>
                  <EvidenceLink
                    hash={f.transactions[0]}
                    label="Funding transfer"
                  />
                </div>
              ))}
            {!analysis.sharedFunding.length && (
              <Empty
                icon={<GitBranch size={26} />}
                title="No shared funder observed"
              >
                <p>
                  The captured transfer window does not establish a shared
                  funding source. This is not evidence that none exists.
                </p>
                <button
                  className="text-button"
                  onClick={() => setDialog("method")}
                >
                  Review coverage <ArrowRight size={14} />
                </button>
              </Empty>
            )}
          </div>
        )}
        {currentTab === "selling" && (
          <div className="evidence-body">
            <div className="inline-note">
              <CircleHelp size={16} />
              <p>
                Sells follow a buy by the same transaction sender in the same
                pool. Later ETH transfers show movement, not the proven origin
                of proceeds.
              </p>
            </div>
            {analysis.sells
              .filter((s) => s.wallet.includes(filter.toLowerCase()))
              .map((s) => (
                <div
                  className="finding-row"
                  key={`${s.transactionHash}:${s.logIndex}`}
                >
                  <span className="event-icon sell">
                    <ArrowUpRight size={16} />
                  </span>
                  <div>
                    <Address value={s.wallet} />
                    <p>
                      {amount(s.eth)} WETH out ·{" "}
                      {data?.launches.find((l) => l.address === s.pool)?.name}
                    </p>
                    <span className="subtext">
                      Block {num(s.block)} · recipient {short(s.recipient)}
                    </span>
                  </div>
                  <EvidenceLink
                    hash={s.transactionHash}
                    label="Sell evidence"
                  />
                </div>
              ))}
            {!analysis.sells.length && (
              <Empty title="No subsequent sells observed">
                Sell coverage is limited to the captured Swap events.
              </Empty>
            )}
            {!analysis.movements.length && (
              <div className="inline-note">
                <Database size={16} />
                <p>
                  Proceeds tracing is incomplete. No later native ETH movement
                  was established in the captured transfer pages. Review funding
                  coverage for capped or failed history queries. This does not
                  mean proceeds stayed in the wallet.
                </p>
              </div>
            )}
            {analysis.movements.length > 0 && (
              <>
                <h3 className="section-label">Later native ETH movement</h3>
                {analysis.movements
                  .filter(
                    (t) =>
                      t.from.includes(filter.toLowerCase()) ||
                      t.to.includes(filter.toLowerCase()),
                  )
                  .map((t) => (
                    <div className="finding-row" key={t.transactionHash}>
                      <div>
                        <Address value={t.from} /> <ArrowRight size={12} />{" "}
                        <Address value={t.to} />
                        <p>
                          {amount(t.eth)} ETH · block {num(t.block)}
                        </p>
                      </div>
                      <EvidenceLink hash={t.transactionHash} label="Transfer" />
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
        <div className="table-footer">
          <span>
            <span className="status-dot" /> Public transaction evidence
          </span>
          <button className="text-button" onClick={exportCase}>
            Export JSON <ArrowDownToLine size={13} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Trace overview">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          trace<span className="brand-period">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">
            <Fingerprint size={19} />
          </span>
          <span>
            Research workspace<small>Local workspace</small>
          </span>
        </div>
        <span className="nav-label">Workspace</span>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <a
              key={n.view}
              href={`#${n.view}`}
              aria-label={n.label}
              aria-current={view === n.view ? "page" : undefined}
              onClick={() => navigate(n.view)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.view === "watchlist" && watch.length > 0 && (
                <span className="nav-count">{watch.length}</span>
              )}
              {n.view === "alerts" && unread > 0 && (
                <span className="nav-count">{unread}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-card">
            <span className="research-symbol">
              <Sparkles size={20} />
            </span>
            <h3>Go beyond the signal.</h3>
            <p>Bring on-chain evidence into a deeper IMD investigation.</p>
            <button onClick={() => setDialog("imd")}>
              Prepare investigation <ArrowUpRight size={15} />
            </button>
          </div>
          <a
            href="#coverage"
            aria-current={view === "coverage" ? "page" : undefined}
          >
            <Database size={17} />
            Data & coverage
            <ArrowUpRight size={13} />
          </a>
          <button onClick={() => setDialog("method")}>
            <BookOpen size={17} />
            How detection works
          </button>
          <div className="sidebar-foot">
            <span className="status-dot" /> Ethereum integration{" "}
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>Intelligence</span>
          </div>
          <form className="global-search" onSubmit={search}>
            <label htmlFor="address-search">
              <Search size={16} />
              <span className="sr-only">Search wallet or token address</span>
            </label>
            <input
              ref={searchRef}
              id="address-search"
              name="address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search wallet or token address"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!queryError}
              aria-describedby={queryError ? "query-error" : undefined}
              disabled={isUnsupported}
            />
            <button
              type="submit"
              aria-label="Search address"
              disabled={busy || isUnsupported}
            >
              {busy ? (
                <LoaderCircle size={15} className="spinner" />
              ) : (
                <ArrowRight size={16} />
              )}
            </button>
            <kbd aria-hidden="true">/</kbd>
          </form>
          <button
            className="icon-button top-bell"
            aria-label={`Open alerts${unread ? `, ${unread} unread` : ""}`}
            onClick={() => navigate("alerts")}
          >
            <Bell size={18} />
            {unread > 0 && <span className="notification-dot" />}
          </button>
          <div className="profile-avatar" title="Local research workspace">
            R
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-grid">▦</span> On-chain research
              </div>
              <h1>{live ? "Address explorer" : titles[view]}</h1>
              <p>
                {view === "overview"
                  ? "Follow the wallets. Understand the connections."
                  : view === "watchlist"
                    ? "Keep the addresses that matter within reach."
                    : view === "alerts"
                      ? "New activity, backed by transaction evidence."
                      : view === "coverage"
                        ? "Know what the evidence can tell you."
                        : "Explore the history behind the activity."}
              </p>
            </div>
            <label className="network-select">
              <span className="network-icon" aria-hidden="true">
                ⟠
              </span>
              <span className="sr-only">Network</span>
              <select
                aria-label="Network"
                value={network}
                onChange={(e) => {
                  setNetwork(e.target.value);
                  abortRef.current?.abort();
                  setBusy(false);
                  setQueryError("");
                  setLive(null);
                  setSelectedAddress("");
                }}
              >
                {networkNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {n !== "Ethereum" ? " · unsupported" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
          </div>
          {queryError && (
            <div className="error-banner" id="query-error" role="alert">
              {queryError}
              <button
                className="text-button"
                onClick={() => {
                  setQueryError("");
                  setQuery("");
                }}
              >
                Clear search
              </button>
            </div>
          )}
          {busy && (
            <div className="loading-banner" role="status">
              <LoaderCircle size={17} className="spinner" /> Looking up public
              Ethereum history…{" "}
              <button
                className="text-button"
                onClick={() => {
                  abortRef.current?.abort();
                  setBusy(false);
                }}
              >
                Cancel lookup
              </button>
            </div>
          )}
          {loadError && (
            <div className="error-banner" role="alert">
              {loadError}
              <button onClick={loadCase}>Retry evidence load</button>
            </div>
          )}
          {!data && !loadError && (
            <div className="loading-banner" role="status">
              <LoaderCircle size={18} className="spinner" /> Loading captured
              public evidence…
            </div>
          )}
          {isUnsupported ? (
            <section className="panel unsupported">
              <Globe2 size={36} />
              <Badge tone="amber">Integration not available</Badge>
              <h2>{network} is not connected</h2>
              <p>
                This release verifies Ethereum.{" "}
                {network === "Solana"
                  ? "Solana needs SPL mint history, archival transactions and program-specific swap decoding."
                  : network === "Base"
                    ? "Base needs a configured RPC, an indexed history provider and chain-specific verification."
                    : "Robinhood Chain needs verified network parameters, a public data provider and historical coverage."}
              </p>
              <button
                className="primary-button"
                onClick={() => setNetwork("Ethereum")}
              >
                Explore Ethereum <ArrowRight size={15} />
              </button>
            </section>
          ) : (
            <>
              {live ? (
                <section className="panel live-panel">
                  <div className="panel-heading">
                    <div>
                      <Badge tone="green">Live indexer response</Badge>
                      <h2>
                        {live.address.token?.name ||
                          live.address.name ||
                          "Ethereum address"}
                      </h2>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        addWatch(
                          live.address.hash,
                          live.address.name || short(live.address.hash),
                        )
                      }
                    >
                      <Star size={14} /> Watch address
                    </button>
                  </div>
                  <div className="evidence-body">
                    <code className="full-address">{live.address.hash}</code>
                    <div className="identity-meta">
                      <Badge>
                        {live.address.is_contract
                          ? live.address.token?.type || "Contract"
                          : "Wallet / EOA"}
                      </Badge>
                      <span>
                        Retrieved {new Date(live.fetchedAt).toLocaleString()}
                      </span>
                    </div>
                    {live.address.creator_address_hash && (
                      <p>
                        Indexed creator:{" "}
                        <Address value={live.address.creator_address_hash} />{" "}
                        {live.address.creation_transaction_hash && (
                          <EvidenceLink
                            hash={live.address.creation_transaction_hash}
                            label="Creation transaction"
                          />
                        )}
                      </p>
                    )}
                    <div className="inline-note">
                      <Database size={16} />
                      <p>
                        Most recent page only: up to 50 transactions and 50
                        internal traces.{" "}
                        {live.more
                          ? "Older pages exist."
                          : "No further page reported."}{" "}
                        Created contracts below have not been classified as
                        tokens. Funding and buyer analysis are available in the
                        captured case.
                      </p>
                    </div>
                    {live.partial.map((p) => (
                      <p className="error-text" key={p}>
                        {p}
                      </p>
                    ))}
                    <h3>
                      {live.creations.length} contract creations in retrieved
                      pages
                    </h3>
                    {live.creations.map((t) => (
                      <div
                        className="finding-row"
                        key={t.created_contract!.hash}
                      >
                        <Address value={t.created_contract!.hash} />
                        <span>Block {num(t.block_number)}</span>
                        <EvidenceLink
                          hash={t.hash || t.transaction_hash!}
                          label="Creation"
                        />
                      </div>
                    ))}
                    {live.creations.length === 0 && (
                      <p className="muted">
                        No creation found in these pages. This does not
                        establish a complete deployment history.
                      </p>
                    )}
                    <h3 className="section-label">Recent transactions</h3>
                    {live.transactions.slice(0, 12).map((t) => (
                      <div className="finding-row" key={t.hash}>
                        <div>
                          <Address value={t.from.hash} />{" "}
                          <ArrowRight size={12} />{" "}
                          {t.to ? (
                            <Address value={t.to.hash} />
                          ) : (
                            <span>Contract creation</span>
                          )}
                          <p>
                            {date(t.timestamp)} · block {num(t.block_number)} ·{" "}
                            {t.status || "status unavailable"}
                          </p>
                        </div>
                        <EvidenceLink hash={t.hash!} />
                      </div>
                    ))}
                    {!live.transactions.length && (
                      <Empty title="No indexed transactions returned">
                        Verify the address or try again later.
                      </Empty>
                    )}
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setLive(null);
                        setQuery("");
                      }}
                    >
                      Return to captured case
                    </button>
                  </div>
                </section>
              ) : (
                data && (
                  <>
                    {["overview", "deployments", "buyers"].includes(view) && (
                      <>
                        <div className="case-bar">
                          <div>
                            <span className="case-dot" />
                            <strong>Uniswap V2</strong>
                            <span className="case-separator" />
                            <span>Historical case</span>
                            <Badge>Real transactions</Badge>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => navigate("coverage")}
                          >
                            View coverage <ArrowUpRight size={13} />
                          </button>
                        </div>
                        {selectedAddress && (
                          <div className="selected-profile">
                            <div>
                              <span className="eyebrow">
                                Address in captured case
                              </span>
                              <p>
                                <Address value={selectedAddress} />
                                <CopyButton
                                  value={selectedAddress}
                                  notify={setNotice}
                                />
                              </p>
                            </div>
                            <button
                              className="secondary-button"
                              onClick={() => void liveLookup(selectedAddress)}
                            >
                              <RefreshCw size={14} />
                              Fetch live history
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Clear selected address"
                              onClick={() => {
                                setSelectedAddress("");
                                setQuery("");
                              }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                        {view === "overview" && (
                          <>
                            <div className="metrics">
                              <Metric
                                label="Verified deployments"
                                value={data.launches.length}
                                icon={<Layers3 size={17} />}
                                note="1 repeat contract deployer"
                                tone="green"
                                onClick={() => navigate("deployments")}
                              />
                              <Metric
                                label="Repeated early buyers"
                                value={analysis.repeatBuyers.length}
                                icon={<Wallet size={17} />}
                                note="Across 2 or more pools"
                                tone="purple"
                                onClick={() => {
                                  setTab("buyers");
                                  document
                                    .querySelector(".evidence-panel")
                                    ?.scrollIntoView({ block: "start" });
                                }}
                              />
                              <Metric
                                label="Recurring wallet pairs"
                                value={analysis.groups.length}
                                icon={<Network size={17} />}
                                note="Co-occurrence · not ownership"
                                tone="amber"
                                onClick={() => navigate("buyers")}
                              />
                              <Metric
                                label="Subsequent sell events"
                                value={analysis.sells.length}
                                icon={<ArrowUpRight size={17} />}
                                note="Within captured activity"
                                onClick={() => {
                                  setTab("selling");
                                  document
                                    .querySelector(".evidence-panel")
                                    ?.scrollIntoView({ block: "start" });
                                }}
                              />
                            </div>
                            <div className="analysis-grid">
                              <section className="panel activity-panel">
                                <div className="panel-heading">
                                  <div>
                                    <h2>Early pool activity</h2>
                                    <p>Observed swaps after deployment</p>
                                  </div>
                                  <span className="chart-range">May 2020</span>
                                </div>
                                <div className="chart-summary">
                                  <strong>
                                    {data.swaps.length}
                                    <span>swap events</span>
                                  </strong>
                                  <div className="chart-legend">
                                    <span>
                                      <i className="legend-buy" />
                                      Buy
                                    </span>
                                    <span>
                                      <i className="legend-sell" />
                                      Sell / other
                                    </span>
                                  </div>
                                </div>
                                <ActivityChart data={data} />
                                <div className="chart-caption">
                                  <span>
                                    <Database size={12} /> First 32 swaps per
                                    pool, where available
                                  </span>
                                  <button
                                    className="text-button"
                                    onClick={() => setDialog("method")}
                                  >
                                    Methodology <ArrowUpRight size={12} />
                                  </button>
                                </div>
                              </section>
                              <section className="panel graph-panel">
                                <div className="panel-heading">
                                  <div>
                                    <h2>Connection map</h2>
                                    <p>
                                      {graphMode === "deployments"
                                        ? "One factory. Multiple token deployments."
                                        : "Repeated buyers across captured pools."}
                                    </p>
                                  </div>
                                  <GitBranch size={17} className="muted" />
                                </div>
                                <div className="segmented">
                                  <button
                                    aria-pressed={graphMode === "deployments"}
                                    onClick={() => setGraphMode("deployments")}
                                  >
                                    Deployments
                                  </button>
                                  <button
                                    aria-pressed={graphMode === "buyers"}
                                    onClick={() => setGraphMode("buyers")}
                                  >
                                    Buyer overlap
                                  </button>
                                </div>
                                <div className="connection-graph">
                                  <svg
                                    viewBox="0 0 420 165"
                                    preserveAspectRatio="none"
                                    aria-hidden="true"
                                  >
                                    <path d="M210 83C170 83 140 34 65 34M210 83C260 83 280 34 354 34M210 83C165 83 140 136 65 136M210 83C260 83 280 136 354 136" />
                                  </svg>
                                  <div className="graph-center">
                                    <span>
                                      <GitBranch size={20} />
                                    </span>
                                    <strong>
                                      {graphMode === "deployments"
                                        ? "V2 factory"
                                        : `${analysis.repeatBuyers.length} buyers`}
                                    </strong>
                                    <small>
                                      {graphMode === "deployments"
                                        ? short(FACTORY)
                                        : "Recurring senders"}
                                    </small>
                                  </div>
                                  {data.launches.map((l, i) => (
                                    <button
                                      className={`graph-node node-${i}`}
                                      key={l.address}
                                      onClick={() => setDialog(l)}
                                    >
                                      <span>{l.name.split(" ")[0]}</span>
                                      <small>
                                        {graphMode === "deployments"
                                          ? "LP token"
                                          : `${analysis.repeatBuyers.filter((b) => b.pools.includes(l.address)).length} shared`}
                                      </small>
                                    </button>
                                  ))}
                                </div>
                                <div className="graph-footer">
                                  <span className="legend-line" />
                                  {graphMode === "deployments"
                                    ? "Confirmed creation link"
                                    : "Observed participation only"}
                                  <span className="graph-count">
                                    {data.launches.length} pools
                                  </span>
                                </div>
                              </section>
                            </div>
                          </>
                        )}
                        <div className="content-grid">
                          <div>
                            {renderTable()}
                            {view === "buyers" && (
                              <section className="panel pair-panel">
                                <div className="panel-heading">
                                  <div>
                                    <h2>Recurring groups</h2>
                                    <p>
                                      Wallet pairs participating in at least two
                                      of the same pools
                                    </p>
                                  </div>
                                  <Badge tone="amber">Review signal</Badge>
                                </div>
                                <div className="evidence-body">
                                  {analysis.groups.length ? (
                                    analysis.groups.map((g, i) => (
                                      <div className="finding-row" key={i}>
                                        <div>
                                          <Address value={g.wallets[0]} /> +{" "}
                                          <Address value={g.wallets[1]} />
                                          <p>
                                            {g.count} shared pools · {g.status}
                                          </p>
                                        </div>
                                        <button
                                          className="text-button"
                                          onClick={() => setDialog("imd")}
                                        >
                                          Investigate <ArrowUpRight size={13} />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <Empty title="No recurring pair observed">
                                      Two wallets must both appear in at least
                                      two pools to form a pair.
                                    </Empty>
                                  )}
                                </div>
                              </section>
                            )}
                          </div>
                          <aside className="insights">
                            <section className="panel insight-panel">
                              <div className="panel-heading">
                                <h2>
                                  <Fingerprint size={16} /> Research signals
                                </h2>
                                <span className="signal-count">
                                  {1 +
                                    Number(analysis.repeatBuyers.length > 0) +
                                    Number(analysis.sells.length > 0)}
                                </span>
                              </div>
                              <div className="signal">
                                <span className="signal-icon confirmed">
                                  <Layers3 size={16} />
                                </span>
                                <div>
                                  <div className="signal-label">
                                    Repeat deployer{" "}
                                    <Badge tone="green">Confirmed</Badge>
                                  </div>
                                  <p>
                                    {data.launches.length} pool tokens share the
                                    same factory contract.
                                  </p>
                                  <button
                                    className="text-button"
                                    onClick={() => setDialog(data.launches[0])}
                                  >
                                    Inspect creation evidence{" "}
                                    <ArrowUpRight size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="signal">
                                <span className="signal-icon suspected">
                                  <Network size={16} />
                                </span>
                                <div>
                                  <div className="signal-label">
                                    Recurring participation{" "}
                                    <Badge tone="amber">Observed</Badge>
                                  </div>
                                  <p>
                                    {analysis.repeatBuyers.length
                                      ? `${analysis.repeatBuyers.length} transaction senders bought across multiple pools.`
                                      : "No repeated early buyer in this captured selection."}
                                  </p>
                                  <span className="signal-caveat">
                                    Shared ownership is not established.
                                  </span>
                                </div>
                              </div>
                              <div className="signal">
                                <span className="signal-icon neutral">
                                  <ShieldCheck size={16} />
                                </span>
                                <div>
                                  <div className="signal-label">
                                    Context matters
                                  </div>
                                  <p>
                                    This is normal factory behavior. A repeat
                                    deployment is not a risk verdict.
                                  </p>
                                </div>
                              </div>
                              <div className="imd-action">
                                <div>
                                  <Sparkles size={17} />
                                  <strong>Put the signal in context</strong>
                                </div>
                                <p>
                                  Package evidence and open questions for an IMD
                                  investigation.
                                </p>
                                <button
                                  className="primary-button"
                                  onClick={() => setDialog("imd")}
                                >
                                  Investigate with IMD{" "}
                                  <ArrowUpRight size={15} />
                                </button>
                              </div>
                            </section>
                            <div className="coverage-note">
                              <ShieldCheck size={15} />
                              <p>
                                Facts first. Connections are not proof of
                                coordination, a bundle, or common ownership.
                              </p>
                            </div>
                          </aside>
                        </div>
                      </>
                    )}
                    {view === "watchlist" && (
                      <>
                        <div className="page-actions">
                          <div>
                            <Badge>{watch.length} / 20 addresses</Badge>
                            <span className="muted">
                              Stored in this browser · Ethereum only
                            </span>
                          </div>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              download("trace-watchlist.json", {
                                chainId: 1,
                                addresses: watch.map((w) => w.address),
                                watch,
                              })
                            }
                          >
                            <ArrowDownToLine size={15} /> Export watchlist
                          </button>
                        </div>
                        <section className="panel">
                          <div className="panel-heading">
                            <div>
                              <h2>Watch an address</h2>
                              <p>Wallets, tokens and factory contracts</p>
                            </div>
                            <Star size={18} />
                          </div>
                          <form
                            className="watch-form"
                            onSubmit={(e) => {
                              e.preventDefault();
                              addWatch(watchInput.trim());
                            }}
                          >
                            <label htmlFor="watch-address">
                              Ethereum address
                            </label>
                            <div>
                              <input
                                ref={watchRef}
                                id="watch-address"
                                value={watchInput}
                                onChange={(e) => setWatchInput(e.target.value)}
                                placeholder="0x…"
                                autoComplete="off"
                                spellCheck={false}
                                aria-invalid={!!watchError}
                                aria-describedby={
                                  watchError ? "watch-error" : undefined
                                }
                              />
                              <button className="primary-button" type="submit">
                                <Plus size={16} /> Add address
                              </button>
                            </div>
                            {watchError && (
                              <p
                                className="error-text"
                                id="watch-error"
                                role="alert"
                              >
                                {watchError}
                              </p>
                            )}
                          </form>
                          <div className="evidence-body">
                            {watch.length ? (
                              watch.map((w) => (
                                <div className="watch-row" key={w.address}>
                                  <span className="wallet-icon">
                                    <Wallet size={19} />
                                  </span>
                                  <div>
                                    <strong>{w.name}</strong>
                                    <Address value={w.address} />
                                  </div>
                                  <Badge>Ethereum</Badge>
                                  <button
                                    className="icon-button"
                                    aria-label={`Remove ${w.name} from watchlist`}
                                    onClick={() =>
                                      toggleWatch(w.address, w.name)
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <Empty
                                icon={<Star size={28} />}
                                title="Your next lead starts here"
                              >
                                <p>
                                  Save an address to check for new transactions.
                                </p>
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    addWatch(FACTORY, "Uniswap V2 factory")
                                  }
                                >
                                  Watch the demo factory <Plus size={15} />
                                </button>
                              </Empty>
                            )}
                          </div>
                        </section>
                        {renderMonitor()}
                      </>
                    )}
                    {view === "alerts" && (
                      <>
                        <div className="page-actions">
                          <div>
                            <Badge>{unread} unread</Badge>
                            <span className="muted">
                              Local transaction observations
                            </span>
                          </div>
                          <div className="button-row">
                            <button
                              className="secondary-button"
                              onClick={() =>
                                setAlerts((a) =>
                                  a.map((x) => ({ ...x, read: true })),
                                )
                              }
                              disabled={!unread}
                            >
                              <Check size={15} /> Mark all read
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() =>
                                download("trace-alerts.json", {
                                  chainId: 1,
                                  alerts,
                                })
                              }
                            >
                              <ArrowDownToLine size={15} /> Export
                            </button>
                          </div>
                        </div>
                        {renderMonitor()}
                        <section className="panel alerts-panel">
                          {alerts.length ? (
                            alerts.map((a) => (
                              <div
                                className={`finding-row ${a.read ? "read" : ""}`}
                                key={a.id}
                              >
                                <span className="event-icon">
                                  <Activity size={17} />
                                </span>
                                <div>
                                  <Badge
                                    tone={
                                      a.kind === "coverage gap"
                                        ? "amber"
                                        : "green"
                                    }
                                  >
                                    {a.kind}
                                  </Badge>
                                  <p>
                                    <Address value={a.address} /> · observed{" "}
                                    {new Date(a.timestamp).toLocaleString()}
                                  </p>
                                  {a.kind === "coverage gap" && (
                                    <p>
                                      Previous cursor is outside this page.
                                      Intermediate activity may be missing.
                                    </p>
                                  )}
                                </div>
                                <EvidenceLink hash={a.transactionHash} />
                              </div>
                            ))
                          ) : (
                            <Empty
                              icon={<Bell size={30} />}
                              title="Nothing new to review"
                            >
                              <p>
                                Add a watchlist address and run a first check.
                                Alerts appear when a later check detects new
                                indexed transactions.
                              </p>
                              <button
                                className="secondary-button"
                                onClick={() => navigate("watchlist")}
                              >
                                Open watchlist <ArrowRight size={15} />
                              </button>
                            </Empty>
                          )}
                        </section>
                      </>
                    )}
                    {view === "coverage" && (
                      <Coverage
                        data={data}
                        onMethod={() => setDialog("method")}
                      />
                    )}
                  </>
                )
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <span className="status-dot" />
              {isUnsupported
                ? `${network} unsupported`
                : "Ethereum · public evidence"}
            </span>
            <span>
              Read-only research <span className="dot-separator">·</span> No
              wallet connection required
            </span>
            <button className="text-button" onClick={() => setDialog("method")}>
              Methodology <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      <div className={`notice ${notice ? "visible" : ""}`} role="status">
        {notice && (
          <>
            <Check size={16} />
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
      {dialog && (
        <Modal
          title={
            dialog === "imd"
              ? "Prepare an IMD investigation"
              : dialog === "method"
                ? "How detection works"
                : dialog.name
          }
          close={() => setDialog(null)}
        >
          {dialog === "imd" ? (
            <div className="dialog-body">
              <div className="inline-note">
                <Sparkles size={18} />
                <p>
                  Turn a signal into a reviewable case. Export this packet to
                  your IMD workflow for deeper investigation.
                </p>
              </div>
              <h3>Included in this Ethereum case</h3>
              <ul>
                <li>
                  {data?.launches.length || 0} verified pool creations and
                  transaction links
                </li>
                <li>
                  Repeated buyers, shared funding observations and subsequent
                  sells
                </li>
                <li>Source endpoints, block windows and coverage limits</li>
              </ul>
              <label className="field-label" htmlFor="investigation-question">
                Investigation question
              </label>
              <textarea
                id="investigation-question"
                defaultValue="Does the recurring participation reflect independent market activity, a shared service, or coordination? Corroborate funding chronology and sale recipients. Do not infer common ownership or a bundle from co-occurrence."
                rows={4}
              />
              <p className="muted">
                No IMD connector is configured. Nothing is submitted
                automatically. Routine monitoring continues independently of AI
                requests.
              </p>
              <button
                className="primary-button"
                disabled={!data}
                onClick={() => {
                  download("trace-imd-investigation.json", {
                    format: "trace.imd-case.v1",
                    preparedAt: new Date().toISOString(),
                    status: "not submitted",
                    question: (
                      document.getElementById(
                        "investigation-question",
                      ) as HTMLTextAreaElement
                    ).value,
                    data,
                    findings: analysis,
                    limitations: limitations(),
                    evidenceLinks: data?.launches.map(
                      (l) =>
                        `https://eth.blockscout.com/tx/${l.transactionHash}`,
                    ),
                  });
                  setNotice(
                    "IMD case packet downloaded. It has not been submitted.",
                  );
                }}
              >
                <ArrowDownToLine size={15} /> Download IMD case
              </button>
            </div>
          ) : dialog === "method" ? (
            <div className="dialog-body methodology">
              <Badge tone="green">Deterministic analysis</Badge>
              <h3>Confirmed facts</h3>
              <p>
                A successful receipt with a factory PairCreated event and
                matching indexed creator confirms a pool-token deployment. At
                least two distinct pool addresses from that factory establish a
                repeat contract deployer.
              </p>
              <h3>Observed relationships</h3>
              <p>
                “Early” means the first 32 captured Swap logs per pool within
                100,000 blocks after creation. A buy sends WETH into the pool
                and a sell receives WETH out. We group by the outer transaction
                sender; a router or service may represent multiple users.
              </p>
              <p>
                A repeated buyer appears in two or more pools. A recurring group
                is a pair of senders sharing at least two pools. These
                thresholds flag participation for review; they do not confirm
                coordination.
              </p>
              <h3>Funding and proceeds</h3>
              <p>
                Shared funding requires the same address to send native ETH to
                two repeated buyers before their first observed buys. The
                transfer scan covers at most 100 top-level transactions per
                selected buyer, from 7,200 blocks before to 7,200 blocks after
                that buyer’s captured activity.
              </p>
              <p>
                Subsequent sells require a prior buy by the same sender in the
                same pool. A later ETH transfer is shown as possible movement
                only. ETH is fungible; its source and the recipient’s ownership
                are unproven. Internal ETH and token transfers are outside this
                detector.
              </p>
              <h3>Limits</h3>
              {limitations().map((l) => (
                <p key={l}>• {l}</p>
              ))}
              <p>
                Base, Solana and Robinhood Chain are unsupported. Browser alerts
                observe the latest indexed transaction page and are not finality
                or reorg guarantees.
              </p>
            </div>
          ) : (
            <div className="dialog-body">
              <div className="detail-token">
                <span className="token-icon">◈</span>
                <div>
                  <Badge tone="green">Verified creation</Badge>
                  <p>ERC-20 liquidity-pool token</p>
                </div>
              </div>
              <dl className="details">
                <dt>Pool-token address</dt>
                <dd className="full-address">{dialog.address}</dd>
                <dt>Contract deployer</dt>
                <dd>
                  <Address value={dialog.deployer} />
                  <span className="subtext">
                    Uniswap V2 factory · not a human owner
                  </span>
                </dd>
                <dt>Transaction initiator</dt>
                <dd>
                  <Address value={dialog.initiator} />
                </dd>
                <dt>Creation block</dt>
                <dd className="mono">
                  {num(dialog.block)} · {date(dialog.timestamp)}
                </dd>
                <dt>Capture window</dt>
                <dd className="mono">
                  {num(dialog.fromBlock)}–{num(dialog.toBlock)}
                </dd>
                <dt>Swap coverage</dt>
                <dd>First {dialog.swapLimit} events, where available</dd>
                <dt>Evidence</dt>
                <dd>
                  <EvidenceLink
                    hash={dialog.transactionHash}
                    label="Open creation transaction"
                  />
                </dd>
              </dl>
              <div className="inline-note">
                <ShieldCheck size={17} />
                <p>
                  Successful receipt, factory PairCreated event and matching
                  indexed creator. This proves contract deployment, not
                  coordination.
                </p>
              </div>
              <h3>Captured activity</h3>
              <div className="detail-events">
                {data?.swaps
                  .filter((s) => s.pool === dialog.address)
                  .map((s) => (
                    <div
                      className="finding-row"
                      key={`${s.transactionHash}:${s.logIndex}`}
                    >
                      <div>
                        <Badge tone={s.side === "buy" ? "green" : "neutral"}>
                          {s.side}
                        </Badge>
                        <p>
                          <Address value={s.wallet} /> · {amount(s.eth)} WETH
                        </p>
                        <span className="subtext">
                          Block {num(s.block)} · recipient {short(s.recipient)}
                        </span>
                      </div>
                      <EvidenceLink hash={s.transactionHash} />
                    </div>
                  ))}
              </div>
              <button
                className="secondary-button"
                onClick={() => toggleWatch(dialog.address, dialog.name)}
              >
                <Star size={14} />
                {watch.some((w) => w.address === dialog.address)
                  ? "Remove from watchlist"
                  : "Watch this pool"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );

  function renderMonitor() {
    return (
      <section className="panel monitor-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <Radio size={17} /> Activity monitoring
            </h2>
            <p>Public indexer · transactions involving saved addresses</p>
          </div>
          <Badge tone={monitor ? "green" : "neutral"}>
            {monitor ? "Checking every 60s" : "Paused"}
          </Badge>
        </div>
        <div className="evidence-body">
          <div className="monitor-controls">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={monitor}
                onChange={(e) => setMonitor(e.target.checked)}
                disabled={!watch.length}
              />
              <span className="toggle" aria-hidden="true" />
              Check while this page is open
            </label>
            <button
              className="secondary-button"
              onClick={() => void checkActivity()}
              disabled={checking || !watch.length}
            >
              {checking ? (
                <LoaderCircle size={15} className="spinner" />
              ) : (
                <RefreshCw size={15} />
              )}{" "}
              {checking ? "Checking activity…" : "Check now"}
            </button>
          </div>
          <p className="check-status" role="status">
            {checkStatus}
          </p>
          <p className="muted">
            First check sets a session baseline; later checks create alerts.
            Monitoring pauses in hidden tabs and stops when closed. The separate
            Node worker supports scheduled checks after external hosting setup.
            No AI requests are used.
          </p>
        </div>
      </section>
    );
  }
}

function Metric({
  label,
  value,
  icon,
  note,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  note: string;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button className="metric" onClick={onClick}>
      <span className="metric-top">
        {label}
        {icon}
      </span>
      <span className="metric-value">
        {value.toString().padStart(2, "0")}
        <ArrowUpRight size={16} />
      </span>
      <span className={`metric-note ${tone}`}>
        <span className="metric-dot" />
        {note}
      </span>
    </button>
  );
}

function ActivityChart({ data }: { data: CaseData }) {
  const bins = Array.from({ length: 32 }, () => ({ buy: 0, other: 0 }));
  const min = Math.min(...data.launches.map((l) => l.block));
  const max = Math.max(min + 1, ...data.swaps.map((s) => s.block));
  data.swaps.forEach((s) => {
    const i = Math.min(31, Math.floor(((s.block - min) / (max - min)) * 32));
    if (i >= 0) bins[i][s.side === "buy" ? "buy" : "other"]++;
  });
  const peak = Math.max(1, ...bins.map((b) => b.buy + b.other));
  return (
    <div className="activity-chart">
      <div className="chart-y">
        <span>{peak}</span>
        <span>{Math.round(peak / 2)}</span>
        <span>0</span>
      </div>
      <div className="plot">
        <div className="plot-lines">
          <i />
          <i />
          <i />
        </div>
        <div
          className="bars"
          role="img"
          aria-label={`${data.swaps.length} observed swaps in 32 equal block intervals, blocks ${min} through ${max}. Sparse early activity is followed by a concentration of swaps.`}
        >
          {bins.map((b, i) => (
            <div
              className="bar-column"
              key={i}
              title={`Interval ${i + 1}: ${b.buy} buys, ${b.other} sells or other`}
            >
              <div
                className="bar-other"
                style={{ height: `${(b.other / peak) * 100}%` }}
              />
              <div
                className="bar-buy"
                style={{ height: `${(b.buy / peak) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="chart-x">
          <span>Block {num(min)}</span>
          <span>{num(Math.round((min + max) / 2))}</span>
          <span>{num(max)}</span>
        </div>
      </div>
    </div>
  );
}

function Coverage({
  data,
  onMethod,
}: {
  data: CaseData;
  onMethod: () => void;
}) {
  return (
    <div className="coverage-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Network coverage</h2>
            <p>Implemented and planned integrations</p>
          </div>
          <Globe2 size={18} />
        </div>
        <div className="evidence-body">
          {networkNames.map((n, i) => (
            <div className="coverage-network" key={n}>
              <span className="network-logo">{["⟠", "◉", "≋", "↗"][i]}</span>
              <div>
                <strong>{n}</strong>
                <p>
                  {i === 0
                    ? "Public lookup, captured events and local monitoring"
                    : i === 1
                      ? "EVM adapter and indexed history required"
                      : i === 2
                        ? "SPL mint and program-aware swap decoder required"
                        : "Verified network and provider configuration required"}
                </p>
              </div>
              <Badge tone={i === 0 ? "green" : "neutral"}>
                {i === 0 ? "Working" : "Unsupported"}
              </Badge>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Captured Ethereum case</h2>
          <Database size={18} />
        </div>
        <div className="evidence-body">
          <p>{data.description}</p>
          <dl className="details">
            <dt>Captured</dt>
            <dd>{new Date(data.capturedAt).toLocaleString()}</dd>
            <dt>RPC</dt>
            <dd>
              <a href={data.source.rpc} target="_blank" rel="noreferrer">
                PublicNode <ArrowUpRight size={12} />
              </a>
            </dd>
            <dt>Indexer</dt>
            <dd>
              <a
                href="https://eth.blockscout.com"
                target="_blank"
                rel="noreferrer"
              >
                Blockscout <ArrowUpRight size={12} />
              </a>
            </dd>
            <dt>Swap window</dt>
            <dd>
              Up to 100,000 blocks after each creation; first 32 events per pool
            </dd>
            <dt>Funding coverage</dt>
            <dd>
              {data.fundingCoverage.length} selected repeated buyers; up to 100
              native ETH transactions each
            </dd>
            <dt>Capture errors</dt>
            <dd>{data.errors.length}</dd>
          </dl>
          <p className="muted">
            PublicNode refused archive log queries without a token. Historical
            Swap events use Blockscout’s indexed log API. Creation receipts and
            blocks were verified through RPC.
          </p>
          {data.fundingCoverage.map((c) => (
            <p className="coverage-line" key={c.wallet}>
              {short(c.wallet)}:{" "}
              {c.error
                ? c.error
                : `${c.returned}/${c.cap} transactions, ${c.complete ? "page not capped" : "capped; incomplete"}`}
            </p>
          ))}
          <button className="secondary-button" onClick={onMethod}>
            Read detection rules <ArrowRight size={14} />
          </button>
        </div>
      </section>
      <section className="panel full-span">
        <div className="panel-heading">
          <h2>What runs here</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="capability-grid">
          <div>
            <Badge tone="green">No external setup</Badge>
            <h3>Explore & collect evidence</h3>
            <p>
              Captured public transactions, deterministic detection, evidence
              links, local watchlists, live public address lookup, in-session
              transaction alerts, JSON and IMD packet exports.
            </p>
            <strong>$0 demo service cost</strong>
          </div>
          <div>
            <Badge tone="amber">External setup</Badge>
            <h3>Continuous monitoring</h3>
            <p>
              Run the included Node worker on your own host. A public indexer
              works for limited usage. Broader history needs dedicated
              providers, storage and backfill. Allow $5–20/month compute, $0–25
              storage and $50–300+ for production data.
            </p>
            <strong>Planning estimates, not vendor quotes</strong>
          </div>
          <div>
            <Badge tone="neutral">Operator handoff</Badge>
            <h3>Investigate with IMD</h3>
            <p>
              Export an evidence packet into your IMD workflow. An authenticated
              connector and service budget are required for automatic
              submission. Neither is configured in this demo.
            </p>
            <strong>No automatic AI calls</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

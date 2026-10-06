import type { AddressInfo, LiveResult, Transaction } from "./types";
export const API = "https://eth.blockscout.com/api/v2";
export const FACTORY = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f";
export const validAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
export async function getJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      `The public indexer returned ${response.status}. Try again shortly.`,
    );
  return response.json() as Promise<T>;
}
export type TxPage = {
  items: Transaction[];
  next_page_params: Record<string, unknown> | null;
};
export async function lookup(
  address: string,
  signal?: AbortSignal,
): Promise<LiveResult> {
  if (!validAddress(address))
    throw new Error(
      "Enter an Ethereum address: 0x followed by 40 hexadecimal characters.",
    );
  const info = await getJson<AddressInfo>(
    `${API}/addresses/${address}`,
    signal,
  );
  const results = await Promise.allSettled([
    getJson<TxPage>(`${API}/addresses/${address}/transactions`, signal),
    getJson<TxPage>(
      `${API}/addresses/${address}/internal-transactions`,
      signal,
    ),
  ]);
  const partial: string[] = [];
  const pages = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    partial.push(
      `${i ? "Internal creation traces" : "Transactions"} unavailable. Retry the lookup.`,
    );
    return { items: [], next_page_params: null };
  });
  const creations = [...pages[0].items, ...pages[1].items].filter(
    (t) =>
      t.created_contract &&
      t.from.hash.toLowerCase() === address.toLowerCase() &&
      (t.status === "ok" || t.success === true),
  );
  return {
    address: info,
    transactions: pages[0].items,
    creations: [
      ...new Map(creations.map((t) => [t.created_contract!.hash, t])).values(),
    ],
    partial,
    fetchedAt: new Date().toISOString(),
    more: pages.some((p) => p.next_page_params),
  };
}

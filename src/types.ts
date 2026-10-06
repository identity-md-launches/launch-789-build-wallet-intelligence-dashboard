export type Launch = {
  name: string;
  address: string;
  deployer: string;
  initiator: string;
  transactionHash: string;
  block: number;
  blockHash: string;
  timestamp: string;
  token0: string;
  token1: string;
  kind: string;
  fromBlock: number;
  toBlock: number;
  swapLimit: number;
  totalSwapLogs?: number;
  logSource?: string;
};
export type Swap = {
  pool: string;
  wallet: string;
  recipient: string;
  router: string;
  side: "buy" | "sell" | "complex";
  eth: number;
  block: number;
  transactionHash: string;
  logIndex: number;
};
export type Transfer = {
  from: string;
  to: string;
  eth: number;
  block: number;
  transactionHash: string;
  timestamp: string;
};
export type CaseData = {
  schemaVersion: number;
  chainId: number;
  capturedAt: string;
  title: string;
  description: string;
  source: { rpc: string; indexer: string };
  launches: Launch[];
  swaps: Swap[];
  transfers: Transfer[];
  fundingCoverage: {
    wallet: string;
    fromBlock?: number;
    toBlock?: number;
    returned?: number;
    cap?: number;
    complete?: boolean;
    error?: string;
  }[];
  errors: { pool: string; message: string }[];
};
export type Watch = { address: string; name: string; addedAt: string };
export type Alert = {
  id: string;
  address: string;
  transactionHash: string;
  timestamp: string;
  read: boolean;
  kind: "new activity" | "coverage gap";
};
export type AddressRef = { hash: string; name?: string; is_contract?: boolean };
export type Transaction = {
  hash?: string;
  transaction_hash?: string;
  block_number: number | null;
  timestamp: string | null;
  status?: string;
  success?: boolean;
  from: AddressRef;
  to?: AddressRef | null;
  created_contract?: AddressRef | null;
  value?: string;
  type?: string;
};
export type AddressInfo = {
  hash: string;
  name?: string;
  is_contract: boolean;
  creator_address_hash?: string;
  creation_transaction_hash?: string;
  token?: { type: string; symbol: string; name: string };
};
export type LiveResult = {
  address: AddressInfo;
  transactions: Transaction[];
  creations: Transaction[];
  partial: string[];
  fetchedAt: string;
  more: boolean;
};

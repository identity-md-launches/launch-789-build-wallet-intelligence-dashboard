import type { Launch, Swap, Transfer } from "./types";
export type Detection = {
  repeatDeployers: { address: string; count: number; transactions: string[] }[];
  repeatBuyers: {
    wallet: string;
    pools: string[];
    count: number;
    transactions: string[];
    eth: number;
  }[];
  groups: {
    wallets: string[];
    pools: string[];
    count: number;
    status: string;
  }[];
  sharedFunding: {
    funder: string;
    wallets: string[];
    transactions: string[];
  }[];
  sells: Swap[];
  movements: Transfer[];
};
export function detect(data: {
  launches?: Launch[];
  swaps?: Swap[];
  transfers?: Transfer[];
}): Detection;

import { Networks } from "@stellar/stellar-sdk";

export type StellarNetwork = "testnet" | "mainnet" | "local";

export interface NetworkConfig {
  network: StellarNetwork;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
}

export const PUBLIC_PASSPHRASE = Networks.PUBLIC;
export const TESTNET_PASSPHRASE = Networks.TESTNET;

/** CAIP-2 network id used inside LCP settlement claims. */
export function caip2(network: StellarNetwork): string {
  return network === "mainnet" ? "stellar:pubnet" : "stellar:testnet";
}

export function defaultRpcUrl(network: StellarNetwork): string {
  switch (network) {
    case "mainnet":
      return "https://mainnet.sorobanrpc.com";
    case "local":
      return "http://localhost:8000/soroban/rpc";
    default:
      return "https://soroban-testnet.stellar.org";
  }
}

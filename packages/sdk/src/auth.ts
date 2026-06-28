import type { ContextioClient } from "./client.js";
import type { WalletSession } from "./types.js";

/**
 * A function that signs a SEP-53 message with a Stellar wallet and returns the
 * base64 signature. Wallet-agnostic — pass an adapter for Freighter, Stellar
 * Wallets Kit, etc. Example (Stellar Wallets Kit):
 *
 *   const signMessage = async (msg) =>
 *     (await StellarWalletsKit.signMessage(msg, { address })).signedMessage;
 */
export type SignMessageFn = (message: string) => Promise<string> | string;

/**
 * Sign In With Stellar (SEP-53): request a challenge, have the wallet sign it,
 * and exchange the signature for a Contextio session JWT.
 */
export async function signInWithStellar(opts: {
  client: ContextioClient;
  address: string;
  signMessage: SignMessageFn;
}): Promise<WalletSession> {
  const { client, address, signMessage } = opts;
  const { message, hmac } = await client.challenge(address);
  const signedMessage = await signMessage(message);
  return client.verify({ address, message, hmac, signedMessage });
}

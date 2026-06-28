# contexta-sdk

Client SDK for **Contexta** — agentic, non-custodial treasury & payroll on Stellar for LATAM.

- **Typed API client** for the Contexta API (treasury, payroll, agent, legal).
- **Sign In With Stellar** (SEP-53) — wallet-agnostic (Freighter, Stellar Wallets Kit, …).
- **Legal Context Protocol (LCP)** — re-derive and verify a context's SHA-256 independently.

Isomorphic (browser + Node ≥ 18), ESM, zero server dependencies.

## Install

```bash
npm i contexta-sdk
```

## Sign in with a Stellar wallet

```ts
import { ContextaClient, signInWithStellar } from "contexta-sdk";
import { StellarWalletsKit, Networks, defaultModules } from "@creit.tech/stellar-wallets-kit";

const client = new ContextaClient({ baseUrl: "https://contexta-api.fly.dev" });

StellarWalletsKit.init({ network: Networks.TESTNET, modules: defaultModules() });
const { address } = await StellarWalletsKit.authModal();

const session = await signInWithStellar({
  client,
  address,
  signMessage: async (msg) => (await StellarWalletsKit.signMessage(msg, { address })).signedMessage,
});

// Authenticated, tenant-scoped client:
const api = client.withSession(session);
const treasury = await api.treasury();
const decisions = await api.decisions();
```

`signMessage` is any function returning the base64 SEP-53 signature, so the SDK
works with Freighter directly or any wallet adapter.

## Verify a Legal Context independently

```ts
import { hashLegalContext, verifyLegalContext } from "contexta-sdk";

const doc = await client.wellKnownLegalContext("acme.contexta.app");
const hash = hashLegalContext(doc); // canonical SHA-256 (hex)
verifyLegalContext(doc, onChainHashFromEvent); // boolean
```

The canonicalization is byte-for-byte identical to the Contexta platform, so a
hash bound into a Soroban event can be re-derived and checked client-side.

## License

Apache-2.0

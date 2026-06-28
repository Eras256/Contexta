import Link from "next/link";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { Badge, Card } from "@/components/ui";

const EXPLAINERS = [
  {
    title: "Treasury Autopilot",
    body: "AI agents continuously rebalance idle dollars between liquid reserves and yield, sized to upcoming payroll and FX volatility — never touching custody of your keys.",
    accent: "success" as const,
  },
  {
    title: "Payroll in BR / AR / CO",
    body: "Pay teams in Brazil, Argentina and Colombia using digital dollars on Stellar, off-ramped through anchors to PIX, Transferencias 3.0 and Bre-B.",
    accent: "info" as const,
  },
  {
    title: "Legal Context & Compliance",
    body: "Every agent-driven transaction is bound to a verifiable legal context (LCP) published at /.well-known/legal-context.json — terms, consent and dispute channels, on-chain.",
    accent: "agent" as const,
  },
  {
    title: "DeFi & RWA Yield",
    body: "Yield comes from DeFindex vaults (CETES / RWA) and Blend lending pools on Stellar, with per-country exposure limits and a hard liquidity floor.",
    accent: "warn" as const,
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 flex justify-center gap-2">
            <Badge tone="success">Stellar · Soroban testnet</Badge>
            <Badge tone="agent">SCF Integration Track</Badge>
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Agentic Treasury &amp; Payroll on Stellar for LATAM
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-slate-300 sm:text-lg">
            Contexta is a non-custodial platform where AI agents manage liquidity, yield, and
            payroll for companies paying teams in Brazil, Argentina, and Colombia. Treasury settles
            in digital dollars and XLM on Stellar, earns yield via DeFindex &amp; Blend, on/off-ramps
            through anchors and local rails, and binds every agentic action to the Legal Context
            Protocol.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/docs" className="btn-primary">
              Request demo
            </Link>
            <Link href="/treasury" className="btn-ghost">
              Launch testnet workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Explainer cards */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXPLAINERS.map((e) => (
            <Card key={e.title} className="flex flex-col">
              <Badge tone={e.accent}>{e.title}</Badge>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{e.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section>
        <div className="mb-6">
          <div className="label text-brand">How it fits together</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            One control plane, non-custodial settlement
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            The company keeps custody. Contexta&apos;s agents propose moves; the API and worker
            enforce risk limits and legal context, then settle through Soroban contracts into
            DeFindex, Blend, and anchor rails — with every step audited in Supabase.
          </p>
        </div>
        <ArchitectureDiagram />
      </section>

      {/* Trust strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "Non-custodial", v: "Keys stay with the company; agents only propose and execute within signed limits." },
          { k: "Verifiable terms", v: "LCP context hash is embedded in every on-chain treasury & payroll event." },
          { k: "LATAM-native", v: "PIX, Transferencias 3.0 and Bre-B off-ramps via SEP-24/31 anchors." },
        ].map((x) => (
          <Card key={x.k}>
            <div className="label text-brand">{x.k}</div>
            <p className="mt-2 text-sm text-slate-300">{x.v}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Contexta — Agentic Treasury &amp; Payroll for LATAM on Stellar. Non-custodial · Testnet
          demo · Not financial advice.
        </p>
        <div className="flex flex-wrap gap-4">
          <a className="hover:text-slate-300" href="/.well-known/legal-context.json">
            legal-context.json
          </a>
          <a className="hover:text-slate-300" href="/security">
            Security
          </a>
          <a className="hover:text-slate-300" href="/docs">
            Docs &amp; SCF
          </a>
        </div>
      </div>
    </footer>
  );
}

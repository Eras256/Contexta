/**
 * Architecture diagram (pure SVG, no deps). Shows the flow:
 * Company treasury → Agents → Soroban contracts, with Supabase, DeFindex/Blend,
 * anchors/local rails, and the Legal Context Protocol binding.
 */
export function ArchitectureDiagram() {
  const Box = ({
    x,
    y,
    w,
    h,
    title,
    subtitle,
    accent = "#2dd4bf",
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    subtitle?: string;
    accent?: string;
  }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#0f1628" stroke={accent} strokeOpacity={0.5} />
      <text x={x + w / 2} y={y + (subtitle ? h / 2 - 4 : h / 2 + 4)} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600">
        {title}
      </text>
      {subtitle ? (
        <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fill="#94a3b8" fontSize="10">
          {subtitle}
        </text>
      ) : null}
    </g>
  );

  return (
    <div className="card overflow-x-auto">
      <svg viewBox="0 0 920 420" className="w-full min-w-[760px]" role="img" aria-label="Contexta architecture diagram">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#475569" />
          </marker>
        </defs>

        {/* Lane labels */}
        <text x={20} y={30} fill="#64748b" fontSize="11" fontWeight="600" letterSpacing="1">
          COMPANY
        </text>
        <text x={20} y={170} fill="#64748b" fontSize="11" fontWeight="600" letterSpacing="1">
          CONTEXTA PLATFORM
        </text>
        <text x={20} y={330} fill="#64748b" fontSize="11" fontWeight="600" letterSpacing="1">
          STELLAR / DEFI / RAILS
        </text>

        <Box x={360} y={45} w={200} h={56} title="Company Treasury" subtitle="USDC · XLM · RWA" accent="#38bdf8" />

        <Box x={120} y={150} w={170} h={60} title="AI Agents" subtitle="rebalance · forecast" accent="#a78bfa" />
        <Box x={375} y={150} w={170} h={60} title="API / Worker" subtitle="Fly.io · Node/TS" accent="#2dd4bf" />
        <Box x={630} y={150} w={170} h={60} title="Supabase" subtitle="accounts · audit · LCP refs" accent="#34d399" />

        <Box x={70} y={300} w={150} h={60} title="Soroban" subtitle="Treasury + Payroll" accent="#2dd4bf" />
        <Box x={255} y={300} w={150} h={60} title="DeFindex" subtitle="CETES / RWA vaults" accent="#f5b54a" />
        <Box x={440} y={300} w={150} h={60} title="Blend" subtitle="lending pools" accent="#f5b54a" />
        <Box x={625} y={300} w={175} h={60} title="Anchors + Rails" subtitle="SEP-24/31 · PIX · Bre-B" accent="#38bdf8" />

        {/* Legal Context binding (cross-cutting) */}
        <rect x={360} y={232} width={200} height={28} rx={14} fill="#a78bfa" fillOpacity={0.12} stroke="#a78bfa" strokeOpacity={0.5} />
        <text x={460} y={250} textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="600">
          Legal Context Protocol binding
        </text>

        {/* Edges */}
        <g stroke="#475569" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)">
          <path d="M430,101 C380,120 300,130 240,150" />
          <path d="M490,101 L480,150" />
          <path d="M545,180 L630,180" />
          <path d="M205,210 L160,300" />
          <path d="M460,210 L330,300" />
          <path d="M470,210 L510,300" />
          <path d="M540,180 C640,210 690,250 710,300" />
        </g>
      </svg>
    </div>
  );
}

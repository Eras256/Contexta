"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "es" | "pt";

export const LOCALES: { code: Locale; short: string; label: string }[] = [
  { code: "en", short: "EN", label: "English" },
  { code: "es", short: "ES", label: "Español" },
  { code: "pt", short: "PT", label: "Português" },
];

/**
 * Client-side i18n: a context + dictionary, persisted to localStorage. No locale
 * routes — the selector switches all content in place. Copy is written for a
 * mass audience: simple words, real benefits, and analogies.
 */
type Dict = Record<string, unknown>;

const en: Dict = {
  nav: {
    home: "Home",
    treasury: "Treasury",
    payroll: "Payroll",
    agent: "Agent & Legal",
    integrations: "Integrations",
    security: "Security",
    docs: "Docs",
    workspace: "Open the demo",
  },
  auth: {
    connect: "Connect wallet",
    connecting: "Connecting…",
    disconnect: "Disconnect",
    live: "Live",
    demo: "Demo data",
  },
  hero: {
    badge1: "Built on Stellar",
    badge2: "Your keys · your money",
    title: "Pay your team and grow your cash — on autopilot",
    subtitle:
      "Contextio is a smart money assistant for businesses in Latin America. It keeps enough cash ready for payday, puts the rest to work earning yield, and pays your team in Brazil, Argentina, and Colombia — while you keep full control of your funds.",
    ctaPrimary: "Try the live demo",
    ctaSecondary: "See how it works",
    trust: "Non-custodial — Contextio never holds your money. You do.",
  },
  steps: {
    eyebrow: "Three simple steps",
    title: "Set it up once, then let it run",
    s1Title: "1 · Connect your wallet",
    s1Body:
      "Sign in with your Stellar wallet, like tapping your card — but you keep the keys. No passwords, no sign-up forms.",
    s2Title: "2 · Set your rules",
    s2Body:
      "Tell Contextio how much cash to always keep ready and how bold to be. Think of it as a thermostat: you set the range, it stays inside it.",
    s3Title: "3 · Let it run",
    s3Body:
      "Your assistant watches the balance 24/7 — covers payday, earns yield on spare cash, and pays your team on time.",
  },
  benefits: {
    eyebrow: "Why teams use Contextio",
    title: "Less busywork. More peace of mind.",
    b1Title: "Always ready for payday",
    b1Body:
      "Contextio keeps a safety cushion sized to your next payroll, plus a buffer for currency swings — so payday is never a surprise.",
    b2Title: "Your idle cash earns",
    b2Body:
      "Spare dollars earn yield in vetted Stellar pools instead of sitting still — like a high-yield savings account that funds itself.",
    b3Title: "Pay across LATAM, fast",
    b3Body:
      "Your team in Brazil, Argentina, and Colombia gets paid through local rails — PIX, Transferencias 3.0, and Bre-B.",
    b4Title: "You stay in control",
    b4Body:
      "It's non-custodial: every move is signed by you, capped by your limits, and written to a tamper-proof log.",
  },
  flow: {
    eyebrow: "How the money moves",
    title: "One assistant, your money stays yours",
    subtitle:
      "You keep custody the whole time. The assistant only suggests and executes moves inside the limits you signed — and every step is recorded.",
  },
  why: {
    t1: "Non-custodial",
    b1: "Your keys, your money. The assistant only acts within limits you sign.",
    t2: "Rules you can verify",
    b2: "Every action is linked to your published terms — anyone can check it.",
    t3: "Built on Stellar",
    b3: "Fast, low-cost settlement in digital dollars and XLM.",
  },
  cta: {
    title: "Ready to put your treasury on autopilot?",
    body: "Connect a Stellar wallet on testnet and explore the full experience — no money at risk.",
    button: "Try the live demo",
  },
  feed: {
    eyebrow: "Live",
    title: "What the assistant is doing right now",
    subtitle: "Real, on-chain activity from Contextio's autonomous agent — running 24/7 on Stellar testnet.",
    agentLabel: "Agent wallet",
    empty: "Waking up the assistant…",
    viewAll: "See all activity",
    connection: "CONNECTION",
    online: "ONLINE",
    title2: "Agent audit feed",
  },
  footer: {
    tagline:
      "Contextio — smart treasury & payroll for Latin America, on Stellar. Non-custodial · Testnet demo · Not financial advice.",
    security: "Security",
    docs: "Docs",
  },
  diagram: {
    laneCompany: "YOUR COMPANY",
    lanePlatform: "CONTEXTIO (THE ASSISTANT)",
    laneStellar: "STELLAR NETWORK & PAYOUTS",
    treasuryTitle: "Your money",
    treasurySub: "dollars · XLM",
    agentTitle: "Smart assistant",
    agentSub: "plans & watches",
    engineTitle: "Contextio engine",
    engineSub: "checks your rules",
    recordsTitle: "Records",
    recordsSub: "history & audit",
    contractsTitle: "Stellar contracts",
    contractsSub: "treasury + payroll",
    savingsTitle: "Savings pools",
    savingsSub: "earn yield",
    lendingTitle: "Lending",
    lendingSub: "earn yield",
    payoutsTitle: "Local payouts",
    payoutsSub: "PIX · Bre-B",
    binding: "Your rules, signed on every action",
  },
  pages: {
    treasury: {
      eyebrow: "Treasury",
      title: "Your money at a glance",
      desc: "See your cash, what's set aside for payday, and what's quietly earning — all in one place.",
      connectTitle: "See your live treasury",
      connectBody: "Connect your Stellar wallet to see your real balances — what's ready for payday and what's earning. Nothing here is fake.",
      loading: "Loading your money…",
      statTotal: "Total money",
      statTotalSub: "all your balances",
      statReady: "Ready for payday",
      statReadySub: "kept available",
      statEarning: "Earning yield",
      statEarningSub: "put to work",
      statShare: "Share earning",
      statShareSub: "of your total",
      allocTitle: "Ready cash vs. earning",
      allocBody:
        "Contextio keeps enough ready for payday, then puts the rest to work. You set the balance; it stays inside it.",
      liquid: "Ready cash",
      earning: "Earning",
      posTitle: "Where your money is",
      posEmpty: "No balances yet.",
      colAsset: "Asset",
      colWhere: "Where",
      colYield: "Yield",
      colAmount: "Amount",
      placeLiquidity: "Ready cash",
      placeVault: "Savings pool",
      placeBlend: "Lending",
      rulesTitle: "Your rules",
      rulesBody: "The limits the assistant must always respect.",
      ruleFloor: "Always keep ready",
      ruleMaxYield: "Most that can earn",
      ruleSensitivity: "How bold",
      activityTitle: "Recent activity",
      activityBody: "What your assistant did, newest first.",
      activityEmpty: "No moves yet — your assistant will log them here.",
    },
    payroll: {
      eyebrow: "Payroll",
      title: "Pay your LATAM team",
      desc: "See who gets paid, when payday is, and exactly how Contextio will cover the next run.",
      connectTitle: "See your payroll",
      connectBody: "Connect your Stellar wallet to see your real team and upcoming paydays. Nothing here is fake.",
      statPeople: "People you pay",
      statPeopleSub: "active",
      statMonthly: "Monthly payroll",
      statMonthlySub: "gross",
      statNext: "Next payday",
      statNeeded: "Needed for next run",
      statNeededSub: "incl. safety buffer",
      teamTitle: "Your team",
      teamEmpty: "No people yet.",
      colName: "Name",
      colCountry: "Country",
      colAsset: "Paid in",
      colRail: "Sent via",
      colSalary: "Pay",
      colStatus: "Status",
      active: "Active",
      paused: "Paused",
      fundTitle: "How the next payday gets covered",
      fundBody: "Contextio pulls from spare cash first, then from what's earning — only if needed.",
      fundGross: "To pay your team",
      fundBuffer: "Safety buffer (8.5%)",
      fundNeeded: "Total needed",
      fundReady: "Ready cash now",
      fundOk: "Enough is ready — your team gets paid on time.",
      fundShort: "A top-up is needed before payday.",
      nextNone: "No payday scheduled yet.",
    },
    agent: {
      eyebrow: "Assistant & rules",
      title: "What the assistant did, and why",
      desc: "Every suggestion and action links back to your rules, your consent, and its on-chain record.",
    },
    integrations: {
      eyebrow: "Integrations",
      title: "Where your cash can work and pay out",
      desc: "Yield pools on Stellar and local payout rails across Brazil, Argentina, and Colombia.",
    },
    security: {
      eyebrow: "Security",
      title: "Built so you stay in control",
      desc: "Non-custodial by design, with signed limits, role-based access, and a tamper-proof audit trail.",
    },
    docs: {
      eyebrow: "Docs & SCF",
      title: "How Contextio works under the hood",
      desc: "Architecture, the Legal Context Protocol, and how this maps to the Stellar Community Fund track.",
    },
  },
};

const es: Dict = {
  nav: {
    home: "Inicio",
    treasury: "Tesorería",
    payroll: "Nómina",
    agent: "Asistente y Legal",
    integrations: "Integraciones",
    security: "Seguridad",
    docs: "Docs",
    workspace: "Abrir demo",
  },
  auth: {
    connect: "Conectar wallet",
    connecting: "Conectando…",
    disconnect: "Desconectar",
    live: "En vivo",
    demo: "Datos demo",
  },
  hero: {
    badge1: "Hecho sobre Stellar",
    badge2: "Tus llaves · tu dinero",
    title: "Paga a tu equipo y haz crecer tu dinero — en piloto automático",
    subtitle:
      "Contextio es un asistente de dinero inteligente para empresas de Latinoamérica. Mantiene listo el efectivo para el día de pago, pone el resto a generar rendimiento y paga a tu equipo en Brasil, Argentina y Colombia — mientras tú conservas el control total de tus fondos.",
    ctaPrimary: "Probar la demo",
    ctaSecondary: "Ver cómo funciona",
    trust: "Sin custodia — Contextio nunca guarda tu dinero. Tú sí.",
  },
  steps: {
    eyebrow: "Tres pasos simples",
    title: "Configúralo una vez y déjalo trabajar",
    s1Title: "1 · Conecta tu wallet",
    s1Body:
      "Inicia sesión con tu wallet de Stellar, como acercar tu tarjeta — pero las llaves son tuyas. Sin contraseñas ni formularios.",
    s2Title: "2 · Define tus reglas",
    s2Body:
      "Dile a Contextio cuánto efectivo mantener siempre listo y qué tan arriesgado ser. Es como un termostato: tú pones el rango y se mantiene dentro.",
    s3Title: "3 · Déjalo funcionar",
    s3Body:
      "Tu asistente vigila el saldo 24/7 — cubre el día de pago, genera rendimiento con el excedente y paga a tu equipo a tiempo.",
  },
  benefits: {
    eyebrow: "Por qué usan Contextio",
    title: "Menos trabajo manual. Más tranquilidad.",
    b1Title: "Siempre listo para el día de pago",
    b1Body:
      "Contextio reserva un colchón del tamaño de tu próxima nómina, más un margen por la volatilidad de la moneda — el día de pago nunca te sorprende.",
    b2Title: "Tu efectivo ocioso rinde",
    b2Body:
      "Los dólares que sobran generan rendimiento en pools verificados de Stellar en vez de quedarse quietos — como una cuenta de ahorro que se financia sola.",
    b3Title: "Paga en LATAM, rápido",
    b3Body:
      "Tu equipo en Brasil, Argentina y Colombia cobra por rieles locales — PIX, Transferencias 3.0 y Bre-B.",
    b4Title: "Tú mantienes el control",
    b4Body:
      "Es sin custodia: cada movimiento lo firmas tú, está limitado por tus reglas y queda en un registro a prueba de alteraciones.",
  },
  flow: {
    eyebrow: "Cómo se mueve el dinero",
    title: "Un asistente; tu dinero sigue siendo tuyo",
    subtitle:
      "Tú conservas la custodia todo el tiempo. El asistente solo sugiere y ejecuta movimientos dentro de los límites que firmaste — y cada paso queda registrado.",
  },
  why: {
    t1: "Sin custodia",
    b1: "Tus llaves, tu dinero. El asistente solo actúa dentro de los límites que firmas.",
    t2: "Reglas verificables",
    b2: "Cada acción se vincula a tus términos publicados — cualquiera puede comprobarlo.",
    t3: "Hecho sobre Stellar",
    b3: "Liquidación rápida y de bajo costo en dólares digitales y XLM.",
  },
  cta: {
    title: "¿Listo para poner tu tesorería en piloto automático?",
    body: "Conecta una wallet de Stellar en testnet y explora toda la experiencia — sin dinero en riesgo.",
    button: "Probar la demo",
  },
  feed: {
    eyebrow: "En vivo",
    title: "Lo que el asistente está haciendo ahora",
    subtitle: "Actividad real y on-chain del agente autónomo de Contextio — funcionando 24/7 en la testnet de Stellar.",
    agentLabel: "Wallet del agente",
    empty: "Despertando al asistente…",
    viewAll: "Ver toda la actividad",
    connection: "CONEXIÓN",
    online: "EN LÍNEA",
    title2: "Feed de auditoría del agente",
  },
  footer: {
    tagline:
      "Contextio — tesorería y nómina inteligentes para Latinoamérica, sobre Stellar. Sin custodia · Demo en testnet · No es asesoría financiera.",
    security: "Seguridad",
    docs: "Docs",
  },
  diagram: {
    laneCompany: "TU EMPRESA",
    lanePlatform: "CONTEXTIO (EL ASISTENTE)",
    laneStellar: "RED STELLAR Y PAGOS",
    treasuryTitle: "Tu dinero",
    treasurySub: "dólares · XLM",
    agentTitle: "Asistente inteligente",
    agentSub: "planea y vigila",
    engineTitle: "Motor de Contextio",
    engineSub: "revisa tus reglas",
    recordsTitle: "Registros",
    recordsSub: "historial y auditoría",
    contractsTitle: "Contratos Stellar",
    contractsSub: "tesorería + nómina",
    savingsTitle: "Pools de ahorro",
    savingsSub: "generan rendimiento",
    lendingTitle: "Préstamos",
    lendingSub: "generan rendimiento",
    payoutsTitle: "Pagos locales",
    payoutsSub: "PIX · Bre-B",
    binding: "Tus reglas, firmadas en cada acción",
  },
  pages: {
    treasury: {
      eyebrow: "Tesorería",
      title: "Tu dinero de un vistazo",
      desc: "Ve tu efectivo, lo reservado para el día de pago y lo que rinde en silencio — todo en un lugar.",
      connectTitle: "Mira tu tesorería en vivo",
      connectBody: "Conecta tu wallet de Stellar para ver tus saldos reales — lo listo para el día de pago y lo que rinde. Aquí nada es falso.",
      loading: "Cargando tu dinero…",
      statTotal: "Dinero total",
      statTotalSub: "todos tus saldos",
      statReady: "Listo para pagar",
      statReadySub: "disponible",
      statEarning: "Generando rendimiento",
      statEarningSub: "puesto a trabajar",
      statShare: "Parte que rinde",
      statShareSub: "de tu total",
      allocTitle: "Efectivo listo vs. rindiendo",
      allocBody:
        "Contextio mantiene lo necesario para el día de pago y pone el resto a trabajar. Tú defines el balance; se queda dentro.",
      liquid: "Efectivo listo",
      earning: "Rindiendo",
      posTitle: "Dónde está tu dinero",
      posEmpty: "Aún no hay saldos.",
      colAsset: "Activo",
      colWhere: "Dónde",
      colYield: "Rinde",
      colAmount: "Monto",
      placeLiquidity: "Efectivo listo",
      placeVault: "Pool de ahorro",
      placeBlend: "Préstamos",
      rulesTitle: "Tus reglas",
      rulesBody: "Los límites que el asistente siempre debe respetar.",
      ruleFloor: "Mantener siempre listo",
      ruleMaxYield: "Máximo que puede rendir",
      ruleSensitivity: "Qué tan arriesgado",
      activityTitle: "Actividad reciente",
      activityBody: "Lo que hizo tu asistente, lo más nuevo primero.",
      activityEmpty: "Aún no hay movimientos — tu asistente los registrará aquí.",
    },
    payroll: {
      eyebrow: "Nómina",
      title: "Paga a tu equipo en LATAM",
      desc: "Mira a quién pagas, cuándo es el día de pago y cómo Contextio cubrirá la próxima corrida.",
      connectTitle: "Mira tu nómina",
      connectBody: "Conecta tu wallet de Stellar para ver tu equipo real y los próximos días de pago. Aquí nada es falso.",
      statPeople: "Personas que pagas",
      statPeopleSub: "activas",
      statMonthly: "Nómina mensual",
      statMonthlySub: "bruto",
      statNext: "Próximo pago",
      statNeeded: "Necesario para la próxima",
      statNeededSub: "incl. margen de seguridad",
      teamTitle: "Tu equipo",
      teamEmpty: "Aún no hay personas.",
      colName: "Nombre",
      colCountry: "País",
      colAsset: "Cobra en",
      colRail: "Enviado por",
      colSalary: "Pago",
      colStatus: "Estado",
      active: "Activo",
      paused: "Pausado",
      fundTitle: "Cómo se cubre el próximo pago",
      fundBody: "Contextio usa primero el efectivo libre y, solo si hace falta, lo que está rindiendo.",
      fundGross: "Para pagar a tu equipo",
      fundBuffer: "Margen de seguridad (8.5%)",
      fundNeeded: "Total necesario",
      fundReady: "Efectivo listo ahora",
      fundOk: "Hay suficiente listo — tu equipo cobra a tiempo.",
      fundShort: "Hace falta una recarga antes del día de pago.",
      nextNone: "Aún no hay día de pago programado.",
    },
    agent: {
      eyebrow: "Asistente y reglas",
      title: "Qué hizo el asistente, y por qué",
      desc: "Cada sugerencia y acción se vincula a tus reglas, tu consentimiento y su registro on-chain.",
    },
    integrations: {
      eyebrow: "Integraciones",
      title: "Dónde trabaja y paga tu efectivo",
      desc: "Pools de rendimiento en Stellar y rieles de pago locales en Brasil, Argentina y Colombia.",
    },
    security: {
      eyebrow: "Seguridad",
      title: "Hecho para que tú tengas el control",
      desc: "Sin custodia por diseño, con límites firmados, acceso por roles y una auditoría a prueba de alteraciones.",
    },
    docs: {
      eyebrow: "Docs y SCF",
      title: "Cómo funciona Contextio por dentro",
      desc: "Arquitectura, el Protocolo de Contexto Legal y cómo encaja en el track de la Stellar Community Fund.",
    },
  },
};

const pt: Dict = {
  nav: {
    home: "Início",
    treasury: "Tesouraria",
    payroll: "Folha",
    agent: "Assistente e Jurídico",
    integrations: "Integrações",
    security: "Segurança",
    docs: "Docs",
    workspace: "Abrir demo",
  },
  auth: {
    connect: "Conectar carteira",
    connecting: "Conectando…",
    disconnect: "Desconectar",
    live: "Ao vivo",
    demo: "Dados demo",
  },
  hero: {
    badge1: "Feito na Stellar",
    badge2: "Suas chaves · seu dinheiro",
    title: "Pague seu time e faça seu caixa render — no piloto automático",
    subtitle:
      "A Contextio é um assistente financeiro inteligente para empresas da América Latina. Mantém caixa pronto para o dia do pagamento, coloca o resto para render e paga seu time no Brasil, Argentina e Colômbia — enquanto você mantém o controle total dos seus fundos.",
    ctaPrimary: "Testar a demo",
    ctaSecondary: "Ver como funciona",
    trust: "Sem custódia — a Contextio nunca guarda seu dinheiro. Você guarda.",
  },
  steps: {
    eyebrow: "Três passos simples",
    title: "Configure uma vez e deixe rodar",
    s1Title: "1 · Conecte sua carteira",
    s1Body:
      "Entre com sua carteira Stellar, como aproximar o cartão — mas as chaves são suas. Sem senhas, sem cadastros.",
    s2Title: "2 · Defina suas regras",
    s2Body:
      "Diga à Contextio quanto caixa manter sempre pronto e quão ousada ser. É como um termostato: você define a faixa e ela fica dentro dela.",
    s3Title: "3 · Deixe rodar",
    s3Body:
      "Seu assistente acompanha o saldo 24/7 — cobre o pagamento, rende com a sobra e paga seu time em dia.",
  },
  benefits: {
    eyebrow: "Por que usam a Contextio",
    title: "Menos trabalho manual. Mais tranquilidade.",
    b1Title: "Sempre pronto para o pagamento",
    b1Body:
      "A Contextio reserva uma folga do tamanho da sua próxima folha, mais uma margem para a oscilação do câmbio — o dia do pagamento nunca te pega de surpresa.",
    b2Title: "Seu caixa parado rende",
    b2Body:
      "Os dólares que sobram rendem em pools verificados da Stellar em vez de ficar parados — como uma poupança que se financia sozinha.",
    b3Title: "Pague na LATAM, rápido",
    b3Body:
      "Seu time no Brasil, Argentina e Colômbia recebe pelos trilhos locais — PIX, Transferencias 3.0 e Bre-B.",
    b4Title: "Você mantém o controle",
    b4Body:
      "É sem custódia: cada movimento é assinado por você, limitado pelas suas regras e gravado num registro à prova de adulteração.",
  },
  flow: {
    eyebrow: "Como o dinheiro se move",
    title: "Um assistente; seu dinheiro continua seu",
    subtitle:
      "Você mantém a custódia o tempo todo. O assistente só sugere e executa movimentos dentro dos limites que você assinou — e cada passo fica registrado.",
  },
  why: {
    t1: "Sem custódia",
    b1: "Suas chaves, seu dinheiro. O assistente só age dentro dos limites que você assina.",
    t2: "Regras verificáveis",
    b2: "Cada ação é ligada aos seus termos publicados — qualquer um pode conferir.",
    t3: "Feito na Stellar",
    b3: "Liquidação rápida e barata em dólares digitais e XLM.",
  },
  cta: {
    title: "Pronto para colocar sua tesouraria no piloto automático?",
    body: "Conecte uma carteira Stellar na testnet e explore a experiência completa — sem dinheiro em risco.",
    button: "Testar a demo",
  },
  feed: {
    eyebrow: "Ao vivo",
    title: "O que o assistente está fazendo agora",
    subtitle: "Atividade real e on-chain do agente autônomo da Contextio — rodando 24/7 na testnet da Stellar.",
    agentLabel: "Carteira do agente",
    empty: "Acordando o assistente…",
    viewAll: "Ver toda a atividade",
    connection: "CONEXÃO",
    online: "ONLINE",
    title2: "Feed de auditoria do agente",
  },
  footer: {
    tagline:
      "Contextio — tesouraria e folha inteligentes para a América Latina, na Stellar. Sem custódia · Demo na testnet · Não é consultoria financeira.",
    security: "Segurança",
    docs: "Docs",
  },
  diagram: {
    laneCompany: "SUA EMPRESA",
    lanePlatform: "CONTEXTIO (O ASSISTENTE)",
    laneStellar: "REDE STELLAR E PAGAMENTOS",
    treasuryTitle: "Seu dinheiro",
    treasurySub: "dólares · XLM",
    agentTitle: "Assistente inteligente",
    agentSub: "planeja e monitora",
    engineTitle: "Motor da Contextio",
    engineSub: "checa suas regras",
    recordsTitle: "Registros",
    recordsSub: "histórico e auditoria",
    contractsTitle: "Contratos Stellar",
    contractsSub: "tesouraria + folha",
    savingsTitle: "Pools de poupança",
    savingsSub: "rendem",
    lendingTitle: "Empréstimos",
    lendingSub: "rendem",
    payoutsTitle: "Pagamentos locais",
    payoutsSub: "PIX · Bre-B",
    binding: "Suas regras, assinadas em cada ação",
  },
  pages: {
    treasury: {
      eyebrow: "Tesouraria",
      title: "Seu dinheiro num relance",
      desc: "Veja seu caixa, o que está separado para o pagamento e o que rende em silêncio — tudo num lugar.",
      connectTitle: "Veja sua tesouraria ao vivo",
      connectBody: "Conecte sua carteira Stellar para ver seus saldos reais — o que está pronto para o pagamento e o que rende. Aqui nada é falso.",
      loading: "Carregando seu dinheiro…",
      statTotal: "Dinheiro total",
      statTotalSub: "todos os seus saldos",
      statReady: "Pronto para pagar",
      statReadySub: "disponível",
      statEarning: "Rendendo",
      statEarningSub: "posto para trabalhar",
      statShare: "Parte que rende",
      statShareSub: "do seu total",
      allocTitle: "Caixa pronto vs. rendendo",
      allocBody:
        "A Contextio mantém o necessário para o pagamento e põe o resto para trabalhar. Você define o equilíbrio; ela fica dentro dele.",
      liquid: "Caixa pronto",
      earning: "Rendendo",
      posTitle: "Onde está seu dinheiro",
      posEmpty: "Ainda não há saldos.",
      colAsset: "Ativo",
      colWhere: "Onde",
      colYield: "Rende",
      colAmount: "Valor",
      placeLiquidity: "Caixa pronto",
      placeVault: "Pool de poupança",
      placeBlend: "Empréstimos",
      rulesTitle: "Suas regras",
      rulesBody: "Os limites que o assistente sempre deve respeitar.",
      ruleFloor: "Sempre manter pronto",
      ruleMaxYield: "Máximo que pode render",
      ruleSensitivity: "Quão ousado",
      activityTitle: "Atividade recente",
      activityBody: "O que seu assistente fez, do mais novo primeiro.",
      activityEmpty: "Ainda sem movimentos — seu assistente vai registrá-los aqui.",
    },
    payroll: {
      eyebrow: "Folha",
      title: "Pague seu time na LATAM",
      desc: "Veja quem recebe, quando é o pagamento e como a Contextio vai cobrir a próxima rodada.",
      connectTitle: "Veja sua folha",
      connectBody: "Conecte sua carteira Stellar para ver seu time real e os próximos pagamentos. Aqui nada é falso.",
      statPeople: "Pessoas que você paga",
      statPeopleSub: "ativas",
      statMonthly: "Folha mensal",
      statMonthlySub: "bruto",
      statNext: "Próximo pagamento",
      statNeeded: "Necessário para a próxima",
      statNeededSub: "incl. margem de segurança",
      teamTitle: "Seu time",
      teamEmpty: "Ainda não há pessoas.",
      colName: "Nome",
      colCountry: "País",
      colAsset: "Recebe em",
      colRail: "Enviado via",
      colSalary: "Pagamento",
      colStatus: "Status",
      active: "Ativo",
      paused: "Pausado",
      fundTitle: "Como o próximo pagamento é coberto",
      fundBody: "A Contextio usa primeiro o caixa livre e, só se preciso, o que está rendendo.",
      fundGross: "Para pagar seu time",
      fundBuffer: "Margem de segurança (8,5%)",
      fundNeeded: "Total necessário",
      fundReady: "Caixa pronto agora",
      fundOk: "Há o suficiente pronto — seu time recebe em dia.",
      fundShort: "É preciso um reforço antes do pagamento.",
      nextNone: "Nenhum pagamento agendado ainda.",
    },
    agent: {
      eyebrow: "Assistente e regras",
      title: "O que o assistente fez, e por quê",
      desc: "Cada sugestão e ação se liga às suas regras, ao seu consentimento e ao registro on-chain.",
    },
    integrations: {
      eyebrow: "Integrações",
      title: "Onde seu caixa trabalha e paga",
      desc: "Pools de rendimento na Stellar e trilhos de pagamento locais no Brasil, Argentina e Colômbia.",
    },
    security: {
      eyebrow: "Segurança",
      title: "Feito para você manter o controle",
      desc: "Sem custódia por design, com limites assinados, acesso por papéis e uma trilha de auditoria à prova de adulteração.",
    },
    docs: {
      eyebrow: "Docs e SCF",
      title: "Como a Contextio funciona por dentro",
      desc: "Arquitetura, o Protocolo de Contexto Legal e como isso se encaixa no track da Stellar Community Fund.",
    },
  },
};

const DICTS: Record<Locale, Dict> = { en, es, pt };

function resolve(dict: Dict, path: string): string | undefined {
  const out = path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Dict)) return (acc as Dict)[k];
    return undefined;
  }, dict);
  return typeof out === "string" ? out : undefined;
}

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nState | null>(null);

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const l = navigator.language.toLowerCase();
  if (l.startsWith("es")) return "es";
  if (l.startsWith("pt")) return "pt";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("contexta.locale")) as Locale | null;
    const initial = saved && DICTS[saved] ? saved : detectLocale();
    setLocaleState(initial);
    document.documentElement.lang = initial;
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("contexta.locale", l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string) => resolve(DICTS[locale], key) ?? resolve(en, key) ?? key,
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

/** Convenience: just the translate function. */
export function useT(): (key: string) => string {
  return useI18n().t;
}

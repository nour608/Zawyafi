'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  DollarSign,
  CalendarClock,
  Link2,
  MapPin,
  ShieldCheck,
  ScanLine,
  Landmark,
  Lock,
  Server,
  Database,
  Radio,
  BarChart3,
  Coffee,
  Store,
  CakeSlice,
  ChevronRight,
  Coins,
} from 'lucide-react'
import { ZawyafiLogo } from '@/components/branding/zawyafi-logo'

/* ------------------------------------------------------------------ */
/*  Scroll-reveal hook                                                 */
/* ------------------------------------------------------------------ */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('animate-fade-up')
          el.classList.remove('opacity-0', 'translate-y-8')
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

function RevealSection({
  children,
  className = '',
  delay = '',
}: {
  children: React.ReactNode
  className?: string
  delay?: string
}) {
  const ref = useReveal()
  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-8 transition-all duration-700 ${delay} ${className}`}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const trustSignals = [
  { icon: ShieldCheck, label: 'KYC / AML Compliant' },
  { icon: ScanLine, label: 'Chainlink Verified' },
  { icon: Landmark, label: 'Regulated Marketplace' },
  { icon: Lock, label: 'Audited Smart Contracts' },
  { icon: Server, label: 'Bank-Grade Infrastructure' },
]

const features = [
  {
    icon: DollarSign,
    title: 'Fractional Access from $10',
    description:
      'Invest in tokenized real-world businesses — factories, cafés, and vending machines — without heavy capital requirements. Ownership starts at just $10.',
  },
  {
    icon: CalendarClock,
    title: 'Flexible Profit Distribution',
    description:
      'Earn returns daily, weekly, or monthly — tied directly to real business performance. Choose deals that match your cash-flow preferences.',
  },
  {
    icon: Link2,
    title: 'Off-Chain to On-Chain Transparency',
    description:
      'Real merchant data linked to the blockchain through Chainlink CRE. Every report is verifiable, every transaction is auditable.',
  },
]

const opportunities = [
  {
    image:
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=600&auto=format&fit=crop',
    alt: 'Specialty café interior',
    type: 'Café Chain',
    icon: Coffee,
    location: 'Riyadh, KSA',
    name: 'Specialty Coffee Chain — 12 Locations',
    metric: 'Target APY',
    metricValue: '18.5%',
    min: '$10',
    funded: 72,
    raised: '$360K',
    goal: '$500K',
    payout: 'Monthly',
  },
  {
    image:
      'https://images.unsplash.com/photo-1625937329935-287441889bce?q=80&w=600&auto=format&fit=crop',
    alt: 'Modern vending machines',
    type: 'Vending Network',
    icon: Store,
    location: 'Dubai, UAE',
    name: 'Smart Vending Network — 80 Units',
    metric: 'Target APY',
    metricValue: '22.0%',
    min: '$10',
    funded: 45,
    raised: '$225K',
    goal: '$500K',
    payout: 'Weekly',
  },
  {
    image:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop',
    alt: 'Artisan bakery production',
    type: 'Bakery',
    icon: CakeSlice,
    location: 'Jeddah, KSA',
    name: 'Artisan Bakery Expansion',
    metric: 'Multiplier',
    metricValue: '2.4x',
    min: '$10',
    funded: 88,
    raised: '$440K',
    goal: '$500K',
    payout: 'Daily',
  },
]

const protocolFlowNodes = {
  merchant: {
    icon: Database,
    title: 'Merchant Data',
    description: 'POS sales, inventory, and revenue data collected from the business in real-time.',
  },
  cpr: {
    icon: Server,
    title: 'Backend CPR Engine',
    description: 'Compliance Processing & Reporting engine validates, normalizes, and scores data.',
  },
  cre: {
    icon: Radio,
    title: 'Chainlink CRE',
    description: 'Cross-chain Reporting Environment publishes verified reports onchain via oracle.',
  },
  onchain: {
    icon: BarChart3,
    title: 'Onchain Registry & Dividends',
    description: 'Smart contracts update NAV, distribute dividends, and log immutable investor records.',
  },
}

type FlowNode = (typeof protocolFlowNodes)[keyof typeof protocolFlowNodes]

function FlowStepCard({ node, className = '' }: { node: FlowNode; className?: string }) {
  const Icon = node.icon

  return (
    <div className={`relative rounded-2xl border border-cc-border bg-[var(--bg-surface)] p-5 shadow-sm backdrop-blur-sm ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl border border-cc-border bg-cc-bg">
          <Icon className="size-5 text-cc-text" />
        </div>
      </div>
      <h3 className="mb-2 text-base font-bold text-cc-text">{node.title}</h3>
      <p className="text-sm leading-relaxed text-cc-text-sec">{node.description}</p>
    </div>
  )
}

/* ================================================================== */
/*  PAGE                                                               */
/* ================================================================== */
export default function LandingPage() {
  return (
    <div className="relative text-[var(--text-primary)]">
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative overflow-hidden">
        {/* SVG dot pattern background */}
        <div className="absolute inset-0 z-0 opacity-[0.03]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dot-pattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#1c1c1c" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-pattern)" />
          </svg>
        </div>

        <div className="relative z-10 cc-container pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-3xl mx-auto text-center">
            <p className="mb-8 animate-fade-in font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 md:text-[11px]">
              BLOCKCHAIN · TOKENIZED ASSETS · SME INVESTMENTS
            </p>

            <h1 className="font-display text-4xl sm:text-5xl md:text-[4rem] font-normal tracking-tight leading-[1.08] mb-6">
              Invest in Real Businesses.{' '}
              <span className="italic text-[var(--gold-light)]">Earn Real Returns.</span>
            </h1>

            <p className="mb-4 max-w-2xl mx-auto font-mono text-[12.5px] text-[var(--text-muted)] leading-relaxed md:text-[14px]">
              Access curated tokenized business assets across factories, cafés, and vending machines.
              Start from just{' '}
              <span className="text-[var(--text-primary)] font-semibold">$10</span>.
            </p>

            <div className="mb-10 space-y-1.5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)] md:text-[12px]">
                Selected opportunities may target up to 70% returns.
              </p>
              <p className="text-xs text-cc-text-sec md:text-[13px]">
                Returns are not guaranteed and vary by asset and market conditions.
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/investor/marketplace"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-[#161733] px-9 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-[#f5f2eb] transition-all duration-300 [clip-path:polygon(9px_0%,100%_0%,calc(100%-9px)_100%,0_100%)] hover:brightness-110 dark:bg-[linear-gradient(135deg,#c9a84c,#e8c97a)] dark:text-[#0a0c10]"
              >
                START INVESTING
              </Link>
              <Link
                href="/investor/marketplace"
                className="w-full sm:w-auto inline-flex items-center justify-center border border-[var(--border-medium)] px-9 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--gold)] transition-all duration-300 hover:border-[var(--gold)] dark:border-[rgba(201,168,76,0.35)] dark:text-[#cfae61]"
              >
                EXPLORE ASSETS
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-[560px] mx-auto">
              {[
                { lead: '$10', accent: '', label: 'MINIMUM' },
                { lead: '24/7', accent: '', label: 'ACCESS' },
                { lead: 'DAILY', accent: '', label: 'PAYOUTS' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="border border-[#e9e1cf] bg-white/85 px-4 py-2.5 text-center shadow-[0_6px_18px_rgba(20,26,38,0.06)] backdrop-blur-[2px] dark:border-[rgba(201,168,76,0.24)] dark:bg-[rgba(12,16,23,0.68)] dark:shadow-[0_8px_22px_rgba(0,0,0,0.35)]"
                >
                  <p className="font-display text-[27px] leading-none text-cc-text">
                    {stat.lead}
                    {stat.accent ? <span className="text-[var(--gold)]">{stat.accent}</span> : null}
                  </p>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-cc-text-sec">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────── TRUST STRIP ─────────────── */}
      <section className="border-y border-cc-border bg-cc-bg-alt py-10">
        <div className="cc-container">
          <p className="text-center text-[11px] font-semibold text-cc-text-sec mb-8 uppercase tracking-[0.2em]">
            Built on institutional-grade infrastructure
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-14">
            {trustSignals.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 text-cc-text-sec hover:text-cc-text transition-colors duration-300 group"
              >
                <item.icon className="size-5 text-cc-text-sec/50 group-hover:text-cc-text transition-colors" />
                <span className="text-sm font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative z-10">
      {/* ────────────── FEATURE CARDS ─────────────── */}
      <section className="cc-section bg-cc-bg">
        <div className="cc-container">
          <RevealSection>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  Why Choose <span className="text-cc-text-sec">Zawyafi</span>
                </h2>
                <p className="text-lg text-cc-text-sec">
                  We bridge the gap between real-world businesses and global
                  investors through tokenization, transparency, and trust.
                </p>
              </div>
              <Link
                href="/investor/marketplace"
                className="cc-nav-link flex items-center gap-1 group shrink-0 text-base pb-0.5"
              >
                Explore the marketplace
                <ArrowRight className="size-4 cc-arrow" />
              </Link>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <RevealSection key={feature.title} delay={`delay-[${i * 150}ms]`}>
                <div className="group cc-card p-8 h-full hover:shadow-cc-card-hover">
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cc-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="mb-6 inline-flex size-12 items-center justify-center rounded-cc bg-cc-bg-alt text-cc-text border border-cc-border">
                    <feature.icon className="size-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-cc-text-sec leading-relaxed text-[15px]">
                    {feature.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── LIVE OPPORTUNITIES PREVIEW ──────── */}
      <section className="cc-section bg-cc-bg-alt border-y border-cc-border">
        <div className="cc-container">
          <RevealSection>
            <div className="flex items-end justify-between mb-12 gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">
                  Live Opportunities
                </h2>
                <p className="text-cc-text-sec">
                  Real businesses, real returns. Browse tokenized deals open for
                  investment.
                </p>
              </div>
              <Link
                href="/investor/marketplace"
                className="hidden sm:flex items-center gap-1 rounded-full border border-cc-border bg-cc-bg px-5 py-2.5 text-sm font-semibold hover:bg-cc-bg-alt transition-all shrink-0 shadow-sm"
              >
                View All
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {opportunities.map((opp, i) => (
              <RevealSection key={opp.name} delay={`delay-[${i * 100}ms]`}>
                <div className="group flex flex-col cc-card h-full hover:shadow-cc-card-hover">
                  {/* Image */}
                  <div className="relative h-48 w-full overflow-hidden rounded-t-cc">
                    <Image
                      alt={opp.alt}
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      fill
                      src={opp.image}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-xs font-semibold text-cc-text">
                      <opp.icon className="size-3.5" />
                      {opp.type}
                    </div>
                    <div className="absolute top-4 right-4 rounded-full bg-cc-accent/20 px-2.5 py-1 text-xs font-bold text-cc-accent border border-cc-accent/30">
                      Open
                    </div>
                    <div className="absolute bottom-4 right-4 rounded-full bg-cc-text/80 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">
                      {opp.payout} payout
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-cc-text-sec mb-2">
                      <MapPin className="size-3.5" />
                      {opp.location}
                    </div>
                    <h3 className="text-lg font-bold mb-4 text-cc-text">{opp.name}</h3>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-xs text-cc-text-sec mb-1">
                          {opp.metric}
                        </p>
                        <p className="text-base font-bold text-cc-text">
                          {opp.metricValue}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-cc-text-sec mb-1">
                          Min Investment
                        </p>
                        <p className="text-base font-bold">{opp.min}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs font-medium mb-2">
                        <span>{opp.funded}% Funded</span>
                        <span>
                          {opp.raised} / {opp.goal}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-cc-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cc-text transition-all duration-1000"
                          style={{ width: `${opp.funded}%` }}
                        />
                      </div>
                    </div>

                    {/* Learn more */}
                    <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-cc-text-sec group-hover:text-cc-text transition-colors">
                      Learn More
                      <ArrowRight className="size-3.5 cc-arrow" />
                    </div>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>

          {/* Mobile CTA */}
          <div className="mt-8 sm:hidden text-center">
            <Link
              href="/investor/marketplace"
              className="inline-flex items-center gap-1 rounded-full border border-cc-border bg-cc-bg px-6 py-3 text-sm font-semibold hover:bg-cc-bg-alt transition-all shadow-sm"
            >
              View All Opportunities
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ──────── HOW IT WORKS — PROTOCOL RAIL ──────── */}
      <section id="how-it-works" className="cc-section bg-cc-bg">
        <div className="cc-container">
          <RevealSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                How It Works
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-cc-text-sec">
                Merchant data is processed by the Backend CPR Engine and Chainlink CRE in
                parallel before onchain registry updates and dividend distribution.
              </p>
            </div>
          </RevealSection>

          <div className="hidden md:block">
            <div className="relative mx-auto max-w-6xl">
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <g stroke="var(--border-subtle)" strokeWidth="1.5" fill="none">
                  <path d="M 36 30 V 70" />
                  <path d="M 20 50 H 36" />
                  <path d="M 36 30 H 44" />
                  <path d="M 36 70 H 44" />

                  <path d="M 64 30 V 70" />
                  <path d="M 56 30 H 64" />
                  <path d="M 56 70 H 64" />
                  <path d="M 64 50 H 74" />
                </g>
                <polygon points="44,28.6 44,31.4 45.6,30" fill="var(--border-subtle)" />
                <polygon points="44,68.6 44,71.4 45.6,70" fill="var(--border-subtle)" />
                <polygon points="74,48.6 74,51.4 75.6,50" fill="var(--border-subtle)" />
              </svg>

              <div className="grid grid-cols-[1fr_0.4fr_1fr_0.4fr_1fr] grid-rows-2 gap-x-0 gap-y-8 py-5">
                <RevealSection className="col-start-1 row-span-2 flex items-center">
                  <FlowStepCard node={protocolFlowNodes.merchant} />
                </RevealSection>

                <RevealSection delay="delay-[100ms]" className="col-start-3 row-start-1">
                  <FlowStepCard node={protocolFlowNodes.cpr} />
                </RevealSection>

                <RevealSection delay="delay-[200ms]" className="col-start-3 row-start-2">
                  <FlowStepCard node={protocolFlowNodes.cre} />
                </RevealSection>

                <RevealSection delay="delay-[300ms]" className="col-start-5 row-span-2 flex items-center">
                  <FlowStepCard node={protocolFlowNodes.onchain} />
                </RevealSection>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            <RevealSection>
              <FlowStepCard node={protocolFlowNodes.merchant} />
            </RevealSection>

            <RevealSection delay="delay-[80ms]">
              <div className="relative py-2">
                <div className="h-px w-full bg-cc-border" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-cc-bg px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-cc-text-sec">
                    Parallel Processing
                  </span>
                </div>
              </div>
            </RevealSection>

            <RevealSection delay="delay-[120ms]">
              <FlowStepCard node={protocolFlowNodes.cpr} />
            </RevealSection>

            <RevealSection delay="delay-[200ms]">
              <FlowStepCard node={protocolFlowNodes.cre} />
            </RevealSection>

            <RevealSection delay="delay-[260ms]">
              <div className="relative py-2">
                <div className="h-px w-full bg-cc-border" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-cc-bg px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-cc-text-sec">
                    Converges Onchain
                  </span>
                </div>
              </div>
            </RevealSection>

            <RevealSection delay="delay-[300ms]">
              <FlowStepCard node={protocolFlowNodes.onchain} />
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ────────────── FINAL CTA ─────────────── */}
      <section className="relative cc-section overflow-hidden border-t border-cc-border bg-cc-bg-alt">
        {/* Subtle radial glow */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cc-border/30 blur-3xl" />

        <div className="relative z-10 cc-container text-center">
          <RevealSection>
            <div className="inline-flex items-center gap-2 rounded-full border border-cc-border bg-cc-bg px-4 py-1.5 mb-8 shadow-sm">
              <Coins className="size-4 text-cc-text" />
              <span className="text-sm font-semibold text-cc-text">
                Start with $10
              </span>
            </div>

            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-6 max-w-2xl mx-auto">
              Ready to invest in{' '}
              <span className="text-cc-text-sec">
                real businesses
              </span>
              ?
            </h2>
            <p className="text-lg text-cc-text-sec mb-10 max-w-xl mx-auto leading-relaxed">
              Join a growing community of investors earning real returns from
              tokenized business inventory — fully transparent, fully onchain.
            </p>

            <Link
              href="/investor/marketplace"
              className="inline-flex items-center justify-center bg-[#161733] px-9 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-[#f5f2eb] transition-all duration-300 [clip-path:polygon(9px_0%,100%_0%,calc(100%-9px)_100%,0_100%)] hover:brightness-110 dark:bg-[linear-gradient(135deg,#c9a84c,#e8c97a)] dark:text-[#0a0c10]"
            >
              START INVESTING
            </Link>

            <p className="mt-8 text-xs text-cc-text-sec max-w-md mx-auto">
              Investing involves risk. Past performance is not indicative of
              future results. Tokenized assets are subject to market conditions
              and regulatory requirements. Please review all deal documentation
              before investing.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ────────────── FOOTER ─────────────── */}
      <footer className="border-t border-cc-border bg-cc-bg py-16">
        <div className="cc-container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="mb-4">
                <ZawyafiLogo className="h-8 w-auto text-cc-text" />
              </div>
              <p className="text-sm text-cc-text-sec leading-relaxed">
                Tokenized real-world business investing.
                Transparent. Compliant. Accessible.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-cc-text-sec mb-4">
                Platform
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/investor/marketplace"
                    className="cc-nav-link pb-0.5"
                  >
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link
                    href="/merchant"
                    className="cc-nav-link pb-0.5"
                  >
                    For Businesses
                  </Link>
                </li>
                <li>
                  <Link
                    href="/compliance"
                    className="cc-nav-link pb-0.5"
                  >
                    Compliance
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-cc-text-sec mb-4">
                Company
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/#about"
                    className="cc-nav-link pb-0.5"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#how-it-works"
                    className="cc-nav-link pb-0.5"
                  >
                    How It Works
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-cc-text-sec mb-4">
                Legal
              </h4>
              <ul className="space-y-3">
                <li>
                  <span className="text-sm text-cc-text-sec">
                    Terms of Service
                  </span>
                </li>
                <li>
                  <span className="text-sm text-cc-text-sec">
                    Privacy Policy
                  </span>
                </li>
                <li>
                  <span className="text-sm text-cc-text-sec">
                    Risk Disclosure
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-cc-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-cc-text-sec">
              © 2026 Zawyafi. All rights reserved.
            </p>
            <p className="text-xs text-cc-text-sec text-center sm:text-right max-w-md">
              Zawyafi is a technology platform, not a licensed financial
              institution. All investments carry risk. Read all documentation
              before investing.
            </p>
          </div>
        </div>
      </footer>
        </div>
      </div>
    </div>
  )
}

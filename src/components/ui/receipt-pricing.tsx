"use client"

// ReceiptPricing, adapted for Subtrack. Plans print like thermal receipts with
// serrated edges, a ledger with dot leaders, a total and a barcode; switching
// the period tears the slips off and prints new ones.
//
// Local changes from the original: fixed colors for the app's always-dark look
// (white paper, lime toggle) instead of shadcn theme tokens, Thai-friendly
// fonts and tracking, per-plan currency, ledger rows that can change with the
// period (`yearlyValue`), a link CTA (`href`), every printed word as a `labels`
// prop, and no subtotal or stamp when nothing is discounted.

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type ReceiptPeriod = "monthly" | "yearly"

/** One printed ledger row: a label on the left, a short value on the right, dot leaders between. */
export interface ReceiptItem {
  label: string
  value: string
  /** Shown instead of `value` while the yearly period is printed. */
  yearlyValue?: string
}

export interface ReceiptPlan {
  /** Stable id. Also seeds the order number and the barcode. */
  id: string
  name: string
  tagline?: string
  /** Price per month when billed monthly, in major units. */
  monthly: number
  /** Total per year. Defaults to `monthly * (12 - monthsFree)`. */
  yearly?: number
  /** ISO 4217 code for this plan. Defaults to the section's `currency`. */
  currency?: string
  items: ReceiptItem[]
  cta?: string
  /** When set, the button is a link to this path. */
  href?: string
  /** Prints the featured line and uses the dark button. */
  featured?: boolean
}

export interface ReceiptLabels {
  periodGroup: string
  order: string
  billing: string
  monthly: string
  yearly: string
  featured: string
  subtotal: string
  /** `{months}` is replaced with `monthsFree`. */
  discount: string
  totalDue: string
  /** `{amount}` is replaced with the per-month price. */
  perMonthYearly: string
  billedMonthly: string
  /** `{name}` is replaced with the plan name. */
  choose: string
  perMonth: string
  perYear: string
}

const DEFAULT_LABELS: ReceiptLabels = {
  periodGroup: "Billing period",
  order: "Order",
  billing: "Billing",
  monthly: "Monthly",
  yearly: "Yearly",
  featured: "Most popular",
  subtotal: "Subtotal",
  discount: "{months} months free",
  totalDue: "Total due",
  perMonthYearly: "{amount} / mo · billed yearly",
  billedMonthly: "Billed monthly · cancel anytime",
  choose: "Choose {name}",
  perMonth: "per month",
  perYear: "per year",
}

export interface ReceiptPricingProps extends React.ComponentProps<"section"> {
  plans: ReceiptPlan[]
  period?: ReceiptPeriod
  defaultPeriod?: ReceiptPeriod
  onPeriodChange?: (period: ReceiptPeriod) => void
  onSelectPlan?: (plan: ReceiptPlan, period: ReceiptPeriod) => void
  /** Months waived on yearly billing. 0 prints no discount line and no stamp. */
  monthsFree?: number
  currency?: string
  /** Fixed by default so server and client format identically. */
  locale?: string
  merchant?: string
  merchantNote?: string
  orderPrefix?: string
  /** Stamp text on yearly receipts. `{months}` is replaced with `monthsFree`. */
  stampLabel?: string
  labels?: Partial<ReceiptLabels>
  showStamp?: boolean
  showBarcode?: boolean
  printOnReveal?: boolean
  printMs?: number
  tearMs?: number
  stagger?: number
  toothWidth?: number
  toothDepth?: number
  /** Strength (0–1) of the thermal scan lines on the paper. */
  grain?: number
}

type Phase = "idle" | "tear" | "hidden" | "print"

const ENTER = "cubic-bezier(0.22, 1, 0.36, 1)"
const EXIT = "cubic-bezier(0.4, 0, 1, 1)"

// Latin and digits in a monospace face; Thai falls back to the app's IBM Plex Sans Thai.
const RECEIPT_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, var(--font-sans), monospace'

/** FNV-1a. Small and stable, enough to give every plan its own order number and barcode. */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function bars(seed: string, count: number): number[] {
  let h = hash(seed)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    out.push((h % 3) + 1)
  }
  return out
}

function useReducedMotion(): boolean {
  const subscribe = React.useCallback((onChange: () => void) => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

// The first paint must be a complete receipt (SSR, no-JS and reduced motion all render `idle`),
// so hiding it before the print has to happen before the browser paints.
const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all)
}

export function ReceiptPricing({
  plans,
  period,
  defaultPeriod = "monthly",
  onPeriodChange,
  onSelectPlan,
  monthsFree = 2,
  currency = "USD",
  locale = "en-US",
  merchant = "Acme",
  merchantNote = "Thank you for your business",
  orderPrefix = "AC",
  stampLabel = "{months} months free",
  labels,
  showStamp = true,
  showBarcode = true,
  printOnReveal = true,
  printMs = 460,
  tearMs = 200,
  stagger = 60,
  toothWidth = 12,
  toothDepth = 6,
  grain = 0.05,
  className,
  children,
  ...rest
}: ReceiptPricingProps) {
  const L: ReceiptLabels = { ...DEFAULT_LABELS, ...labels }
  const rootRef = React.useRef<HTMLElement | null>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const reduce = useReducedMotion()

  const [internal, setInternal] = React.useState<ReceiptPeriod>(defaultPeriod)
  const selected = period ?? internal
  // What the paper currently shows. It lags `selected` while the old slip tears off.
  const [printed, setPrinted] = React.useState<ReceiptPeriod>(selected)
  const [phase, setPhase] = React.useState<Phase>("idle")

  const count = Math.max(plans.length, 1)
  const rowMs = (base: number) => base + stagger * (count - 1)

  // Reprint whenever the selection moves away from what is on the paper.
  React.useEffect(() => {
    if (selected === printed) return
    if (reduce || printMs + tearMs === 0) {
      const t = window.setTimeout(() => {
        setPrinted(selected)
        setPhase("idle")
      }, 0)
      return () => window.clearTimeout(t)
    }
    const tearDone = rowMs(tearMs)
    const t0 = window.setTimeout(() => setPhase("tear"), 0)
    const t1 = window.setTimeout(() => {
      setPrinted(selected)
      setPhase("hidden")
    }, tearDone)
    // One frame of `transition: none` so the paper jumps to "unprinted" instead of animating there.
    const t2 = window.setTimeout(() => setPhase("print"), tearDone + 32)
    const t3 = window.setTimeout(() => setPhase("idle"), tearDone + 32 + rowMs(printMs))
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
    // `printed` is intentionally not a dependency: it is set inside and must not restart the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, reduce])

  // Print on first reveal. Already on screen starts at once; otherwise it waits for the scroll.
  useIsoLayoutEffect(() => {
    const host = rootRef.current
    if (!host || !printOnReveal || reduce) return
    let t1 = 0
    let t2 = 0
    const start = () => {
      t1 = window.setTimeout(() => setPhase("print"), 32)
      t2 = window.setTimeout(() => setPhase("idle"), 32 + rowMs(printMs))
    }
    // Hidden before the first paint, so the full receipt never flashes before printing.
    setPhase("hidden")
    const rect = host.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
      start()
      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        start()
      },
      { threshold: 0.2 },
    )
    io.observe(host)
    return () => {
      io.disconnect()
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
    // Runs once on mount, like the original.
  }, [])

  const select = (next: ReceiptPeriod) => {
    if (period === undefined) setInternal(next)
    onPeriodChange?.(next)
  }

  const onOptionKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const order: ReceiptPeriod[] = ["monthly", "yearly"]
    const at = order.indexOf(selected)
    let next = at
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (at + 1) % order.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (at + order.length - 1) % order.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = order.length - 1
    else return
    e.preventDefault()
    const value = order[next]
    if (!value) return
    select(value)
    optionRefs.current[next]?.focus()
  }

  const formatter = (code: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const stamp = fill(stampLabel, { months: String(monthsFree) })
  const summary = plans
    .map((p) => {
      const due = printed === "yearly" ? (p.yearly ?? p.monthly * (12 - monthsFree)) : p.monthly
      return `${p.name} ${formatter(p.currency ?? currency).format(due)} ${printed === "yearly" ? L.perYear : L.perMonth}`
    })
    .join(", ")

  return (
    <section ref={rootRef} data-slot="receipt-pricing" data-period={selected} className={cn("w-full", className)} {...rest}>
      {children}

      <div
        data-slot="period-toggle"
        role="radiogroup"
        aria-label={L.periodGroup}
        className="mx-auto flex h-11 w-fit items-center rounded-full border border-[#2c2c31] bg-[#222226] p-1"
      >
        {(["monthly", "yearly"] as const).map((option, i) => {
          const active = selected === option
          return (
            <button
              key={option}
              ref={(node) => {
                optionRefs.current[i] = node
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-period={option}
              data-state={active ? "checked" : "unchecked"}
              onClick={() => select(option)}
              onKeyDown={onOptionKeyDown}
              className={cn(
                "h-9 cursor-pointer rounded-full border-0 px-5 text-sm font-semibold outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-[#7cf05a]/50",
                active ? "bg-[#7cf05a] text-[#0d1a07] shadow-[0_0_14px_#7cf05a44]" : "bg-transparent text-[#9b9ba3] hover:text-[#f3f3f5]",
              )}
            >
              {option === "monthly" ? L.monthly : L.yearly}
            </button>
          )
        })}
      </div>

      <div
        data-slot="receipt-row"
        className="mx-auto mt-8 grid w-full max-w-5xl grid-cols-1 items-start justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {plans.map((plan, i) => (
          <ReceiptSlip
            key={plan.id}
            plan={plan}
            period={printed}
            phase={phase}
            delay={stagger * i}
            index={i}
            money={formatter(plan.currency ?? currency)}
            monthsFree={monthsFree}
            merchant={merchant}
            merchantNote={merchantNote}
            orderPrefix={orderPrefix}
            stamp={stamp}
            labels={L}
            showStamp={showStamp}
            showBarcode={showBarcode}
            printMs={printMs}
            tearMs={tearMs}
            toothWidth={toothWidth}
            toothDepth={toothDepth}
            grain={grain}
            onSelect={() => onSelectPlan?.(plan, selected)}
          />
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {printed === "yearly" ? L.yearly : L.monthly}. {summary}.
      </p>
    </section>
  )
}

interface ReceiptSlipProps {
  plan: ReceiptPlan
  period: ReceiptPeriod
  phase: Phase
  delay: number
  index: number
  money: Intl.NumberFormat
  monthsFree: number
  merchant: string
  merchantNote: string
  orderPrefix: string
  stamp: string
  labels: ReceiptLabels
  showStamp: boolean
  showBarcode: boolean
  printMs: number
  tearMs: number
  toothWidth: number
  toothDepth: number
  grain: number
  onSelect: () => void
}

const INK_SOFT = "text-[#0c0c0e]/60"
const ACCENT = "text-[#2f7d1d]"

/** One slip of paper. Exported so a single plan can be dropped into a card. */
export function ReceiptSlip({
  plan,
  period,
  phase,
  delay,
  index,
  money,
  monthsFree,
  merchant,
  merchantNote,
  orderPrefix,
  stamp,
  labels: L,
  showStamp,
  showBarcode,
  printMs,
  tearMs,
  toothWidth,
  toothDepth,
  grain,
  onSelect,
}: ReceiptSlipProps) {
  const yearly = plan.yearly ?? plan.monthly * (12 - monthsFree)
  const isYearly = period === "yearly"
  const subtotal = isYearly ? plan.monthly * 12 : plan.monthly
  const discount = isYearly ? Math.max(0, subtotal - yearly) : 0
  const due = isYearly ? yearly : plan.monthly
  const perMonth = isYearly ? yearly / 12 : plan.monthly
  const order = `${orderPrefix}-${(hash(plan.id) % 90000) + 10000}`
  const code = `${order}-${isYearly ? "YR" : "MO"}`

  const paper: React.CSSProperties = {
    // Serrated top and bottom edges via a CSS mask, so they stay sharp at any width.
    ["--tooth-w" as string]: `${toothWidth}px`,
    ["--tooth-h" as string]: `${toothDepth * 2}px`,
    fontFamily: RECEIPT_FONT,
    maskImage: MASK_LAYERS,
    maskSize: MASK_SIZE,
    maskPosition: MASK_POSITION,
    maskRepeat: MASK_REPEAT,
    WebkitMaskImage: MASK_LAYERS,
    WebkitMaskSize: MASK_SIZE,
    WebkitMaskPosition: MASK_POSITION,
    WebkitMaskRepeat: MASK_REPEAT,
    backgroundImage:
      grain > 0
        ? `repeating-linear-gradient(180deg, color-mix(in oklab, currentColor ${(grain * 100).toFixed(1)}%, transparent) 0 1px, transparent 1px 4px)`
        : undefined,
    ...phaseStyle(phase, delay, printMs, tearMs),
  }

  const buttonClass = cn(
    "mt-5 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md text-xs font-semibold tracking-[0.08em] outline-none transition-[background-color,transform] duration-200 focus-visible:ring-[3px] focus-visible:ring-[#2f7d1d]/50 active:scale-[0.98]",
    plan.featured ? "border-0 bg-[#0c0c0e] text-[#7cf05a] hover:opacity-90" : "border border-[#0c0c0e]/30 bg-transparent text-[#0c0c0e] hover:bg-[#0c0c0e]/5",
  )
  const cta = plan.cta ?? fill(L.choose, { name: plan.name })
  // Inline, because the app's unlayered `a { color: inherit }` beats Tailwind's layered text colors.
  const buttonColor: React.CSSProperties = { color: plan.featured ? "#7cf05a" : "#0c0c0e" }

  return (
    <div
      data-slot="receipt-slip"
      data-plan={plan.id}
      className="w-full max-w-[19rem] transition-transform duration-200 ease-out hover:-translate-y-0.5"
      style={{ filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.2)) drop-shadow(0 12px 18px rgb(0 0 0 / 0.45))" }}
    >
      <article
        aria-label={plan.name}
        className="relative overflow-hidden border-x border-black/10 bg-[#f4f3ee] px-6 pt-8 pb-7 text-[#0c0c0e]"
        style={paper}
      >
        <header className="text-center">
          <p className="m-0 text-[13px] font-semibold tracking-[0.34em] uppercase">{merchant}</p>
          <p className={cn("m-0 mt-1.5 text-[11px] tracking-[0.04em]", INK_SOFT)}>{merchantNote}</p>
        </header>

        <Rule className="mt-5" />

        <dl className={cn("m-0 mt-3 space-y-1 text-[11px] tracking-[0.04em]", INK_SOFT)}>
          <div className="flex justify-between gap-3">
            <dt>{L.order}</dt>
            <dd className="m-0 text-[#0c0c0e] tabular-nums">{order}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{L.billing}</dt>
            <dd className="m-0 text-[#0c0c0e]">{isYearly ? L.yearly : L.monthly}</dd>
          </div>
        </dl>

        <Rule className="mt-3" />

        <div className="mt-4 text-center">
          <h3 className="m-0 text-lg font-semibold tracking-[0.12em] uppercase [overflow-wrap:anywhere]">{plan.name}</h3>
          {plan.tagline ? <p className={cn("m-0 mt-1 text-[11px] tracking-[0.04em]", INK_SOFT)}>{plan.tagline}</p> : null}
          {plan.featured ? (
            <p className={cn("m-0 mt-2 text-[11px] font-semibold tracking-[0.1em]", ACCENT)}>
              <span aria-hidden="true">*** </span>
              {L.featured}
              <span aria-hidden="true"> ***</span>
            </p>
          ) : null}
        </div>

        <Rule className="mt-4" />

        <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-xs tracking-[0.03em]">
          {plan.items.map((item) => (
            <li key={item.label} className="flex items-baseline gap-1.5">
              <span className="shrink-0">{item.label}</span>
              <span aria-hidden="true" className="min-w-3 flex-1 translate-y-[-0.28em] border-b border-dotted border-current/30" />
              <span className="min-w-0 truncate text-right tabular-nums">{isYearly && item.yearlyValue ? item.yearlyValue : item.value}</span>
            </li>
          ))}
        </ul>

        <Rule className="mt-4" />

        {discount > 0 ? (
          <dl className="m-0 mt-4 space-y-1.5 text-xs tracking-[0.03em]">
            <div className="flex items-baseline justify-between gap-3">
              <dt>{L.subtotal}</dt>
              <dd className="m-0 tabular-nums">{money.format(subtotal)}</dd>
            </div>
            <div className={cn("flex items-baseline justify-between gap-3", ACCENT)}>
              <dt>{fill(L.discount, { months: String(monthsFree) })}</dt>
              <dd className="m-0 tabular-nums">-{money.format(discount)}</dd>
            </div>
          </dl>
        ) : null}

        <div className={cn("border-t-[3px] border-double border-current/40 pt-3", discount > 0 ? "mt-3" : "mt-4")}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="m-0 text-xs font-semibold tracking-[0.04em]">{L.totalDue}</p>
            <p className="m-0 text-xl font-semibold tabular-nums">{money.format(due)}</p>
          </div>
          <p className={cn("m-0 mt-1.5 text-[11px] tracking-[0.03em]", INK_SOFT)}>
            {isYearly ? fill(L.perMonthYearly, { amount: money.format(perMonth) }) : L.billedMonthly}
          </p>
        </div>

        {showStamp && isYearly && monthsFree > 0 ? (
          <p
            className="mx-auto mt-4 w-fit border-2 border-[#2f7d1d]/50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.1em] text-[#2f7d1d]"
            style={{ transform: `rotate(${-3 + (index % 3) * 0.9}deg)` }}
          >
            {stamp}
          </p>
        ) : null}

        {plan.href ? (
          <Link href={plan.href} data-slot="plan-cta" className={buttonClass} style={buttonColor}>
            {cta}
          </Link>
        ) : (
          <button type="button" data-slot="plan-cta" onClick={onSelect} className={buttonClass} style={buttonColor}>
            {cta}
          </button>
        )}

        {showBarcode ? (
          <div className="mt-6">
            <div aria-hidden="true" className="mx-auto flex h-9 w-fit items-stretch">
              {bars(code, 46).map((w, b) => (
                <span key={b} className={b % 2 === 0 ? "bg-current" : ""} style={{ width: `${w}px` }} />
              ))}
            </div>
            <p aria-hidden="true" className={cn("m-0 mt-1.5 text-center text-[11px] tracking-[0.24em] uppercase", INK_SOFT)}>
              {code}
            </p>
          </div>
        ) : null}

        {/* The print head: a hairline riding the reveal edge, then gone. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={headStyle(phase, delay, printMs)} />
      </article>
    </div>
  )
}

function Rule({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("border-t border-dashed border-current/30", className)} />
}

const MASK_LAYERS = [
  "linear-gradient(135deg, transparent 50%, black 0)",
  "linear-gradient(-135deg, transparent 50%, black 0)",
  "linear-gradient(black, black)",
  "linear-gradient(135deg, black 50%, transparent 0)",
  "linear-gradient(-135deg, black 50%, transparent 0)",
].join(", ")
const MASK_SIZE =
  "var(--tooth-w) var(--tooth-h), var(--tooth-w) var(--tooth-h), 100% calc(100% - var(--tooth-h)), var(--tooth-w) var(--tooth-h), var(--tooth-w) var(--tooth-h)"
const MASK_POSITION = "0 0, 0 0, 0 calc(var(--tooth-h) / 2), 0 100%, 0 100%"
const MASK_REPEAT = "repeat-x, repeat-x, no-repeat, repeat-x, repeat-x"

function phaseStyle(phase: Phase, delay: number, printMs: number, tearMs: number): React.CSSProperties {
  switch (phase) {
    case "tear":
      return {
        clipPath: "inset(0 0 0 0)",
        transform: "translateY(28px) rotate(0.5deg)",
        opacity: 0,
        transition: `transform ${tearMs}ms ${EXIT} ${delay}ms, opacity ${tearMs}ms linear ${delay}ms`,
      }
    case "hidden":
      return { clipPath: "inset(0 0 100% 0)", transform: "none", opacity: 1, transition: "none" }
    case "print":
      return {
        clipPath: "inset(0 0 0 0)",
        transform: "none",
        opacity: 1,
        transition: `clip-path ${printMs}ms ${ENTER} ${delay}ms`,
      }
    default:
      return { clipPath: "inset(0 0 0 0)", transform: "none", opacity: 1 }
  }
}

function headStyle(phase: Phase, delay: number, printMs: number): React.CSSProperties {
  const bar =
    "linear-gradient(to bottom, transparent 0%, transparent 86%, color-mix(in oklab, currentColor 6%, transparent) 97%, color-mix(in oklab, currentColor 30%, transparent) 100%)"
  if (phase === "hidden") return { backgroundImage: bar, transform: "translateY(-100%)", opacity: 1, transition: "none" }
  if (phase === "print")
    return {
      backgroundImage: bar,
      transform: "translateY(0)",
      opacity: 1,
      transition: `transform ${printMs}ms ${ENTER} ${delay}ms`,
    }
  return { backgroundImage: bar, transform: "translateY(0)", opacity: 0, transition: "opacity 160ms linear" }
}

export default ReceiptPricing

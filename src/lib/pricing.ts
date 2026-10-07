/**
 * What we charge to print a design.
 *
 * Machine time alone does not cover an order. A keychain is twenty minutes on
 * the printer and still needs packing, a courier, and somebody's attention, and
 * some prints fail and get run again. So a quote is a handling fee, plus time,
 * plus material, and never less than a floor that makes the smallest order
 * worth fulfilling.
 *
 * Every rate is env-tunable so prices can move without a deploy. Amounts are
 * whole rupees throughout — money is never carried as a float here, and the
 * only rounding happens once, at the end of each component.
 */

export interface PricingConfig {
  /** Charged on every order: packing, courier, handling. */
  baseFeeInr: number
  /** Printer time. */
  hourlyRateInr: number
  /** Filament, per gram. */
  materialRateInrPerGram: number
  /** No order is quoted below this. */
  minimumInr: number
}

export const DEFAULT_PRICING: PricingConfig = {
  baseFeeInr: 149,
  hourlyRateInr: 100,
  materialRateInrPerGram: 2,
  minimumInr: 299,
}

/** Read a non-negative rupee amount from the environment. */
function amountFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

/**
 * The live pricing. Read per call rather than at import so a changed
 * environment variable takes effect on the next request.
 */
export function pricingConfig(): PricingConfig {
  return {
    baseFeeInr: amountFrom(process.env.ORDER_BASE_FEE_INR, DEFAULT_PRICING.baseFeeInr),
    hourlyRateInr: amountFrom(process.env.ORDER_HOURLY_RATE_INR, DEFAULT_PRICING.hourlyRateInr),
    materialRateInrPerGram: amountFrom(
      process.env.ORDER_MATERIAL_RATE_INR_PER_GRAM,
      DEFAULT_PRICING.materialRateInrPerGram,
    ),
    minimumInr: amountFrom(process.env.ORDER_MINIMUM_INR, DEFAULT_PRICING.minimumInr),
  }
}

export interface Quote {
  baseFeeInr: number
  timeInr: number
  materialInr: number
  /** The three components added up, before the floor is applied. */
  subtotalInr: number
  /** What the customer pays: the subtotal, or the floor if that is higher. */
  totalInr: number
  /** True when the floor set the price, so the UI can say why. */
  minimumApplied: boolean
  printMinutes: number
  filamentGrams: number
}

/** The measurements a quote is computed from. */
export interface QuoteInput {
  printMinutes: number
  filamentGrams: number
}

export function quoteForPrint(input: QuoteInput, config: PricingConfig = pricingConfig()): Quote {
  const printMinutes = Math.max(0, input.printMinutes)
  const filamentGrams = Math.max(0, input.filamentGrams)

  const timeInr = Math.round((printMinutes / 60) * config.hourlyRateInr)
  const materialInr = Math.round(filamentGrams * config.materialRateInrPerGram)
  const subtotalInr = config.baseFeeInr + timeInr + materialInr
  const totalInr = Math.max(subtotalInr, config.minimumInr)

  return {
    baseFeeInr: config.baseFeeInr,
    timeInr,
    materialInr,
    subtotalInr,
    totalInr,
    minimumApplied: totalInr > subtotalInr,
    printMinutes,
    filamentGrams,
  }
}

/** Rupees as a person reads them: ₹1,234. */
export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/** Print time as a person reads it: "2 h 10 min", "45 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(1, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest} min`
}

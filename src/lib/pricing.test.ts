import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PRICING,
  formatDuration,
  formatInr,
  pricingConfig,
  quoteForPrint,
} from './pricing'

const ENV_KEYS = [
  'ORDER_BASE_FEE_INR',
  'ORDER_HOURLY_RATE_INR',
  'ORDER_MATERIAL_RATE_INR_PER_GRAM',
  'ORDER_MINIMUM_INR',
] as const

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
})

describe('quoteForPrint', () => {
  it('adds handling, time and material', () => {
    // 1.6 h and 59 g — the measured figures for a name-sign piggy bank.
    const quote = quoteForPrint({ printMinutes: 96, filamentGrams: 59 })
    expect(quote.baseFeeInr).toBe(149)
    expect(quote.timeInr).toBe(160)
    expect(quote.materialInr).toBe(118)
    expect(quote.subtotalInr).toBe(427)
    expect(quote.totalInr).toBe(427)
    expect(quote.minimumApplied).toBe(false)
  })

  it('applies the floor to a print too small to be worth shipping', () => {
    // A keychain: 16 minutes, 5 g. Machine time alone would be ~₹26.
    const quote = quoteForPrint({ printMinutes: 16, filamentGrams: 5 })
    expect(quote.subtotalInr).toBeLessThan(DEFAULT_PRICING.minimumInr)
    expect(quote.totalInr).toBe(DEFAULT_PRICING.minimumInr)
    expect(quote.minimumApplied).toBe(true)
  })

  it('scales with a longer, heavier print', () => {
    const small = quoteForPrint({ printMinutes: 96, filamentGrams: 59 })
    const large = quoteForPrint({ printMinutes: 187, filamentGrams: 119 })
    expect(large.totalInr).toBeGreaterThan(small.totalInr)
  })

  it('never quotes below the floor, whatever the input', () => {
    for (const minutes of [0, 1, 10, 60]) {
      expect(quoteForPrint({ printMinutes: minutes, filamentGrams: 0 }).totalInr).toBeGreaterThanOrEqual(
        DEFAULT_PRICING.minimumInr,
      )
    }
  })

  it('treats negative measurements as zero rather than a discount', () => {
    const quote = quoteForPrint({ printMinutes: -500, filamentGrams: -500 })
    expect(quote.timeInr).toBe(0)
    expect(quote.materialInr).toBe(0)
    expect(quote.totalInr).toBe(DEFAULT_PRICING.minimumInr)
  })

  it('quotes whole rupees', () => {
    const quote = quoteForPrint({ printMinutes: 37.4, filamentGrams: 12.7 })
    expect(Number.isInteger(quote.timeInr)).toBe(true)
    expect(Number.isInteger(quote.materialInr)).toBe(true)
    expect(Number.isInteger(quote.totalInr)).toBe(true)
  })
})

describe('pricingConfig', () => {
  it('uses the defaults when nothing is configured', () => {
    expect(pricingConfig()).toEqual(DEFAULT_PRICING)
  })

  it('takes rates from the environment so prices move without a deploy', () => {
    process.env.ORDER_HOURLY_RATE_INR = '250'
    process.env.ORDER_MINIMUM_INR = '499'
    const config = pricingConfig()
    expect(config.hourlyRateInr).toBe(250)
    expect(config.minimumInr).toBe(499)
    expect(quoteForPrint({ printMinutes: 60, filamentGrams: 0 }, config).timeInr).toBe(250)
  })

  it('ignores a malformed rate rather than pricing at zero', () => {
    process.env.ORDER_HOURLY_RATE_INR = 'free'
    expect(pricingConfig().hourlyRateInr).toBe(DEFAULT_PRICING.hourlyRateInr)
  })

  it('allows a rate to be deliberately set to zero', () => {
    process.env.ORDER_BASE_FEE_INR = '0'
    expect(pricingConfig().baseFeeInr).toBe(0)
  })
})

describe('formatting', () => {
  it('groups rupees the Indian way', () => {
    expect(formatInr(427)).toBe('₹427')
    expect(formatInr(125000)).toBe('₹1,25,000')
  })

  it('reads durations as hours and minutes', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(130)).toBe('2 h 10 min')
    // Never "0 min" — a real print always took some time.
    expect(formatDuration(0.2)).toBe('1 min')
  })
})

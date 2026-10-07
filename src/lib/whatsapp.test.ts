import { describe, expect, it } from 'vitest'
import { quoteForPrint } from './pricing'
import { orderMessage, whatsAppUrl, WHATSAPP_NUMBER } from './whatsapp'

describe('orderMessage', () => {
  const quote = quoteForPrint({ printMinutes: 146, filamentGrams: 92 })

  it('carries the design, its link, and the quote the customer saw', () => {
    const message = orderMessage({
      designName: 'Ananya piggy bank',
      designUrl: 'https://studio.example/share/abc',
      quote,
      sizeMm: [143.2, 119, 49.4],
    })
    expect(message).toBe(
      [
        "Hey, I made this model on OpenSCAD Studio and I'd like to order it.",
        '',
        'Design: Ananya piggy bank',
        'Link: https://studio.example/share/abc',
        `Quoted estimate: ₹${quote.totalInr} (about 2 h 26 min print, 92 g, 143 × 119 × 49 mm)`,
      ].join('\n'),
    )
  })

  it('includes the order number once a draft order exists', () => {
    expect(orderMessage({ designName: 'Keychain', orderName: '#D12' })).toContain('Order: #D12')
  })

  it('still says which design when no link or quote is available', () => {
    expect(orderMessage({ designName: 'Keychain' })).toBe(
      "Hey, I made this model on OpenSCAD Studio and I'd like to order it.\n\nDesign: Keychain",
    )
  })
})

describe('whatsAppUrl', () => {
  it('prefills the message for the business number', () => {
    const url = new URL(whatsAppUrl('Hi & bye\nLink: https://x.test/share/a?b=1'))
    expect(url.origin + url.pathname).toBe(`https://wa.me/${WHATSAPP_NUMBER}`)
    expect(url.searchParams.get('text')).toBe('Hi & bye\nLink: https://x.test/share/a?b=1')
  })
})

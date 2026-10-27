import { describe, expect, it } from 'vitest'
import { describeInspection, inspectModelTool } from './inspect-model'

const facts = {
  ok: true,
  messages: ['WARNING: Object may not be a valid 2-manifold'],
  bounds: { min: [0, 0, 0], max: [40, 20, 10], size: [40, 20, 10] } as const,
  parts: [{ color: '#ff6347', triangles: 12, min: [0, 0, 0], max: [40, 20, 10] }],
  triangles: 12,
  views: ['iso' as const],
}

describe('inspectModel output', () => {
  it('gives the model the measurements, log and picture', async () => {
    const output = { ...facts, image: 'data:image/jpeg;base64,QUJD' } as never
    const result = await inspectModelTool.toModelOutput!({ toolCallId: 't', input: {}, output })
    expect(result).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: expect.stringContaining('size (40, 20, 10)') },
        { type: 'file', mediaType: 'image/jpeg', data: { type: 'data', data: 'QUJD' } },
      ],
    })
    expect(describeInspection(output)).toContain('#ff6347')
    expect(describeInspection(output)).toContain('2-manifold')
  })

  it('sends text only once the picture was dropped from history', async () => {
    const output = { ...facts, image: null } as never
    const result = await inspectModelTool.toModelOutput!({ toolCallId: 't', input: {}, output })
    expect(result).toEqual({ type: 'content', value: [{ type: 'text', text: expect.stringContaining('no longer kept') }] })
  })

  it('leads with the failure when the source does not render', () => {
    const text = describeInspection({ ok: false, error: 'Parser error in line 3', messages: [] })
    expect(text).toMatch(/^RENDER FAILED/)
    expect(text).toContain('line 3')
  })
})

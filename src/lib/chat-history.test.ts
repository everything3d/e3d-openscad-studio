import { describe, expect, it } from 'vitest'
import {
  isEmptyMessage,
  settleInterruptedInspections,
  withoutEmptyMessages,
  withoutOldInspectionImages,
} from './chat-history'

const user = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'a cube' }] }
const emptyReply = { id: 'a1', role: 'assistant', parts: [] }
const reply = { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'Done.' }] }

describe('isEmptyMessage', () => {
  it('is true only for a message whose parts is an empty array', () => {
    expect(isEmptyMessage(emptyReply)).toBe(true)
    expect(isEmptyMessage(reply)).toBe(false)
    // Malformed input is left for validation to report, not silently dropped.
    expect(isEmptyMessage({ role: 'assistant' })).toBe(false)
    expect(isEmptyMessage(null)).toBe(false)
    expect(isEmptyMessage('text')).toBe(false)
  })
})

describe('withoutEmptyMessages', () => {
  it('drops the empty reply a failed turn leaves behind', () => {
    expect(withoutEmptyMessages([user, emptyReply, user, reply])).toEqual([user, user, reply])
  })

  it('returns the same array when there is nothing to drop', () => {
    const history = [user, reply]
    expect(withoutEmptyMessages(history)).toBe(history)
  })
})

describe('inspection history', () => {
  const pending = { type: 'tool-inspectModel', toolCallId: 't1', state: 'input-available', input: {} }
  const answered = {
    type: 'tool-inspectModel',
    toolCallId: 't2',
    state: 'output-available',
    input: {},
    output: { ok: true, messages: [], image: 'data:image/jpeg;base64,AAAA' },
  }
  const turn = (id: string, parts: unknown[]) => ({ id, role: 'assistant', parts })

  it('closes an inspection the browser never answered once the conversation moved on', () => {
    const settled = settleInterruptedInspections([user, turn('a1', [pending]), user])
    expect(settled[1].parts[0]).toMatchObject({ state: 'output-error', errorText: expect.any(String) })
  })

  it('leaves the inspection the latest message is waiting on alone', () => {
    const history = [user, turn('a1', [pending])]
    expect(settleInterruptedInspections(history)).toBe(history)
  })

  it('drops pictures from earlier inspections but keeps their facts and the latest picture', () => {
    const history = [user, turn('a1', [answered]), user, turn('a2', [{ ...answered, toolCallId: 't3' }])]
    const trimmed = withoutOldInspectionImages(history)
    expect((trimmed[1].parts[0] as typeof answered).output).toEqual({ ok: true, messages: [], image: null })
    expect(trimmed[3]).toBe(history[3])
    // The caller's messages are not mutated.
    expect(answered.output.image).toMatch(/^data:/)
  })
})

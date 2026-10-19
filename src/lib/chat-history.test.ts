import { describe, expect, it } from 'vitest'
import { isEmptyMessage, withoutEmptyMessages } from './chat-history'

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

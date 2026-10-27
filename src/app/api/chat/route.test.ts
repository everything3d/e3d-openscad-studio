import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getProjectForChat: vi.fn(),
  saveChat: vi.fn(),
  guardModelCall: vi.fn(),
  createAgentUIStreamResponse: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/db/queries', () => ({
  getProjectForChat: mocks.getProjectForChat,
  saveChat: mocks.saveChat,
}))
vi.mock('@/lib/spend-guard', () => ({
  guardModelCall: mocks.guardModelCall,
  spendGuardTextResponse: vi.fn(),
}))
vi.mock('@/lib/agents/studio-agent', () => ({
  createStudioAgent: vi.fn(() => ({})),
  studioTools: {},
}))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  createAgentUIStreamResponse: mocks.createAgentUIStreamResponse,
}))

import { POST } from './route'

function request(messages: unknown[]) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'p1', messages }),
  })
}

const user = (id: string) => ({ id, role: 'user', parts: [{ type: 'text', text: 'a cube' }] })

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
    mocks.getProjectForChat.mockResolvedValue({
      id: 'p1',
      code: '',
      fileNames: [],
      canonicalVersionId: null,
      modificationGuide: null,
    })
    mocks.guardModelCall.mockResolvedValue({ allowed: true })
    mocks.createAgentUIStreamResponse.mockReturnValue(new Response('ok'))
  })

  it('drops the empty reply of an earlier failed turn instead of failing validation', async () => {
    const response = await POST(
      request([user('u1'), { id: 'a1', role: 'assistant', parts: [] }, user('u2')]),
    )
    expect(response.status).toBe(200)
    const { uiMessages } = mocks.createAgentUIStreamResponse.mock.calls[0][0]
    expect(uiMessages.map((m: { id: string }) => m.id)).toEqual(['u1', 'u2'])
  })

  it('answers an unreadable history with a readable error', async () => {
    const response = await POST(request([{ id: 'x', role: 'robot', parts: 'nope' }]))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.stringContaining('reload') })
    expect(mocks.createAgentUIStreamResponse).not.toHaveBeenCalled()
  })

  it('sends the user a fixed sentence when the model call fails', async () => {
    await POST(request([user('u1')]))
    const { onError } = mocks.createAgentUIStreamResponse.mock.calls[0][0]
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(onError(new Error('This request requires more credits'))).toMatch(/AI service/)
    spy.mockRestore()
  })

  it('saves code written while continuing a turn after an inspection', async () => {
    const write = (id: string, code: string) => ({
      type: 'tool-writeOpenscad',
      toolCallId: id,
      state: 'output-available',
      input: { code },
      output: { ok: true, lines: 1 },
    })
    // The turn arrives with the first write already in its assistant message,
    // and the reply keeps appending to that same message.
    const incoming = { id: 'a1', role: 'assistant', parts: [write('w1', 'cube(1);')] }
    await POST(request([user('u1'), incoming]))
    const { onFinish } = mocks.createAgentUIStreamResponse.mock.calls[0][0]

    await onFinish({ messages: [user('u1'), incoming] })
    expect(mocks.saveChat).toHaveBeenLastCalledWith(expect.objectContaining({ code: null }))

    const continued = { ...incoming, parts: [...incoming.parts, write('w2', 'cube(2);')] }
    await onFinish({ messages: [user('u1'), continued] })
    expect(mocks.saveChat).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'cube(2);' }))
  })
})


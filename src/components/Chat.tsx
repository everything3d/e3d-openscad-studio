import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import Markdown from './Markdown'

interface Props {
  messages: ChatMessage[]
  busy: boolean
  error: string | null
  onSend: (text: string) => void
}

export default function Chat({ messages, busy, error, onSend }: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  const submit = () => {
    const text = input.trim()
    if (!text || busy) return
    onSend(text)
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <h2>Describe what you want to build</h2>
            <p>
              The AI writes the OpenSCAD code and it renders live on the right.
              Try “a hexagonal phone stand” or “a 20&nbsp;mm gear with 12 teeth”.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div className={`msg msg-${m.role}`} key={m.id}>
            <div className="msg-role">{m.role === 'user' ? 'You' : 'AI'}</div>
            <div className="msg-body">
              <Markdown text={m.content} />
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg msg-assistant">
            <div className="msg-role">AI</div>
            <div className="msg-body">
              <span className="typing">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}
        {error && <div className="chat-error">{error}</div>}
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          placeholder="Ask the AI to build or change the model…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
        />
        <button onClick={submit} disabled={busy || !input.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

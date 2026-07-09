import { Fragment } from 'react'

/**
 * Minimal renderer: splits a message into prose and fenced code blocks.
 * Good enough for chat where the model returns short text + one scad block.
 */
export default function Markdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <div className="md">
      {parts.map((part, i) => {
        const fence = part.match(/^```(\w*)\n?([\s\S]*?)```$/)
        if (fence) {
          const lang = fence[1] || 'code'
          return (
            <pre className="md-code" key={i}>
              <div className="md-code-lang">{lang}</div>
              <code>{fence[2].replace(/\n$/, '')}</code>
            </pre>
          )
        }
        if (!part.trim()) return <Fragment key={i} />
        return (
          <p className="md-p" key={i}>
            {part.trim()}
          </p>
        )
      })}
    </div>
  )
}

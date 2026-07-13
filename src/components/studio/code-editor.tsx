'use client'

import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  syntaxHighlighting,
  HighlightStyle,
  indentOnInput,
  bracketMatching,
} from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { openscad } from '@/lib/openscad/language'

const highlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#6b7280', fontStyle: 'italic' },
  { tag: t.string, color: '#7dd3a8' },
  { tag: t.number, color: '#f0b866' },
  { tag: t.keyword, color: '#c792ea' },
  { tag: [t.standard(t.variableName)], color: '#e6e6e6' },
  { tag: t.special(t.variableName), color: '#82aaff' },
  { tag: t.operator, color: '#89ddff' },
  { tag: t.punctuation, color: '#9aa2b1' },
])

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent' },
    '.cm-scroller': {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      lineHeight: '1.6',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#4b5563',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.03)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-content': { caretColor: '#fff' },
  },
  { dark: true },
)

interface Props {
  value: string
  onChange: (value: string) => void
}

export function CodeEditor({ value, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        openscad,
        syntaxHighlighting(highlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        }),
        theme,
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external changes (e.g. the AI rewriting the code) into the editor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  return <div className="h-full overflow-hidden" ref={hostRef} />
}

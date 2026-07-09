import { useState } from 'react'
import type { Settings } from '../types'

interface Props {
  settings: Settings
  onSave: (s: Settings) => void
  onClose: () => void
}

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Settings>(settings)

  const set = (patch: Partial<Settings>) =>
    setDraft((d) => ({ ...d, ...patch }))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>AI Settings</h2>
        <p className="modal-note">
          Uses any OpenAI-compatible <code>/chat/completions</code> endpoint
          (OpenAI, Inception Labs, local servers, …). Your key is stored only in
          this browser's local storage and sent directly to the endpoint you
          configure.
        </p>

        <label>
          API base URL
          <input
            type="text"
            value={draft.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => set({ baseUrl: e.target.value })}
          />
        </label>

        <label>
          API key
          <input
            type="password"
            value={draft.apiKey}
            placeholder="sk-…"
            onChange={(e) => set({ apiKey: e.target.value })}
          />
        </label>

        <label>
          Model
          <input
            type="text"
            value={draft.model}
            placeholder="gpt-4o-mini"
            onChange={(e) => set({ model: e.target.value })}
          />
        </label>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { GOAL_LABELS, type WritingGoals } from '../engine/goals'

/**
 * Writing goals picker. Goals tune which clarity/style suggestions Pluma shows
 * (e.g. creative writing stops nagging about passive voice). Correctness is
 * never affected.
 */
export default function GoalsModal({
  goals,
  onSave,
  onClose,
}: {
  goals: WritingGoals
  onSave: (g: WritingGoals) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<WritingGoals>(goals)

  const row = <K extends keyof WritingGoals>(key: K, title: string, hint: string) => (
    <div className="goal-row">
      <div className="goal-head">
        <span className="goal-title">{title}</span>
        <span className="goal-hint">{hint}</span>
      </div>
      <div className="goal-opts">
        {Object.entries(GOAL_LABELS[key]).map(([value, label]) => (
          <button
            key={value}
            className={`goal-chip${draft[key] === value ? ' on' : ''}`}
            onClick={() => setDraft((d) => ({ ...d, [key]: value as WritingGoals[K] }))}
          >
            {label as string}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h2>Writing goals</h2>
          <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="sub">
          Tell Pluma who you're writing for. This tunes the clarity and style
          suggestions — your grammar and spelling checks never change.
        </p>

        {row('audience', 'Audience', 'How much the reader already knows')}
        {row('formality', 'Formality', 'How buttoned-up the tone should be')}
        {row('domain', 'Domain', 'What kind of writing this is')}
        {row('intent', 'Intent', 'What you want the writing to do')}

        <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
          <button className="btn btn--quiet" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={() => { onSave(draft); onClose() }}>
            Save goals
          </button>
        </div>
      </div>
    </div>
  )
}

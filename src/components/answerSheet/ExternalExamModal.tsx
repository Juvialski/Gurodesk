import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { createExternalExamBlueprint } from '../../lib/answerSheet/externalExamAdapter'
import type { AssessmentBlueprint } from '../../types/assessment'
import { useApp } from '../../contexts/AppContext'

export type ExternalExamModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (blueprint: AssessmentBlueprint) => Promise<void> | void
}

export function ExternalExamModal({ isOpen, onClose, onSave }: ExternalExamModalProps) {
  const { user, assignments } = useApp()
  const [assignmentId, setAssignmentId] = useState<string>('')
  const [title, setTitle] = useState('Quarterly Examination (External)')
  const [gradeLevel, setGradeLevel] = useState('9')
  const [learningArea, setLearningArea] = useState('Science')
  const [totalItems, setTotalItems] = useState(30)
  const [choicesPerItem, setChoicesPerItem] = useState(4)
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false'>('multiple_choice')
  const [keyMap, setKeyMap] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {}
    for (let i = 1; i <= 30; i++) {
      initial[i] = 'A'
    }
    return initial
  })
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  function handleAssignmentChange(id: string) {
    setAssignmentId(id)
    const selected = assignments.find((a) => a.id === id)
    if (selected) {
      if (selected.gradeLevel) setGradeLevel(selected.gradeLevel)
      if (selected.learningArea) setLearningArea(selected.learningArea)
    }
  }

  function handleTotalItemsChange(count: number) {
    const validCount = Math.max(5, Math.min(100, count))
    setTotalItems(validCount)
    setKeyMap((prev) => {
      const next: Record<number, string> = { ...prev }
      for (let i = 1; i <= validCount; i++) {
        if (!next[i]) next[i] = questionType === 'true_false' ? 'T' : 'A'
      }
      return next
    })
  }

  function handleSelectKey(itemNum: number, choice: string) {
    setKeyMap((prev) => ({ ...prev, [itemNum]: choice }))
  }

  function handleFillAll(choice: string) {
    const next: Record<number, string> = {}
    for (let i = 1; i <= totalItems; i++) {
      next[i] = choice
    }
    setKeyMap(next)
  }

  async function handleCreateBlueprint() {
    setSaving(true)
    try {
      const blueprint = createExternalExamBlueprint({
        userId: user?.id || 'demo-user',
        assignmentId: assignmentId || null,
        title,
        gradeLevel,
        learningArea,
        totalItems,
        choicesPerItem,
        keyMap,
        defaultQuestionType: questionType,
      })

      await onSave(blueprint)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, choicesPerItem)

  return (
    <div className="modal-backdrop external-exam-backdrop" role="dialog" aria-modal="true" aria-labelledby="ext-modal-title">
      <div className="modal-content external-exam-modal panel">
        {/* Modal Header */}
        <div className="external-exam-header">
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800, color: 'var(--primary)' }}>
              External Exam / Answer Sheet Only
            </span>
            <h2 id="ext-modal-title">
              Quick Answer Key Builder
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Setup & Matrix */}
        <div className="external-exam-body">
          {/* Class Assignment & Metadata inputs */}
          <div className="external-exam-form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' }}>
                Exam / Assessment Title
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Grade 10 Math Periodic Test"
              />
            </div>

            {assignments.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' }}>
                  Assign to Class / Teaching Assignment (Optional)
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={assignmentId}
                  onChange={(e) => handleAssignmentChange(e.target.value)}
                >
                  <option value="">-- Standalone Assessment (No Class Roster) --</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Grade {a.gradeLevel} - {a.learningArea} ({a.sections.join(', ')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' }}>
                Grade Level
              </label>
              <select
                className="input"
                style={{ width: '100%' }}
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' }}>
                Learning Area
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={learningArea}
                onChange={(e) => setLearningArea(e.target.value)}
                placeholder="e.g. Science, Mathematics"
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' }}>
                Question Type
              </label>
              <select
                className="input"
                style={{ width: '100%' }}
                value={questionType}
                onChange={(e) => {
                  const val = e.target.value as 'multiple_choice' | 'true_false'
                  setQuestionType(val)
                  handleFillAll(val === 'true_false' ? 'T' : 'A')
                }}
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
              </select>
            </div>
          </div>

          {/* Quick presets bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'var(--surface-muted)', border: '1px solid var(--border)', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: 'var(--foreground-muted)' }}>Number of Items:</span>
              {[20, 30, 40, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`button compact ${totalItems === preset ? 'primary' : 'ghost'}`}
                  style={{ minHeight: '28px', padding: '0 10px', fontSize: '11.5px' }}
                  onClick={() => handleTotalItemsChange(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            {questionType === 'multiple_choice' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--foreground-muted)' }}>Choices:</span>
                {[4, 5].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`button compact ${choicesPerItem === c ? 'primary' : 'ghost'}`}
                    style={{ minHeight: '28px', padding: '0 8px', fontSize: '11.5px' }}
                    onClick={() => setChoicesPerItem(c)}
                  >
                    A–{String.fromCharCode(64 + c)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Answer Key Grid */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--foreground)' }}>
                Answer Key Matrix ({totalItems} items)
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Quick fill:</span>
                {questionType === 'multiple_choice' ? (
                  letters.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className="button ghost compact"
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => handleFillAll(l)}
                    >
                      All {l}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      type="button"
                      className="button ghost compact"
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => handleFillAll('T')}
                    >
                      All True
                    </button>
                    <button
                      type="button"
                      className="button ghost compact"
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => handleFillAll('F')}
                    >
                      All False
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="external-exam-key-matrix">
              {Array.from({ length: totalItems }, (_, idx) => idx + 1).map((itemNum) => {
                const currentKey = keyMap[itemNum] || (questionType === 'true_false' ? 'T' : 'A')

                return (
                  <div key={itemNum} className="external-exam-key-cell">
                    <strong>#{itemNum}</strong>
                    <div className="external-exam-key-buttons">
                      {questionType === 'multiple_choice'
                        ? letters.map((letter) => (
                            <button
                              key={letter}
                              type="button"
                              className={`external-exam-key-btn ${currentKey === letter ? 'active' : ''}`}
                              onClick={() => handleSelectKey(itemNum, letter)}
                            >
                              {letter}
                            </button>
                          ))
                        : ['T', 'F'].map((tf) => (
                            <button
                              key={tf}
                              type="button"
                              className={`external-exam-key-btn ${currentKey === tf ? 'active' : ''}`}
                              style={{ width: '32px' }}
                              onClick={() => handleSelectKey(itemNum, tf)}
                            >
                              {tf}
                            </button>
                          ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="external-exam-footer">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            disabled={saving}
            onClick={() => void handleCreateBlueprint()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={16} />
            <span>{saving ? 'Creating…' : 'Generate Smart Answer Sheet'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

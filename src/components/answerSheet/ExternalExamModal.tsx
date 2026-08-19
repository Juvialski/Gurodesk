import { Check, FileText, Plus, Sparkles, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createExternalExamBlueprint } from '../../lib/answerSheet/externalExamAdapter'
import type { AssessmentBlueprint } from '../../types/assessment'
import { useApp } from '../../contexts/AppContext'

export type ExternalExamModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (blueprint: AssessmentBlueprint) => Promise<void> | void
}

export function ExternalExamModal({ isOpen, onClose, onSave }: ExternalExamModalProps) {
  const { user } = useApp()
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
      <div className="modal-content external-exam-modal panel max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-primary">External Exam / Answer Sheet Only</span>
            <h2 id="ext-modal-title" className="text-lg font-bold text-foreground">
              Quick Answer Key Builder
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Setup & Matrix */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Metadata inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-foreground block mb-1">Exam / Assessment Title</label>
              <input
                type="text"
                className="w-full text-sm py-1.5 px-3 rounded border border-border bg-surface text-foreground"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Grade 10 Math Periodic Test"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Grade Level</label>
              <select
                className="w-full text-sm py-1.5 px-3 rounded border border-border bg-surface text-foreground"
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
              <label className="text-xs font-medium text-foreground block mb-1">Learning Area</label>
              <input
                type="text"
                className="w-full text-sm py-1.5 px-3 rounded border border-border bg-surface text-foreground"
                value={learningArea}
                onChange={(e) => setLearningArea(e.target.value)}
                placeholder="e.g. Science, Mathematics"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Question Type</label>
              <select
                className="w-full text-sm py-1.5 px-3 rounded border border-border bg-surface text-foreground"
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
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-surface-muted border border-border text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground-muted">Number of Items:</span>
              {[20, 30, 40, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`px-2.5 py-1 rounded font-semibold border ${
                    totalItems === preset
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-surface hover:bg-surface-muted text-foreground border-border'
                  }`}
                  onClick={() => handleTotalItemsChange(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            {questionType === 'multiple_choice' && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground-muted">Choices:</span>
                {[4, 5].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`px-2 py-1 rounded font-semibold border ${
                      choicesPerItem === c
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-surface hover:bg-surface-muted text-foreground border-border'
                    }`}
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
            <div className="flex items-center justify-between mb-2">
              <strong className="text-sm font-semibold text-foreground">Answer Key Matrix ({totalItems} items)</strong>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-foreground-muted mr-1">Quick fill:</span>
                {questionType === 'multiple_choice' ? (
                  letters.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className="button ghost compact px-2 py-0.5"
                      onClick={() => handleFillAll(l)}
                    >
                      All {l}
                    </button>
                  ))
                ) : (
                  <>
                    <button type="button" className="button ghost compact px-2 py-0.5" onClick={() => handleFillAll('T')}>
                      All True
                    </button>
                    <button type="button" className="button ghost compact px-2 py-0.5" onClick={() => handleFillAll('F')}>
                      All False
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-2 border border-border rounded-lg bg-surface">
              {Array.from({ length: totalItems }, (_, idx) => idx + 1).map((itemNum) => {
                const currentKey = keyMap[itemNum] || (questionType === 'true_false' ? 'T' : 'A')

                return (
                  <div
                    key={itemNum}
                    className="flex items-center justify-between p-1.5 rounded border border-border/60 bg-surface-muted text-xs"
                  >
                    <span className="font-bold text-foreground w-7">#{itemNum}</span>
                    <div className="flex items-center gap-1">
                      {questionType === 'multiple_choice'
                        ? letters.map((letter) => (
                            <button
                              key={letter}
                              type="button"
                              className={`w-6 h-6 rounded-full font-bold transition-colors flex items-center justify-center border text-[11px] ${
                                currentKey === letter
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-surface hover:bg-surface-muted text-foreground border-border'
                              }`}
                              onClick={() => handleSelectKey(itemNum, letter)}
                            >
                              {letter}
                            </button>
                          ))
                        : ['T', 'F'].map((tf) => (
                            <button
                              key={tf}
                              type="button"
                              className={`px-2 h-6 rounded-full font-bold transition-colors flex items-center justify-center border text-[11px] ${
                                currentKey === tf
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-surface hover:bg-surface-muted text-foreground border-border'
                              }`}
                              onClick={() => handleSelectKey(itemNum, tf)}
                            >
                              {tf === 'T' ? 'True' : 'False'}
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
        <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary flex items-center gap-1.5"
            disabled={saving}
            onClick={() => void handleCreateBlueprint()}
          >
            <Check size={16} />
            <span>{saving ? 'Creating…' : 'Generate Smart Answer Sheet'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

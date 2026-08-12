import { Check, CircleAlert, Clock3, ImageOff } from 'lucide-react'
import type { AssessmentItem, AssessmentNumberingMode } from '../../types/assessment'
import { assessmentItemNumberLabel } from '../../lib/assessmentGenerationV2'
import { assessmentItemNeedsAttention, assessmentItemStatus, assessmentItemStatusTone, assessmentVisualStatusLabel, isLocked, pointsForItem, typeLabel } from '../../pages/assessmentUi'

function visualLabel(item: AssessmentItem): string | null {
  const requirement = item.visualRequirement ?? 'none'
  if (requirement === 'none' && !item.visual) return null
  return assessmentVisualStatusLabel(item.visualStatus, requirement)
}

function itemLabel(item: AssessmentItem): string {
  if (assessmentItemNeedsAttention(item) && item.visualRequirement === 'required' && !item.visual) return 'Needs diagram'
  return assessmentItemStatus(item)
}

function StatusIcon({ item }: { item: AssessmentItem }) {
  const label = itemLabel(item)
  if (label === 'Ready' || isLocked(item)) return <Check size={15} aria-hidden="true" />
  if (label === 'Missing') return <Clock3 size={15} aria-hidden="true" />
  return <CircleAlert size={15} aria-hidden="true" />
}

export function AssessmentQuestionOutline({
  items,
  selectedIndex,
  onSelect,
  numberingMode = 'legacy_items',
}: {
  items: AssessmentItem[]
  selectedIndex: number
  onSelect: (index: number) => void
  numberingMode?: AssessmentNumberingMode
}) {
  return <nav className="assessment-simple-outline" data-testid="assessment-simple-outline" aria-label="Questions in this test">
    <div className="assessment-simple-outline-heading">
      <div><small>Questions</small><strong>Review each question</strong></div>
      <span>{items.length} total</span>
    </div>
    <ol>
      {items.map((item, index) => {
        const status = itemLabel(item)
        const visual = visualLabel(item)
        const tone = status === 'Needs diagram' ? 'attention' : assessmentItemStatusTone(item.qaState ?? item.authorshipState)
        return <li key={item.id}>
          <button type="button" className={`assessment-simple-outline-item ${selectedIndex === index ? 'selected' : ''} tone-${tone}`} aria-current={selectedIndex === index ? 'step' : undefined} onClick={() => onSelect(index)}>
            <span className="assessment-simple-outline-number">{assessmentItemNumberLabel(item, numberingMode)}</span>
            <span className="assessment-simple-outline-copy"><strong>{typeLabel(item.questionType)}</strong><small>{pointsForItem(item)} {pointsForItem(item) === 1 ? 'point' : 'points'} · {status}</small>{visual && <small className="assessment-simple-outline-visual">{visual === 'Ready · diagram skipped' ? <ImageOff size={12} aria-hidden="true" /> : null}{visual}</small>}</span>
            <span className="assessment-simple-outline-status" aria-label={status}><StatusIcon item={item} /></span>
          </button>
        </li>
      })}
    </ol>
  </nav>
}

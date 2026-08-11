import { ArrowLeft, BookOpenCheck, ClipboardCheck, ListChecks, RefreshCcw, TableProperties } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { ActionCard } from '../components/ui/ActionCard'
import { StatusSummary } from '../components/ui/StatusSummary'
import { useApp } from '../contexts/AppContext'
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection'

export function CreateHubPage() {
  const { assignments, user } = useApp()
  const { selection } = useWorkspaceSelection(user?.id)
  const selectedAssignment = assignments.find((assignment) => assignment.id === selection.assignmentId && assignment.isActive) ?? null
  const assignmentQuery = selectedAssignment ? `?assignment=${encodeURIComponent(selectedAssignment.id)}` : ''

  return (
    <div className="create-hub">
      <PageHeader
        eyebrow="Create"
        title="What do you want to create?"
        description="Choose a starting point. Your saved class context can prefill the workflow, while every curriculum and competency choice stays explicit."
        actions={<Link className="button ghost" to="/"><ArrowLeft size={16} /> Home</Link>}
      />

      <StatusSummary
        tone={selectedAssignment ? 'info' : 'neutral'}
        icon={selectedAssignment ? <BookOpenCheck size={17} /> : <RefreshCcw size={17} />}
        label={selectedAssignment ? `${selectedAssignment.gradeLevel} ${selectedAssignment.learningArea} selected` : 'No class context selected'}
        detail={selectedAssignment ? 'Review the context bar before saving.' : 'You can choose a class context above, or inside a workflow.'}
      />

      <section className="create-hub-grid" aria-label="Creation tasks">
        <ActionCard
          to={`/lesson-plans/new${assignmentQuery}`}
          title="Lesson Plan"
          description="Prepare an ILAW lesson plan from a competency you choose."
          actionLabel="Start"
          icon={BookOpenCheck}
          tone="blue"
        />
        <ActionCard
          to={`/tos/new${assignmentQuery}`}
          title="TOS"
          description="Table of Specifications: select covered competencies and plan your test."
          actionLabel="Start"
          icon={TableProperties}
          tone="green"
        />
        <ActionCard
          to="/assessments/new"
          title="Test / Quiz"
          description="Create a teacher-reviewed test from a finalized TOS."
          actionLabel="Start"
          icon={ClipboardCheck}
          tone="amber"
        />
        <ActionCard
          to="/results"
          title="Remediation Plan"
          description="Choose a completed result before planning follow-up support."
          actionLabel="Choose results"
          icon={ListChecks}
          tone="slate"
        />
      </section>

      <section className="create-hub-note panel">
        <div><strong>AI assistance is optional</strong><p>Non-AI workspace tools remain available. If you use AI-assisted drafts, they stay editable and require teacher review before use.</p></div>
        <Link className="button secondary" to="/settings#ai-assistance">AI assistance settings</Link>
      </section>
    </div>
  )
}

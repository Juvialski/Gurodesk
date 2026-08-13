import {
  BookMarked,
  BookOpenCheck,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  Files,
  Settings,
  TableProperties,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { ActionCard } from '../components/ui/ActionCard'

export function HelpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Help & workflow guide"
        description="Open the part of GuroDesk you need and follow the teacher workflow from setup through planning, assessment, results, and follow-up."
      />

      <section className="create-hub-grid" aria-label="GuroDesk workflow help">
        <ActionCard
          to="/classes"
          title="Classes"
          description="Set your grade, learning area, sections, school year, and curriculum source."
          actionLabel="Open Classes"
          icon={UsersRound}
          tone="blue"
        />
        <ActionCard
          to="/curriculum"
          title="Curriculum"
          description="Browse verified curriculum records attached to your classes or manage school curriculum."
          actionLabel="Open Curriculum"
          icon={BookMarked}
          tone="green"
        />
        <ActionCard
          to="/lesson-plans"
          title="Lesson Plans"
          description="Start with a lesson topic, then add verified curriculum alignment when it fits the lesson."
          actionLabel="Open Lesson Plans"
          icon={BookOpenCheck}
          tone="blue"
        />
        <ActionCard
          to="/tos"
          title="Templates & TOS"
          description="Choose covered competencies, set assessment size, review allocation, and finalize the TOS."
          actionLabel="Open TOS"
          icon={TableProperties}
          tone="green"
        />
        <ActionCard
          to="/assessments"
          title="Assessments"
          description="Create from a finalized TOS, review every generated question, and finalize only when ready."
          actionLabel="Open Assessments"
          icon={ClipboardCheck}
          tone="amber"
        />
        <ActionCard
          to="/results"
          title="Results & remediation"
          description="Enter learner outcomes, review analysis, and record teacher-reviewed follow-up plans."
          actionLabel="Open Results"
          icon={ChartNoAxesColumnIncreasing}
          tone="slate"
        />
        <ActionCard
          to="/files"
          title="Documents"
          description="Find saved lesson plans, TOS documents, assessments, result sets, and export links."
          actionLabel="Open Documents"
          icon={Files}
          tone="slate"
        />
        <ActionCard
          to="/settings"
          title="Settings"
          description="Update teacher details, planning defaults, document templates, exports, and optional AI assistance."
          actionLabel="Open Settings"
          icon={Settings}
          tone="blue"
        />
      </section>

      <section className="create-hub-note panel">
        <div>
          <strong>A simple workflow that works for most teachers</strong>
          <p>Set up Classes → check Curriculum → prepare a Lesson Plan or TOS → create an Assessment → enter Results → review Analysis and Remediation as needed.</p>
        </div>
        <Link className="button secondary" to="/create">Choose a task</Link>
      </section>

      <section className="create-hub-note panel">
        <div>
          <strong>AI assistance is optional</strong>
          <p>GuroDesk keeps non-AI workflows available. When you use Gemini assistance, review and edit suggestions before using them in teaching documents.</p>
        </div>
        <Link className="button secondary" to="/settings#ai-assistance">AI assistance settings</Link>
      </section>
    </>
  )
}

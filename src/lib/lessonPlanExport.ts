import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { jsPDF } from 'jspdf'
import type { Profile } from '../types/app'
import type { LessonPlanRecord } from '../types/lessonPlan'
import type { TeacherLessonPreferences } from '../types/teachingSetup'
import type {
  ExportPaperSize,
  LessonPlanExportModel,
  LessonPlanMultiSessionLabels,
  LessonPlanMultiSessionExportModel,
  MultiSessionGridRow,
  SelfCheckRubricItem,
  TeacherExportPreferences,
  ExportTemplateId,
} from '../types/export'
import { validateLessonPlan } from './lessonPlanValidation'

const TEXT = '000000'
const MUTED = '444444'
const BORDER = '777777'
const HEADER_BG = 'F1F5F9'

function clean(value: string | null | undefined) {
  return (value ?? '').trim()
}

function display(value: string | null | undefined, fallback = 'Not specified') {
  return clean(value) || fallback
}

function formatDate(value: string, language: 'english' | 'filipino') {
  if (!value) return 'Not specified'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(language === 'filipino' ? 'fil-PH' : 'en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
}

const ENGLISH_LABELS = {
  republic: 'Republic of the Philippines',
  department: 'Department of Education',
  documentTitle: 'ILAW LESSON PLAN',
  teacher: 'Teacher',
  gradeSection: 'Grade Level / Section',
  learningArea: 'Learning Area',
  lessonTitle: 'Lesson Title',
  date: 'Date',
  weekSchedule: 'Week / Schedule',
  schoolYear: 'School Year',
  gradingTerm: 'Grading Term',
  curriculumPeriod: 'Curriculum Period',
  sessionsDuration: 'Sessions / Duration',
  references: 'References',
  intentions: 'INTENTIONS',
  learningExperience: 'LEARNING EXPERIENCE',
  assessingLearning: 'ASSESSING LEARNING',
  waysForward: 'WAYS FORWARD',
  signatures: 'SIGNATURES',
  preparedBy: 'Prepared by',
  reviewedBy: 'Reviewed by',
  notedBy: 'Noted by',
  sessionUnit: 'session(s)',
  draftCopy: 'DRAFT COPY',
  archivedCopy: 'ARCHIVED COPY',
} as const

const FILIPINO_LABELS = {
  republic: 'Republika ng Pilipinas',
  department: 'Kagawaran ng Edukasyon',
  documentTitle: 'ILAW BANGHAY-ARALIN',
  teacher: 'Guro',
  gradeSection: 'Baitang / Seksyon',
  learningArea: 'Larangan ng Pagkatuto',
  lessonTitle: 'Pamagat ng Aralin',
  date: 'Petsa',
  weekSchedule: 'Linggo / Iskedyul',
  schoolYear: 'Taong Panuruan',
  gradingTerm: 'Termino ng Pagmamarka',
  curriculumPeriod: 'Panahon sa Kurikulum',
  sessionsDuration: 'Mga Sesyon / Tagal',
  references: 'Mga Sanggunian',
  intentions: 'MGA LAYUNIN',
  learningExperience: 'KARANASAN SA PAGKATUTO',
  assessingLearning: 'PAGTATAYA SA PAGKATUTO',
  waysForward: 'MGA SUSUNOD NA HAKBANG',
  signatures: 'MGA LAGDA',
  preparedBy: 'Inihanda ni',
  reviewedBy: 'Sinuri ni',
  notedBy: 'Pinagtibay ni',
  sessionUnit: 'sesyon',
  draftCopy: 'BORADOR',
  archivedCopy: 'NAKA-ARCHIVE NA KOPYA',
} as const

const ENGLISH_FIELD_LABELS = {
  lessonFocus: 'Lesson Topic / Focus',
  competencyStandards: 'Learning Competency and Curriculum Standards',
  learningObjectives: 'Learning Objectives',
  learnerContext: 'Learner Context',
  teachingApproaches: 'Teaching Approaches',
  preLesson: 'Pre-Lesson',
  lessonFlow: 'Lesson Flow',
  resources: 'Learning Resources',
  contextualization: 'Opportunities for Integration and Contextualization',
  inclusion: 'Inclusion and Accommodations',
  homeAlternative: 'Learning Continuity / Home-Based Alternative',
  formative: 'Formative Assessment',
  evidence: 'Evidence of Learning',
  extended: 'Extended Learning Opportunities',
  nextSteps: 'Next Steps / Intervention',
  reflection: 'Reflection',
  performanceStandard: 'Performance Standard',
  contentStandard: 'Content Standard',
  primaryCompetency: 'Primary competency',
  additionalCompetency: 'Additional competency',
  noCurriculumAlignment: 'No verified curriculum competency attached',
  lessonPurpose: 'Lesson purpose',
  alignmentNote: 'Alignment note',
} as const

const FILIPINO_FIELD_LABELS = {
  lessonFocus: 'Paksa / Pokus ng Aralin',
  competencyStandards: 'Kasanayang Pampagkatuto at mga Pamantayan sa Kurikulum',
  learningObjectives: 'Mga Layunin sa Pagkatuto',
  learnerContext: 'Konteksto ng mga Mag-aaral',
  teachingApproaches: 'Mga Pamamaraan sa Pagtuturo',
  preLesson: 'Bago ang Aralin',
  lessonFlow: 'Daloy ng Aralin',
  resources: 'Mga Kagamitang Panturo',
  contextualization: 'Mga Pagkakataon para sa Integrasyon at Kontekstuwalisasyon',
  inclusion: 'Inklusyon at mga Angkop na Suporta',
  homeAlternative: 'Pagpapatuloy ng Pagkatuto / Alternatibong Gawaing Pantahanan',
  formative: 'Pormatibong Pagtataya',
  evidence: 'Katibayan ng Pagkatuto',
  extended: 'Karagdagang Pagkakataon sa Pagkatuto',
  nextSteps: 'Mga Susunod na Hakbang / Interbensyon',
  reflection: 'Pagninilay',
  performanceStandard: 'Pamantayan sa Pagganap',
  contentStandard: 'Pamantayang Pangnilalaman',
  primaryCompetency: 'Pangunahing kasanayan',
  additionalCompetency: 'Karagdagang kasanayan',
  noCurriculumAlignment: 'Walang kalakip na beripikadong kasanayan sa kurikulum',
  lessonPurpose: 'Layunin ng aralin',
  alignmentNote: 'Tala sa pagkakahanay',
} as const

const ENGLISH_MULTI_LABELS: LessonPlanMultiSessionLabels = {
  lessonName: 'Name of Lesson',
  learningArea: 'Learning Area',
  termWeek: 'Term / Week',
  gradeSection: 'Grade Level & Section',
  teacher: 'Teacher',
  sessionsDuration: 'No. of Sessions / Duration',
  references: 'References',
  officialReferences: 'Official / curriculum references',
  otherSources: 'Other learning sources',
  lowTechAlternatives: 'Low-tech alternatives',
  aiDeclaration: 'Declaration of AI use',
  matrixHeading: 'DAILY LESSON LOG · FOUR-SESSION PEDAGOGICAL MATRIX',
  dimensionsGuide: 'Dimensions & Guide Questions',
  rubricHeading: 'RUBRIC FOR LESSON PLANNING SELF-CHECK AND/OR PEER COACHING',
  rubricCriterion: 'I can say that in my lesson plan...',
  yes: 'Yes',
  notYet: 'Not Yet',
  improvement: 'Why? / What will make it better?',
  coachingHeading: 'NOTES FOR INSTRUCTIONAL COACHING SESSION',
  coachingPlaceholder: 'Observations / Next Coaching Steps:',
  footer: 'Prepared with GuroDesk · Teacher-Authored Daily Lesson Log',
  noEntry: '—',
}

const FILIPINO_MULTI_LABELS: LessonPlanMultiSessionLabels = {
  lessonName: 'Pangalan ng Aralin',
  learningArea: 'Larangan ng Pagkatuto',
  termWeek: 'Termino / Linggo',
  gradeSection: 'Baitang / Seksyon',
  teacher: 'Guro',
  sessionsDuration: 'Bilang ng Sesyon / Tagal',
  references: 'Mga Sanggunian',
  officialReferences: 'Opisyal / sanggunian sa kurikulum',
  otherSources: 'Iba pang sanggunian sa pagkatuto',
  lowTechAlternatives: 'Mga alternatibong gamit na mababa ang teknolohiya',
  aiDeclaration: 'Deklarasyon sa Paggamit ng AI',
  matrixHeading: 'TALAARAWANG TALA NG ARALIN · APAT-SESYONG TALAHANAYAN NG PAGKATUTO',
  dimensionsGuide: 'Mga Dimensyon at Gabay na Tanong',
  rubricHeading: 'RUBRIK PARA SA SARILING PAGSUSURI AT/O PAGGABAY NG KASAMAHANG GURO',
  rubricCriterion: 'Masasabi ko na sa aking banghay-aralin...',
  yes: 'Oo',
  notYet: 'Hindi pa',
  improvement: 'Bakit? / Ano ang magpapahusay dito?',
  coachingHeading: 'MGA TALA PARA SA SESYON NG PAGGABAY SA PAGTUTURO',
  coachingPlaceholder: 'Mga Obserbasyon / Susunod na Hakbang:',
  footer: 'Inihanda gamit ang GuroDesk · Talaan ng Araling Isinulat ng Guro',
  noEntry: '—',
}

function looksFilipino(text: string) {
  const normalized = ` ${text.toLowerCase().replace(/[^a-záéíóúñ\s-]/g, ' ')} `
  const markers = [' ang ', ' mga ', ' ng ', ' sa ', ' ay ', ' upang ', ' mag-aaral', ' aralin', ' gawain', ' pagkatuto', ' natutukoy', ' naipapaliwanag', ' nakagagawa']
  return markers.reduce((score, marker) => score + (normalized.includes(marker) ? 1 : 0), 0) >= 3
}

function resolveExportLanguage(
  plan: LessonPlanRecord,
  preferences: TeacherExportPreferences,
  lessonPreferences?: TeacherLessonPreferences | null,
): 'english' | 'filipino' {
  if (preferences.documentLanguage === 'filipino') return 'filipino'
  if (preferences.documentLanguage === 'english') return 'english'
  if (plan.content.lessonLanguage === 'Filipino') return 'filipino'
  if (plan.content.lessonLanguage === 'English') return 'english'

  const lessonText = [
    plan.content.learningArea,
    plan.content.lessonFocus,
    plan.content.lessonTitle,
    plan.content.intentions.learningObjectives,
    plan.content.learningExperience.preLessonActivity,
    plan.content.learningExperience.lessonFlow,
    plan.content.assessingLearning.formativeAssessments,
    plan.content.waysForward.nextSteps,
  ].filter(Boolean).join('\n')

  if (plan.content.learningArea.toLowerCase().includes('filipino')) return 'filipino'
  if (looksFilipino(lessonText)) return 'filipino'
  if (lessonPreferences?.languagePreference === 'Filipino') return 'filipino'
  return 'english'
}

function dedupeStandards(items: (string | undefined | null)[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of items) {
    const text = clean(raw)
    if (!text) continue
    const key = text.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

function competencyAndStandards(plan: LessonPlanRecord, language: 'english' | 'filipino') {
  const isFilipino = language === 'filipino'
  const labels = isFilipino ? FILIPINO_FIELD_LABELS : ENGLISH_FIELD_LABELS
  const competency = plan.content.competency
  const alignments = plan.content.curriculumAlignments?.length
    ? plan.content.curriculumAlignments
    : clean(competency.text) ? [competency] : []
  const primaryId = plan.content.primaryCompetencyId || competency.id || null

  const primaryAlignment = alignments.find((a, idx) => a.id === primaryId || (!primaryId && idx === 0))
  const supportingAlignments = alignments.filter((a) => a !== primaryAlignment && clean(a.text))

  const sections: string[] = []

  // 1. Primary Learning Competency
  if (primaryAlignment && clean(primaryAlignment.text)) {
    const code = clean(primaryAlignment.code)
    const text = clean(primaryAlignment.text)
    const formatted = code ? `${code}: ${text}` : text
    const heading = isFilipino ? 'Pangunahing Kasanayang Pampagkatuto' : 'Primary Learning Competency'
    sections.push(`### ${heading}\n${formatted}`)
  }

  // 2. Supporting Learning Competencies
  if (supportingAlignments.length > 0) {
    const heading = isFilipino ? 'Mga Pansuportang Kasanayang Pampagkatuto' : 'Supporting Learning Competencies'
    const items = supportingAlignments.map((a) => {
      const code = clean(a.code)
      const text = clean(a.text)
      return code ? `• ${code}: ${text}` : `• ${text}`
    })
    sections.push(`### ${heading}\n${items.join('\n')}`)
  }

  // Fallback if no competencies attached
  if (!primaryAlignment && supportingAlignments.length === 0) {
    const purpose = plan.content.alignmentPurpose && plan.content.alignmentPurpose !== 'regular'
      ? plan.content.alignmentPurpose.replaceAll('_', ' ')
      : ''
    const fallback = purpose
      ? `${labels.noCurriculumAlignment}. ${labels.lessonPurpose}: ${purpose}.`
      : `${labels.noCurriculumAlignment}.`
    const note = clean(plan.content.alignmentNote) ? `\n${labels.alignmentNote}: ${clean(plan.content.alignmentNote)}` : ''
    sections.push(`${fallback}${note}`)
  }

  // 3. Content Standards
  const rawContentStandards = alignments.flatMap((alignment) => alignment.contentStandards ?? [])
  const contentStandards = dedupeStandards(rawContentStandards)
  if (contentStandards.length > 0) {
    const heading = isFilipino ? 'Mga Pamantayang Pangnilalaman' : 'Content Standards'
    const items = contentStandards.map((std) => `• ${std}`)
    sections.push(`### ${heading}\n${items.join('\n')}`)
  }

  // 4. Performance Standards
  const rawPerformanceStandards = [
    ...alignments.flatMap((alignment) => alignment.performanceStandards ?? []),
    plan.content.performanceStandard,
  ]
  const performanceStandards = dedupeStandards(rawPerformanceStandards)
  if (performanceStandards.length > 0) {
    const heading = isFilipino ? 'Mga Pamantayan sa Pagganap' : 'Performance Standards'
    const items = performanceStandards.map((std) => `• ${std}`)
    sections.push(`### ${heading}\n${items.join('\n')}`)
  }

  return sections.join('\n\n')
}

function splitIntoFourSessions(rawText: string): string[] {
  const text = clean(rawText)
  if (!text) return ['', '', '', '']

  // Check for explicit session markers like "Session 1:", "Day 1:", "Sesyon 1:", "Unang Sesyon:"
  const sessionPattern = /(?:^|\n)(?:Session|Day|Sesyon)\s*([1-4])[:.\-\s]|(?:^|\n)(?:Unang|Ikalawang|Ikatlong|Ikaapat na)\s+Sesyon[:.\-\s]/gi
  const matches = [...text.matchAll(sessionPattern)]
  if (matches.length >= 1) {
    const slots = ['', '', '', '']
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      let sessionIndex = -1
      const numMatch = match[0].match(/([1-4])/)
      if (numMatch) {
        sessionIndex = parseInt(numMatch[1], 10) - 1
      } else if (/unang/i.test(match[0])) {
        sessionIndex = 0
      } else if (/ikalawang/i.test(match[0])) {
        sessionIndex = 1
      } else if (/ikatlong/i.test(match[0])) {
        sessionIndex = 2
      } else if (/ikaapat/i.test(match[0])) {
        sessionIndex = 3
      }
      if (sessionIndex >= 0 && sessionIndex < 4) {
        const start = match.index! + match[0].length
        const end = (i + 1 < matches.length) ? matches[i + 1].index! : text.length
        slots[sessionIndex] = text.slice(start, end).trim()
      }
    }
    if (slots.some(Boolean)) return slots
  }

  // Check for numbered steps (1., 2., 3., 4.)
  const numberedPattern = /(?:^|\n)(\d+)\.\s+/g
  const numMatches = [...text.matchAll(numberedPattern)]
  if (numMatches.length >= 1) {
    const slots = ['', '', '', '']
    for (let i = 0; i < Math.min(4, numMatches.length); i++) {
      const start = numMatches[i].index! + numMatches[i][0].length
      const end = (i + 1 < numMatches.length) ? numMatches[i + 1].index! : text.length
      slots[i] = text.slice(start, end).trim()
    }
    return slots
  }

  // Check for multi-paragraph blocks
  const paragraphs = text.split(/\n\s*\n/).map(clean).filter(Boolean)
  if (paragraphs.length === 4) return paragraphs
  if (paragraphs.length > 4) {
    const step = Math.ceil(paragraphs.length / 4)
    return [
      paragraphs.slice(0, step).join('\n\n'),
      paragraphs.slice(step, step * 2).join('\n\n'),
      paragraphs.slice(step * 2, step * 3).join('\n\n'),
      paragraphs.slice(step * 3).join('\n\n'),
    ]
  }

  // Preserve teacher text without claiming that one undifferentiated entry
  // applies to every session. Unfilled cells remain available for editing.
  return [paragraphs[0] || text, paragraphs[1] || '', paragraphs[2] || '', paragraphs[3] || '']
}

const ENGLISH_SELF_CHECK_CRITERIA = [
  'Intentions are clearly stated, with appropriate learning competencies articulated.',
  'Intentions are evident across all sections; there is coherence.',
  'Learning experience is clear—another teacher can implement this lesson without additional explanation.',
  'Learning experience is well-designed, with intentionally embedded learning-design principles.',
  'Learning experience maximizes available opportunities for integration.',
  'Learning experience is inclusive and provides appropriate classroom-level support.',
  'Assessment strategies are integrated throughout the sessions to see learner progress.',
  'Assessment strategies generate evidence of successful learning.',
  'Interventions are actionable and provide ways to extend or adjust learning.',
]

const FILIPINO_SELF_CHECK_CRITERIA = [
  'Malinaw ang mga layunin at naipahayag ang angkop na mga kasanayan sa pagkatuto.',
  'Makikita ang mga layunin sa lahat ng bahagi at magkakaugnay ang mga ito.',
  'Malinaw ang karanasan sa pagkatuto at maisasagawa ito ng ibang guro.',
  'Maayos ang disenyo ng karanasan sa pagkatuto at may angkop na mga prinsipyo sa pagkatuto.',
  'Nagamit nang makabuluhan ang mga pagkakataon para sa integrasyon.',
  'Inklusibo ang plano at nagbibigay ng angkop na suporta sa mga mag-aaral.',
  'Nakasama ang pagtataya sa mga sesyon upang makita ang progreso ng mga mag-aaral.',
  'Nakagagawa ang mga estratehiya ng sapat na katibayan ng pagkatuto.',
  'Isinasaad ang mga susunod na hakbang at interbensyon nang malinaw at maisasagawa.',
]

export function buildLessonPlanMultiSessionExportModel(
  plan: LessonPlanRecord,
  profile: Profile,
  preferences: TeacherExportPreferences,
  lessonPreferences?: TeacherLessonPreferences | null,
): LessonPlanMultiSessionExportModel {
  const content = plan.content
  const language = resolveExportLanguage(plan, preferences, lessonPreferences)
  const labels = language === 'filipino' ? FILIPINO_LABELS : ENGLISH_LABELS
  const multiLabels = language === 'filipino' ? FILIPINO_MULTI_LABELS : ENGLISH_MULTI_LABELS

  const sessionHeaders = language === 'filipino'
    ? ['Sesyon 1 / Unang Sesyon', 'Sesyon 2 / Ikalawang Sesyon', 'Sesyon 3 / Ikatlong Sesyon', 'Sesyon 4 / Ikaapat na Sesyon']
    : ['Session 1 / Unang Sesyon', 'Session 2 / Ikalawang Sesyon', 'Session 3 / Ikatlong Sesyon', 'Session 4 / Ikaapat na Sesyon']

  const rawReferences = clean(content.references)
  const refLines = rawReferences ? rawReferences.split(/\r?\n/).map(clean).filter(Boolean) : []
  const officialReferences = refLines.filter((l) => /deped|curriculum|bow|order|matatag|exemplar/i.test(l))
  const otherLearningSources = refLines.filter((l) => !/deped|curriculum|bow|order|matatag|exemplar/i.test(l))
  const lowTechAlternatives: string[] = []

  const aiDeclarationStatement = clean(content.aiDeclaration.statement)
    || (content.aiDeclaration.used
      ? 'AI assistance was used in preparing this lesson plan. The teacher remains responsible for reviewing, adapting, validating, and approving the final plan.'
      : language === 'filipino'
        ? 'Walang ginamit na tulong ng AI sa paghahanda ng banghay-araling ito.'
        : 'No AI assistance was used in the preparation of this lesson plan.')

  const objectivesSessions = splitIntoFourSessions(content.intentions.learningObjectives)
  const preLessonSessions = splitIntoFourSessions(content.learningExperience.preLessonActivity)
  const flowSessions = splitIntoFourSessions(content.learningExperience.lessonFlow)
  const resourcesSessions = splitIntoFourSessions(content.learningExperience.resources)
  const integrationSessions = splitIntoFourSessions(content.learningExperience.integrationContextualization)
  const inclusionSessions = splitIntoFourSessions(content.learningExperience.inclusionAccommodations)
  const formativeSessions = splitIntoFourSessions(content.assessingLearning.formativeAssessments)
  const extendedSessions = splitIntoFourSessions(content.waysForward.extendedLearning)
  const reflectionSessions = splitIntoFourSessions(content.waysForward.reflection)
  const validation = validateLessonPlan(content)
  const validationByKey = new Map(validation.items.map((item) => [item.key, item]))
  const rubricCriteria = language === 'filipino' ? FILIPINO_SELF_CHECK_CRITERIA : ENGLISH_SELF_CHECK_CRITERIA
  const buildRubricItem = (criterion: string, keys: string[], extraPassed = true): SelfCheckRubricItem => {
    const failed = keys.map((key) => validationByKey.get(key)).filter((item): item is NonNullable<typeof item> => Boolean(item && !item.passed))
    const passed = extraPassed && failed.length === 0
    return {
      criterion,
      status: passed ? 'yes' : 'not_yet',
      improvementNote: passed ? undefined : failed.map((item) => item.detail).join(' ') || 'Add and confirm the teacher-authored details for this criterion.',
    }
  }
  const rubricItems: SelfCheckRubricItem[] = [
    buildRubricItem(rubricCriteria[0], ['competency', 'objectives']),
    buildRubricItem(rubricCriteria[1], ['objectives', 'experience']),
    buildRubricItem(rubricCriteria[2], ['experience']),
    buildRubricItem(rubricCriteria[3], ['experience']),
    buildRubricItem(rubricCriteria[4], [], Boolean(clean(content.learningExperience.integrationContextualization))),
    buildRubricItem(rubricCriteria[5], [], Boolean(clean(content.learningExperience.inclusionAccommodations))),
    buildRubricItem(rubricCriteria[6], ['assessment']),
    buildRubricItem(rubricCriteria[7], ['assessment']),
    buildRubricItem(rubricCriteria[8], ['ways-forward']),
  ]

  const rows: MultiSessionGridRow[] = [
    {
      key: 'intentions',
      heading: language === 'filipino' ? 'Mga Layunin (Intentions)' : 'Intentions / Mga Layunin',
      guideQuestions: language === 'filipino'
        ? 'Bumuo ng malinaw na mental model at konsepto para sa bawat sesyon.'
        : 'Build a precise mental model and concept focus for each session.',
      sessions: objectivesSessions,
    },
    {
      key: 'standards',
      heading: language === 'filipino' ? 'Kasanayang Pampagkatuto (Standards)' : 'Learning Competency and Curriculum Standards',
      guideQuestions: language === 'filipino'
        ? 'Isulat ang mga kasanayan mula sa kurikulum at ang pamantayang pangnilalaman/pagganap.'
        : 'Write the competency/ies from the curriculum targeted, and the content or performance standards applicable to the sessions.',
      isFullSpan: true,
      fullSpanContent: competencyAndStandards(plan, language),
      sessions: ['', '', '', ''],
    },
    {
      key: 'objectives',
      heading: language === 'filipino' ? 'Mga Tiyak na Layunin (Objectives)' : 'Learning Objectives / Mga Tiyak na Layunin',
      guideQuestions: language === 'filipino'
        ? 'Isulat ang tiyak na kaalaman, kasanayan, o gawain mula sa kasanayan para sa bawat sesyon.'
        : 'Write the smaller knowledge, skills, or tasks from the competency that learners work on: "By the end of the session, learners can: 1. ... 2. ..."',
      sessions: objectivesSessions,
    },
    {
      key: 'learner_context',
      heading: language === 'filipino' ? 'Konteksto ng Mag-aaral (Learner Context)' : 'Learner Context / Konteksto ng Mag-aaral',
      guideQuestions: language === 'filipino'
        ? 'Mga obserbasyon sa mga mag-aaral: kalakasan, interes, posibleng hadlang, at nakaplanong suporta.'
        : 'Observations of learners, recent performance, strengths, interests, possible barriers to learning, and planned support.',
      isFullSpan: true,
      fullSpanContent: clean(content.learnerContext),
      sessions: ['', '', '', ''],
    },
    {
      key: 'learning_experience_overview',
      heading: language === 'filipino' ? 'Karanasan sa Pagkatuto (Overview)' : 'Learning Experience / Karanasan sa Pagkatuto',
      guideQuestions: language === 'filipino'
        ? 'Daloy ng pagkatuto mula sa kongkreto at biswal patungo sa simboliko at sariling paggamit.'
        : 'Pedagogical progression from concrete and visual representations to symbolic procedures and independent application.',
      isFullSpan: true,
      fullSpanContent: clean([content.learningExperience.preLessonActivity, content.learningExperience.lessonFlow, content.learningExperience.inclusionAccommodations].filter(Boolean).join('\n\n')),
      sessions: ['', '', '', ''],
    },
    {
      key: 'pre_lesson',
      heading: language === 'filipino' ? 'Bago ang Aralin (Pre-Lesson)' : 'Pre-Lesson / Bago ang Aralin',
      guideQuestions: language === 'filipino'
        ? 'Ilarawan kung paano ihahanda ang mga mag-aaral: pagbabalik-aral, warm-up, at readiness check.'
        : 'Describe how you will help learners get ready: retrieval routines, warm-up drills, and readiness checks.',
      sessions: preLessonSessions,
    },
    {
      key: 'flow',
      heading: language === 'filipino' ? 'Daloy ng Aralin (Flow)' : 'Flow / Daloy ng Aralin',
      guideQuestions: language === 'filipino'
        ? 'Mga gawain sa bawat sesyon: 1. Linawin ang target, 2. Pagmomodelo, 3. Ginabayang pagsasanay, 4. Malayang pagsasanay, 5. Error analysis, 6. Pagninilay.'
        : 'Session activities: 1. Clarify target, 2. Construct/Model, 3. Guided practice, 4. Independent practice, 5. Error analysis, 6. Check and reflect.',
      sessions: flowSessions,
    },
    {
      key: 'resources',
      heading: language === 'filipino' ? 'Mga Kagamitang Panturo (Resources)' : 'Learning Resources / Mga Kagamitang Panturo',
      guideQuestions: language === 'filipino'
        ? 'Ilista ang mga kagamitan at mga alternatibo sakaling magkaroon ng emergency.'
        : 'List available, inclusive learning resources and emergency/low-tech alternatives.',
      sessions: resourcesSessions,
    },
    {
      key: 'integration',
      heading: language === 'filipino' ? 'Integrasyon (Opportunities for Integration)' : 'Opportunities for Integration / Integrasyon',
      guideQuestions: language === 'filipino'
        ? 'Makabuluhang pag-uugnay sa ibang larangan: Agham, Araling Panlipunan, Values Education, P.E., DRRM, ICT.'
        : 'Cross-curricular connections to other learning areas: Science, AP/Geography, Values Education, P.E., DRRM, and ICT.',
      sessions: integrationSessions,
    },
    {
      key: 'inclusion',
      heading: language === 'filipino' ? 'Inklusyon at Angkop na Suporta' : 'Inclusion and Accommodations',
      guideQuestions: language === 'filipino'
        ? 'Tiyakin ang inklusyon para sa iba\'t ibang kakayahan, estilo ng pagkatuto, at konteksto.'
        : 'Ensure inclusion for learners\' varied abilities, learning styles, and unique contexts.',
      sessions: inclusionSessions,
    },
    {
      key: 'assessment_overview',
      heading: language === 'filipino' ? 'Pagtataya (Assessment Overview)' : 'Assessment / Pagtataya',
      guideQuestions: language === 'filipino'
        ? 'Pangkalahatang diskarte sa pagtataya at pangangalap ng katibayan ng pagkatuto.'
        : 'General assessment approach, evaluation criteria, and evidence gathering across sessions.',
      isFullSpan: true,
      fullSpanContent: clean([content.assessingLearning.formativeAssessments, content.assessingLearning.evidenceOfLearning].filter(Boolean).join('\n\n')),
      sessions: ['', '', '', ''],
    },
    {
      key: 'formative_assessment',
      heading: language === 'filipino' ? 'Pormatibong Pagtataya (Formative Assessment)' : 'Formative Assessment / Formative na Pagtataya',
      guideQuestions: language === 'filipino'
        ? 'Gawain o Quick Check 5-Item Quiz para suriin ang pagkatuto at magbigay ng agarang feedback kasama ang answer key.'
        : 'Session task or Quick Check 5-Item Formative Quiz to evaluate learning with answer key and use of results.',
      sessions: formativeSessions,
    },
    {
      key: 'ways_forward_overview',
      heading: language === 'filipino' ? 'Mga Susunod na Hakbang (Ways Forward)' : 'Ways Forward / Mga Susunod na Hakbang',
      guideQuestions: language === 'filipino'
        ? 'Gamitin ang resulta upang magdesisyon sa susunod na hakbang: muling ituro, interbensyon, o enrichment.'
        : 'Use student work and error patterns to decide next steps: reteach key concepts, small-group intervention, or enrichment.',
      isFullSpan: true,
      fullSpanContent: clean([content.waysForward.nextSteps, content.waysForward.reflection].filter(Boolean).join('\n\n')),
      sessions: ['', '', '', ''],
    },
    {
      key: 'extended_learning',
      heading: language === 'filipino' ? 'Karagdagang Gawain (Extended Learning)' : 'Extended Learning Opportunities / Mga Karagdagang Gawain',
      guideQuestions: language === 'filipino'
        ? 'Magmungkahi ng mga karanasan sa pagkatuto sa labas ng silid-aralan o sa tahanan.'
        : 'Suggest learning experiences outside classroom hours or home-based extensions.',
      sessions: extendedSessions,
    },
    {
      key: 'reflections',
      heading: language === 'filipino' ? 'Pagninilay (Reflections)' : 'Reflections / Mga Pagninilay',
      guideQuestions: language === 'filipino'
        ? 'Ano ang kailangang baguhin para sa susunod na sesyon batay sa nangyari ngayon? Anong tulong ang kailangan mula sa instructional coach?'
        : 'Reflect on session outcomes, adjustments for the next session, LAC discussion points, and instructional coaching needs.',
      sessions: reflectionSessions,
    },
  ]

  const signatories = [
    {
      role: labels.preparedBy,
      name: clean(preferences.preparedByName) || clean(profile.fullName),
      title: clean(preferences.preparedByTitle) || clean(profile.positionTitle),
    },
    {
      role: labels.reviewedBy,
      name: clean(preferences.reviewedByName),
      title: clean(preferences.reviewedByTitle),
    },
    {
      role: labels.notedBy,
      name: clean(preferences.notedByName),
      title: clean(preferences.notedByTitle),
    },
  ].filter((item) => item.name || item.role === labels.preparedBy)

  return {
    documentTitle: language === 'filipino' ? 'DAILY LESSON LOG (4-SESYON)' : 'DAILY LESSON LOG (4-SESSION FORMAT)',
    templateLabel: 'Daily Lesson Log',
    language,
    labels,
    multiLabels,
    status: plan.status,
    identity: {
      teacherName: display(profile.fullName, ''),
      positionTitle: clean(profile.positionTitle),
      schoolName: clean(profile.schoolName),
      region: clean(profile.region),
      division: clean(profile.division),
      district: clean(profile.district),
    },
    lesson: {
      title: display(content.lessonTitle || content.lessonFocus),
      schoolYear: display(content.schoolYear),
      gradeLevel: display(content.gradeLevel),
      learningArea: display(content.learningArea),
      sections: content.sections.length ? content.sections.join(', ') : 'Not specified',
      curriculumPeriod: display(content.curriculumPeriodLabel),
      gradingTerm: display(content.gradingTermLabel),
      lessonDate: formatDate(content.lessonDate, language),
      weekLabel: display(content.weekLabel),
      sessions: `${content.lessonPlanFormat === 'daily_lesson_log' ? 4 : (content.numberOfSessions || 4)}`,
      duration: language === 'filipino'
        ? `${content.durationMinutes || 60} minuto bawat sesyon`
        : `${content.durationMinutes || 60} minutes per session`,
    },
    sessionHeaders,
    referencesDetail: {
      officialReferences,
      otherLearningSources,
      lowTechAlternatives,
    },
    aiDeclarationStatement,
    rows,
    rubricItems,
    coachingNotes: '',
    signatories,
  }
}

export function buildLessonPlanExportModel(
  plan: LessonPlanRecord,
  profile: Profile,
  preferences: TeacherExportPreferences,
  lessonPreferences?: TeacherLessonPreferences | null,
  templateOverride?: ExportTemplateId,
): LessonPlanExportModel {
  const content = plan.content
  const language = resolveExportLanguage(plan, preferences, lessonPreferences)
  const labels = language === 'filipino' ? FILIPINO_LABELS : ENGLISH_LABELS
  const fieldLabels = language === 'filipino' ? FILIPINO_FIELD_LABELS : ENGLISH_FIELD_LABELS
  const effectiveTemplateId = templateOverride ?? (
    content.lessonPlanFormat === 'daily_lesson_log'
      ? 'gurodesk_ilaw_multisession'
      : content.lessonPlanFormat === 'ilaw'
        ? 'gurodesk_ilaw_standard'
        : preferences.defaultTemplateId
  )
  const signatories = [
    {
      role: labels.preparedBy,
      name: clean(preferences.preparedByName) || clean(profile.fullName),
      title: clean(preferences.preparedByTitle) || clean(profile.positionTitle),
    },
    {
      role: labels.reviewedBy,
      name: clean(preferences.reviewedByName),
      title: clean(preferences.reviewedByTitle),
    },
    {
      role: labels.notedBy,
      name: clean(preferences.notedByName),
      title: clean(preferences.notedByTitle),
    },
  ].filter((item) => item.name || item.role === labels.preparedBy)

  const multiSession = buildLessonPlanMultiSessionExportModel(plan, profile, preferences, lessonPreferences)

  return {
    documentTitle: labels.documentTitle,
    templateLabel: effectiveTemplateId === 'gurodesk_ilaw_multisession' ? 'Daily Lesson Log' : 'ILAW Standard',
    language,
    labels,
    status: plan.status,
    identity: {
      teacherName: display(profile.fullName, ''),
      positionTitle: clean(profile.positionTitle),
      schoolName: clean(profile.schoolName),
      region: clean(profile.region),
      division: clean(profile.division),
      district: clean(profile.district),
    },
    lesson: {
      title: display(content.lessonTitle || content.lessonFocus),
      schoolYear: display(content.schoolYear),
      gradeLevel: display(content.gradeLevel),
      learningArea: display(content.learningArea),
      sections: content.sections.length ? content.sections.join(', ') : 'Not specified',
      curriculumPeriod: display(content.curriculumPeriodLabel),
      gradingTerm: display(content.gradingTermLabel),
      lessonDate: formatDate(content.lessonDate, language),
      weekLabel: display(content.weekLabel),
      sessions: `${content.numberOfSessions || 1}`,
      duration: language === 'filipino'
        ? `${content.durationMinutes || 60} minuto bawat sesyon`
        : `${content.durationMinutes || 60} minutes per session`,
    },
    ilaw: {
      intentions: [
        { key: 'lesson-focus', heading: fieldLabels.lessonFocus, body: clean(content.lessonFocus) || clean(content.lessonTitle) },
        { key: 'competency-standards', heading: fieldLabels.competencyStandards, body: competencyAndStandards(plan, language) },
        { key: 'learning-objectives', heading: fieldLabels.learningObjectives, body: clean(content.intentions.learningObjectives) },
        { key: 'learner-context', heading: fieldLabels.learnerContext, body: clean(content.learnerContext) },
        { key: 'teaching-approaches', heading: fieldLabels.teachingApproaches, body: content.teachingApproaches.join('\n') },
      ],
      learningExperience: [
        { key: 'pre-lesson', heading: fieldLabels.preLesson, body: clean(content.learningExperience.preLessonActivity) },
        { key: 'lesson-flow', heading: fieldLabels.lessonFlow, body: clean(content.learningExperience.lessonFlow) },
        { key: 'resources', heading: fieldLabels.resources, body: clean(content.learningExperience.resources) },
        { key: 'contextualization', heading: fieldLabels.contextualization, body: clean(content.learningExperience.integrationContextualization) },
        { key: 'inclusion', heading: fieldLabels.inclusion, body: clean(content.learningExperience.inclusionAccommodations) },
        { key: 'home-alternative', heading: fieldLabels.homeAlternative, body: clean(content.learningExperience.homeBasedAlternative) },
      ],
      assessingLearning: [
        { key: 'formative', heading: fieldLabels.formative, body: clean(content.assessingLearning.formativeAssessments) },
        { key: 'evidence', heading: fieldLabels.evidence, body: clean(content.assessingLearning.evidenceOfLearning) },
      ],
      waysForward: [
        { key: 'extended', heading: fieldLabels.extended, body: clean(content.waysForward.extendedLearning) },
        { key: 'next-steps', heading: fieldLabels.nextSteps, body: clean(content.waysForward.nextSteps) },
        { key: 'reflection', heading: fieldLabels.reflection, body: clean(content.waysForward.reflection) },
      ],
    },
    references: clean(content.references),
    signatories,
    multiSession,
  }
}

function safeFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'lesson-plan'
}

export function lessonPlanExportFilename(model: LessonPlanExportModel, extension: 'pdf' | 'docx') {
  const stem = `${model.lesson.gradeLevel} ${model.lesson.learningArea} - ${model.lesson.title}`
  return `${safeFilename(stem)}.${extension}`
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function docxPaperSize(paper: ExportPaperSize, orientation: 'portrait' | 'landscape' = 'portrait') {
  if (orientation === 'landscape') {
    if (paper === 'letter') return { width: 15840, height: 12240, orientation: PageOrientation.LANDSCAPE }
    if (paper === 'legal') return { width: 20160, height: 12240, orientation: PageOrientation.LANDSCAPE }
    return { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE }
  }
  if (paper === 'letter') return { width: 12240, height: 15840 }
  if (paper === 'legal') return { width: 12240, height: 20160 }
  return { width: 11906, height: 16838 }
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 5, color: BORDER },
  }
}

function exportValue(value: string | null | undefined) {
  const normalized = clean(value)
  return normalized === 'Not specified' ? '' : normalized
}

function docxMetaLabelCell(label: string, widthPct = 28) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
    children: [new Paragraph({
      children: [new TextRun({ text: label, bold: true, size: 17, color: TEXT })],
    })],
  })
}

function docxMetaValueCell(value: string, widthPct = 72, columnSpan?: number) {
  const lines = (exportValue(value) || ' ').split(/\r?\n/)
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    columnSpan,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: lines.map((line) => new Paragraph({
      spacing: { after: 16 },
      children: [new TextRun({ text: line || ' ', size: 17, color: TEXT })],
    })),
  })
}

function docxMetaRow(label: string, value: string) {
  return new TableRow({ children: [docxMetaLabelCell(label), docxMetaValueCell(value)] })
}

function docxSectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 260, after: 100 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 8, color: TEXT, space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: TEXT, space: 4 },
    },
    children: [new TextRun({ text, bold: true, color: TEXT, size: 23 })],
  })
}

function docxField(label: string, body: string) {
  if (!clean(body)) return []
  const rawLines = body.split(/\r?\n/)
  const paragraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 120, after: 45 },
      children: [new TextRun({ text: label, bold: true, color: TEXT, size: 20 })],
    }),
  ]

  for (const raw of rawLines) {
    const line = clean(raw)
    if (!line) continue
    if (line.startsWith('### ')) {
      const headingText = line.replace(/^###\s+/, '')
      paragraphs.push(
        new Paragraph({
          spacing: { before: 90, after: 35 },
          children: [new TextRun({ text: headingText, bold: true, color: TEXT, size: 19 })],
        }),
      )
    } else if (line.startsWith('• ') || line.startsWith('* ') || line.startsWith('- ')) {
      const bulletText = line.replace(/^[•*-]\s+/, '')
      paragraphs.push(
        new Paragraph({
          spacing: { after: 35 },
          bullet: { level: 0 },
          children: [new TextRun({ text: bulletText, size: 19, color: TEXT })],
        }),
      )
    } else {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 45 },
          children: [new TextRun({ text: line, size: 19, color: TEXT })],
        }),
      )
    }
  }

  return paragraphs
}

export async function downloadLessonPlanMultiSessionDocx(
  multiModel: LessonPlanMultiSessionExportModel,
  preferences: TeacherExportPreferences,
) {
  const paper = docxPaperSize(preferences.paperSize, 'landscape')
  const gradeAndSection = `${multiModel.lesson.gradeLevel}${multiModel.lesson.sections && multiModel.lesson.sections !== 'Not specified' ? ` - ${multiModel.lesson.sections}` : ''}`
  const sessionSummary = `${multiModel.lesson.sessions} ${multiModel.labels.sessionUnit}, ${multiModel.lesson.duration}`

  const headerLines = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: multiModel.labels.republic, size: 16, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 18 },
      children: [new TextRun({ text: multiModel.labels.department, bold: true, size: 18, color: TEXT })],
    }),
    ...(multiModel.identity.region ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 14 }, children: [new TextRun({ text: multiModel.identity.region, size: 15, color: TEXT })] })] : []),
    ...(multiModel.identity.division ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 14 }, children: [new TextRun({ text: multiModel.identity.division, size: 15, color: TEXT })] })] : []),
    ...(multiModel.identity.district ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 14 }, children: [new TextRun({ text: multiModel.identity.district, size: 15, color: TEXT })] })] : []),
    ...(multiModel.identity.schoolName ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: multiModel.identity.schoolName, bold: true, size: 17, color: TEXT })] })] : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 80 },
      children: [new TextRun({ text: multiModel.documentTitle, bold: true, size: 24, color: TEXT })],
    }),
  ]

  const metaRows = [
    docxMetaRow(multiModel.multiLabels.lessonName, multiModel.lesson.title),
    docxMetaRow(multiModel.multiLabels.learningArea, multiModel.lesson.learningArea),
    docxMetaRow(multiModel.multiLabels.termWeek, `${multiModel.lesson.gradingTerm} | ${multiModel.lesson.weekLabel}`),
    docxMetaRow(multiModel.multiLabels.gradeSection, gradeAndSection),
    docxMetaRow(multiModel.multiLabels.teacher, multiModel.identity.teacherName),
    docxMetaRow(multiModel.multiLabels.sessionsDuration, sessionSummary),
    docxMetaRow(multiModel.labels.schoolYear, multiModel.lesson.schoolYear),
    docxMetaRow(multiModel.labels.date, multiModel.lesson.lessonDate),
    docxMetaRow(multiModel.labels.curriculumPeriod, multiModel.lesson.curriculumPeriod),
    docxMetaRow(multiModel.multiLabels.references, [
      `A. ${multiModel.multiLabels.officialReferences}:`,
      ...(multiModel.referencesDetail.officialReferences.length ? multiModel.referencesDetail.officialReferences.map((r) => `• ${r}`) : [multiModel.multiLabels.noEntry]),
      `B. ${multiModel.multiLabels.otherSources}:`,
      ...(multiModel.referencesDetail.otherLearningSources.length ? multiModel.referencesDetail.otherLearningSources : [multiModel.multiLabels.noEntry]),
      `C. ${multiModel.multiLabels.lowTechAlternatives}:`,
      ...(multiModel.referencesDetail.lowTechAlternatives.length ? multiModel.referencesDetail.lowTechAlternatives : [multiModel.multiLabels.noEntry]),
    ].join('\n')),
    docxMetaRow(multiModel.multiLabels.aiDeclaration, multiModel.aiDeclarationStatement),
  ]

  // Multi-session table headers: [Dimension, Session 1, Session 2, Session 3, Session 4]
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 24, type: WidthType.PERCENTAGE },
        shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 80, bottom: 80, left: 90, right: 90 },
        children: [new Paragraph({ children: [new TextRun({ text: multiModel.multiLabels.dimensionsGuide, bold: true, size: 16, color: TEXT })] })],
      }),
      ...multiModel.sessionHeaders.map((headerText) => new TableCell({
        width: { size: 19, type: WidthType.PERCENTAGE },
        shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 80, bottom: 80, left: 90, right: 90 },
        children: [new Paragraph({ children: [new TextRun({ text: headerText, bold: true, size: 16, color: TEXT })] })],
      })),
    ],
  })

  const gridRows = multiModel.rows.map((row) => {
    const dimensionCell = new TableCell({
      width: { size: 24, type: WidthType.PERCENTAGE },
      margins: { top: 70, bottom: 70, left: 80, right: 80 },
      children: [
        new Paragraph({ children: [new TextRun({ text: row.heading, bold: true, size: 16, color: TEXT })] }),
        ...(row.guideQuestions ? [new Paragraph({ spacing: { before: 20 }, children: [new TextRun({ text: row.guideQuestions, italics: true, size: 14, color: MUTED })] })] : []),
      ],
    })

    if (row.isFullSpan) {
      const fullSpanCell = new TableCell({
        width: { size: 76, type: WidthType.PERCENTAGE },
        columnSpan: 4,
        margins: { top: 70, bottom: 70, left: 90, right: 90 },
        children: (row.fullSpanContent || '').split(/\r?\n/).map((line) => new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: line || ' ', size: 16, color: TEXT })],
        })),
      })
      return new TableRow({ children: [dimensionCell, fullSpanCell] })
    }

    const sessionCells = row.sessions.map((sessionContent) => {
      const lines = (sessionContent || '').split(/\r?\n/)
      return new TableCell({
        width: { size: 19, type: WidthType.PERCENTAGE },
        margins: { top: 70, bottom: 70, left: 80, right: 80 },
        children: lines.map((line) => new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: line || ' ', size: 15, color: TEXT })],
        })),
      })
    })

    return new TableRow({ children: [dimensionCell, ...sessionCells] })
  })

  // Rubric Rows
  const rubricRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: multiModel.multiLabels.rubricCriterion, bold: true, size: 15, color: TEXT })] })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: multiModel.multiLabels.yes, bold: true, size: 15, color: TEXT })] })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: multiModel.multiLabels.notYet, bold: true, size: 15, color: TEXT })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { fill: HEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: multiModel.multiLabels.improvement, bold: true, size: 15, color: TEXT })] })],
        }),
      ],
    }),
    ...multiModel.rubricItems.map((item) => new TableRow({
      children: [
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: item.criterion, size: 15, color: TEXT })] })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.status === 'yes' ? '✓' : '', size: 16, bold: true, color: TEXT })] })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.status === 'not_yet' ? '✓' : '', size: 16, color: TEXT })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: item.improvementNote || ' ', size: 14, color: MUTED })] })],
        }),
      ],
    })),
  ]

  const children: Array<Paragraph | Table> = [
    ...headerLines,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: metaRows,
    }),
    docxSectionHeading(multiModel.multiLabels.matrixHeading),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: [tableHeaderRow, ...gridRows],
    }),
    docxSectionHeading(multiModel.multiLabels.rubricHeading),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: rubricRows,
    }),
    docxSectionHeading(multiModel.multiLabels.coachingHeading),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: { top: 90, bottom: 90, left: 100, right: 100 },
              children: [
                new Paragraph({ children: [new TextRun({ text: multiModel.coachingNotes, size: 16, color: TEXT })] }),
                new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: `${multiModel.multiLabels.coachingPlaceholder} ____________________________________________________________________________________`, size: 15, color: MUTED })] }),
              ],
            }),
          ],
        }),
      ],
    }),
  ]

  if (multiModel.signatories.length) {
    children.push(docxSectionHeading(multiModel.labels.signatures))
    for (const item of multiModel.signatories) {
      children.push(
        new Paragraph({ spacing: { before: 180, after: 20 }, children: [new TextRun({ text: item.role, size: 16, color: MUTED })] }),
        new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: item.name || '____________________________', bold: true, size: 18, color: TEXT })] }),
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: item.title || ' ', size: 16, color: MUTED })] }),
      )
    }
  }

  // GuroDesk Clean Footer Paragraph
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({
          text: multiModel.multiLabels.footer,
          size: 13,
          color: MUTED,
          italics: true,
        }),
      ],
    }),
  )

  const document = new Document({
    creator: multiModel.identity.teacherName,
    title: `${multiModel.lesson.title} - Daily Lesson Log`,
    description: 'GuroDesk Daily Lesson Log four-session lesson plan',
    sections: [{
      properties: {
        page: {
          size: paper,
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(document)
  saveBlob(blob, `${safeFilename(`${multiModel.lesson.gradeLevel} ${multiModel.lesson.learningArea} - ${multiModel.lesson.title} - Daily Lesson Log`)}.docx`)
}

export async function downloadLessonPlanDocx(
  model: LessonPlanExportModel,
  preferences: TeacherExportPreferences,
) {
  if (model.templateLabel === 'Daily Lesson Log' && model.multiSession) {
    return downloadLessonPlanMultiSessionDocx(model.multiSession, preferences)
  }

  const paper = docxPaperSize(preferences.paperSize)
  const gradeAndSection = `${model.lesson.gradeLevel}${model.lesson.sections && model.lesson.sections !== 'Not specified' ? ` - ${model.lesson.sections}` : ''}`
  const sessionSummary = `${model.lesson.sessions} ${model.labels.sessionUnit}, ${model.lesson.duration}`

  const headerLines = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [new TextRun({ text: model.labels.republic, size: 17, color: TEXT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 26 },
      children: [new TextRun({ text: model.labels.department, bold: true, size: 20, color: TEXT })],
    }),
    ...(model.identity.region ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.region, size: 16, color: TEXT })] })] : []),
    ...(model.identity.division ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.division, size: 16, color: TEXT })] })] : []),
    ...(model.identity.district ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: model.identity.district, size: 16, color: TEXT })] })] : []),
    ...(model.identity.schoolName ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 90 }, children: [new TextRun({ text: model.identity.schoolName, bold: true, size: 18, color: TEXT })] })] : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 120 },
      children: [new TextRun({ text: model.documentTitle, bold: true, size: 27, color: TEXT })],
    }),
  ]

  const metaRows = [
    docxMetaRow(model.labels.teacher, model.identity.teacherName),
    docxMetaRow(model.labels.gradeSection, gradeAndSection),
    docxMetaRow(model.labels.learningArea, model.lesson.learningArea),
    docxMetaRow(model.labels.lessonTitle, model.lesson.title),
    docxMetaRow(model.labels.date, model.lesson.lessonDate),
    docxMetaRow(model.labels.weekSchedule, model.lesson.weekLabel),
    docxMetaRow(model.labels.schoolYear, model.lesson.schoolYear),
    docxMetaRow(model.labels.gradingTerm, model.lesson.gradingTerm),
    docxMetaRow(model.labels.curriculumPeriod, model.lesson.curriculumPeriod),
    docxMetaRow(model.labels.sessionsDuration, sessionSummary),
    docxMetaRow(model.labels.references, model.references),
  ]

  const children: Array<Paragraph | Table> = [
    ...headerLines,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders(),
      rows: metaRows,
    }),
    docxSectionHeading(`I. ${model.labels.intentions}`),
    ...model.ilaw.intentions.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading(`L. ${model.labels.learningExperience}`),
    ...model.ilaw.learningExperience.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading(`A. ${model.labels.assessingLearning}`),
    ...model.ilaw.assessingLearning.flatMap((item) => docxField(item.heading, item.body)),
    docxSectionHeading(`W. ${model.labels.waysForward}`),
    ...model.ilaw.waysForward.flatMap((item) => docxField(item.heading, item.body)),
  ]

  if (model.signatories.length) {
    children.push(docxSectionHeading(model.labels.signatures))
    for (const item of model.signatories) {
      children.push(
        new Paragraph({ spacing: { before: 230, after: 25 }, children: [new TextRun({ text: item.role, size: 18, color: MUTED })] }),
        new Paragraph({ spacing: { after: 25 }, children: [new TextRun({ text: item.name || '____________________________', bold: true, size: 20, color: TEXT })] }),
        new Paragraph({ spacing: { after: 75 }, children: [new TextRun({ text: item.title || ' ', size: 18, color: MUTED })] }),
      )
    }
  }

  const document = new Document({
    creator: model.identity.teacherName,
    title: `${model.lesson.title} - ILAW Lesson Plan`,
    description: model.language === 'filipino' ? 'ILAW banghay-aralin' : 'ILAW lesson plan',
    sections: [{
      properties: {
        page: {
          size: paper,
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(document)
  saveBlob(blob, lessonPlanExportFilename(model, 'docx'))
}

function pdfFormat(paper: ExportPaperSize): 'a4' | 'letter' | 'legal' {
  return paper
}

type PdfContext = {
  doc: jsPDF
  x: number
  y: number
  width: number
  bottom: number
}

function pdfEnsure(ctx: PdfContext, needed = 48) {
  if (ctx.y + needed <= ctx.bottom) return
  ctx.doc.addPage()
  ctx.y = 54
}

function pdfText(ctx: PdfContext, text: string, options?: { bold?: boolean; size?: number; color?: [number, number, number]; indent?: number; gapAfter?: number }) {
  if (!clean(text)) return
  const size = options?.size ?? 10
  const indent = options?.indent ?? 0
  const gapAfter = options?.gapAfter ?? 7
  ctx.doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  ctx.doc.setFontSize(size)
  const color = options?.color ?? [0, 0, 0]
  ctx.doc.setTextColor(color[0], color[1], color[2])
  const lines = ctx.doc.splitTextToSize(text, ctx.width - indent) as string[]
  const lineHeight = size * 1.35
  for (const line of lines) {
    if (ctx.y + lineHeight > ctx.bottom) {
      ctx.doc.addPage()
      ctx.y = 54
    }
    ctx.doc.text(line, ctx.x + indent, ctx.y)
    ctx.y += lineHeight
  }
  ctx.y += gapAfter
}

function pdfSection(ctx: PdfContext, title: string) {
  pdfEnsure(ctx, 38)
  ctx.doc.setDrawColor(0, 0, 0)
  ctx.doc.setLineWidth(0.8)
  ctx.doc.line(ctx.x, ctx.y - 7, ctx.x + ctx.width, ctx.y - 7)
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(11)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(title, ctx.x, ctx.y + 7)
  ctx.y += 16
  ctx.doc.line(ctx.x, ctx.y, ctx.x + ctx.width, ctx.y)
  ctx.y += 12
}

function pdfLabelBody(ctx: PdfContext, label: string, body: string) {
  if (!clean(body)) return
  pdfText(ctx, label, { bold: true, size: 9.5, color: [0, 0, 0], gapAfter: 3 })
  const rawLines = body.split(/\r?\n/)
  for (const raw of rawLines) {
    const line = clean(raw)
    if (!line) continue
    if (line.startsWith('### ')) {
      const heading = line.replace(/^###\s+/, '')
      pdfText(ctx, heading, { bold: true, size: 9, color: [30, 41, 59], gapAfter: 2 })
    } else if (line.startsWith('• ') || line.startsWith('* ') || line.startsWith('- ')) {
      const bullet = `  •  ${line.replace(/^[•*-]\s+/, '')}`
      pdfText(ctx, bullet, { size: 9, color: [0, 0, 0], gapAfter: 3 })
    } else {
      pdfText(ctx, line, { size: 9, color: [0, 0, 0], gapAfter: 4 })
    }
  }
  ctx.y += 5
}

function pdfMetaRow(ctx: PdfContext, label: string, value: string) {
  const labelWidth = Math.min(128, ctx.width * 0.29)
  const padX = 7
  const padY = 6
  const lineHeight = 10.5
  const labelLines = ctx.doc.splitTextToSize(label, labelWidth - padX * 2) as string[]
  const displayValue = exportValue(value) || ' '
  const valueLines = ctx.doc.splitTextToSize(displayValue, ctx.width - labelWidth - padX * 2) as string[]
  const rowHeight = Math.max(26, Math.max(labelLines.length, valueLines.length) * lineHeight + padY * 2)
  pdfEnsure(ctx, rowHeight + 1)
  const top = ctx.y

  ctx.doc.setDrawColor(105, 105, 105)
  ctx.doc.setLineWidth(0.45)
  ctx.doc.rect(ctx.x, top, ctx.width, rowHeight)
  ctx.doc.line(ctx.x + labelWidth, top, ctx.x + labelWidth, top + rowHeight)

  const textY = top + padY + 7.5
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(8.2)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(labelLines, ctx.x + padX, textY)

  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(8.8)
  ctx.doc.text(valueLines, ctx.x + labelWidth + padX, textY)
  ctx.y = top + rowHeight
}

function pdfHeaderLine(ctx: PdfContext, text: string, options?: { bold?: boolean; size?: number; gap?: number }) {
  if (!clean(text)) return
  ctx.doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
  ctx.doc.setFontSize(options?.size ?? 8.5)
  ctx.doc.setTextColor(0, 0, 0)
  ctx.doc.text(text, ctx.doc.internal.pageSize.getWidth() / 2, ctx.y, { align: 'center' })
  ctx.y += options?.gap ?? 12
}

function pdfSignatoryGrid(ctx: PdfContext, signatories: LessonPlanExportModel['signatories']) {
  if (!signatories.length) return
  pdfEnsure(ctx, 92)
  const count = Math.min(3, signatories.length)
  const colWidth = ctx.width / count
  const top = ctx.y + 8
  signatories.slice(0, count).forEach((item, index) => {
    const center = ctx.x + colWidth * index + colWidth / 2
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setFontSize(8.3)
    ctx.doc.text(item.role, center, top, { align: 'center' })
    const lineY = top + 30
    ctx.doc.setDrawColor(70, 70, 70)
    ctx.doc.setLineWidth(0.45)
    ctx.doc.line(center - colWidth * 0.34, lineY, center + colWidth * 0.34, lineY)
    if (clean(item.name)) {
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.setFontSize(8.8)
      const nameLines = ctx.doc.splitTextToSize(item.name, colWidth * 0.72) as string[]
      ctx.doc.text(nameLines, center, lineY + 12, { align: 'center' })
    }
    if (clean(item.title)) {
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(7.6)
      const titleLines = ctx.doc.splitTextToSize(item.title, colWidth * 0.72) as string[]
      ctx.doc.text(titleLines, center, lineY + 25, { align: 'center' })
    }
  })
  ctx.y = top + 64
}

export function downloadLessonPlanMultiSessionPdf(
  multiModel: LessonPlanMultiSessionExportModel,
  preferences: TeacherExportPreferences,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: pdfFormat(preferences.paperSize), compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const tableWidth = pageWidth - margin * 2
  const ctx: PdfContext = { doc, x: margin, y: 36, width: tableWidth, bottom: pageHeight - 36 }
  const gradeAndSection = `${multiModel.lesson.gradeLevel}${multiModel.lesson.sections && multiModel.lesson.sections !== 'Not specified' ? ` - ${multiModel.lesson.sections}` : ''}`
  const sessionSummary = `${multiModel.lesson.sessions} ${multiModel.labels.sessionUnit}, ${multiModel.lesson.duration}`

  pdfHeaderLine(ctx, multiModel.labels.republic, { size: 8, gap: 10 })
  pdfHeaderLine(ctx, multiModel.labels.department, { bold: true, size: 9.5, gap: 10 })
  if (multiModel.identity.region) pdfHeaderLine(ctx, multiModel.identity.region, { size: 7.8, gap: 9 })
  if (multiModel.identity.division) pdfHeaderLine(ctx, multiModel.identity.division, { size: 7.8, gap: 9 })
  if (multiModel.identity.district) pdfHeaderLine(ctx, multiModel.identity.district, { size: 7.8, gap: 9 })
  if (multiModel.identity.schoolName) pdfHeaderLine(ctx, multiModel.identity.schoolName, { bold: true, size: 8.5, gap: 14 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.text(multiModel.documentTitle, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 18

  // Top metadata rows
  pdfMetaRow(ctx, multiModel.multiLabels.lessonName, multiModel.lesson.title)
  pdfMetaRow(ctx, multiModel.multiLabels.learningArea, multiModel.lesson.learningArea)
  pdfMetaRow(ctx, multiModel.multiLabels.termWeek, `${multiModel.lesson.gradingTerm} | ${multiModel.lesson.weekLabel}`)
  pdfMetaRow(ctx, multiModel.multiLabels.gradeSection, gradeAndSection)
  pdfMetaRow(ctx, multiModel.multiLabels.teacher, multiModel.identity.teacherName)
  pdfMetaRow(ctx, multiModel.multiLabels.sessionsDuration, sessionSummary)
  pdfMetaRow(ctx, multiModel.labels.schoolYear, multiModel.lesson.schoolYear)
  pdfMetaRow(ctx, multiModel.labels.date, multiModel.lesson.lessonDate)
  pdfMetaRow(ctx, multiModel.labels.curriculumPeriod, multiModel.lesson.curriculumPeriod)
  pdfMetaRow(ctx, multiModel.multiLabels.references, [
    `A. ${multiModel.multiLabels.officialReferences}:`,
    ...(multiModel.referencesDetail.officialReferences.length ? multiModel.referencesDetail.officialReferences.map((r) => `• ${r}`) : [multiModel.multiLabels.noEntry]),
    `B. ${multiModel.multiLabels.otherSources}:`,
    ...(multiModel.referencesDetail.otherLearningSources.length ? multiModel.referencesDetail.otherLearningSources : [multiModel.multiLabels.noEntry]),
    `C. ${multiModel.multiLabels.lowTechAlternatives}:`,
    ...(multiModel.referencesDetail.lowTechAlternatives.length ? multiModel.referencesDetail.lowTechAlternatives : [multiModel.multiLabels.noEntry]),
  ].join('\n'))
  pdfMetaRow(ctx, multiModel.multiLabels.aiDeclaration, multiModel.aiDeclarationStatement)
  ctx.y += 12

  // 5-Column Multi-Session Matrix Table
  const col0Width = Math.round(tableWidth * 0.24)
  const sessionColWidth = Math.round((tableWidth - col0Width) / 4)

  const drawMatrixTableHeader = () => {
    pdfEnsure(ctx, 24)
    const top = ctx.y
    const headerHeight = 22
    ctx.doc.setFillColor(241, 245, 249)
    ctx.doc.rect(ctx.x, top, tableWidth, headerHeight, 'FD')
    ctx.doc.setDrawColor(105, 105, 105)
    ctx.doc.setLineWidth(0.5)

    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.setFontSize(8)
    ctx.doc.setTextColor(0, 0, 0)
    ctx.doc.text(multiModel.multiLabels.dimensionsGuide, ctx.x + 5, top + 14)

    multiModel.sessionHeaders.forEach((headerText, i) => {
      const colX = ctx.x + col0Width + sessionColWidth * i
      ctx.doc.line(colX, top, colX, top + headerHeight)
      const lines = ctx.doc.splitTextToSize(headerText, sessionColWidth - 8) as string[]
      ctx.doc.text(lines[0] || headerText, colX + 4, top + 14)
    })
    ctx.y = top + headerHeight
  }

  pdfSection(ctx, multiModel.multiLabels.matrixHeading)
  drawMatrixTableHeader()

  for (const row of multiModel.rows) {
    const pad = 5
    const headingLines = ctx.doc.splitTextToSize(row.heading, col0Width - pad * 2) as string[]
    const guideLines = row.guideQuestions ? ctx.doc.splitTextToSize(row.guideQuestions, col0Width - pad * 2) as string[] : []
    const leftTextHeight = headingLines.length * 9.5 + (guideLines.length ? guideLines.length * 8.5 + 4 : 0)

    let maxCellHeight = leftTextHeight
    let parsedSessionLines: string[][] = []
    let fullSpanLines: string[] = []

    if (row.isFullSpan) {
      fullSpanLines = ctx.doc.splitTextToSize(row.fullSpanContent || ' ', tableWidth - col0Width - pad * 2) as string[]
      maxCellHeight = Math.max(maxCellHeight, fullSpanLines.length * 9.5)
    } else {
      parsedSessionLines = row.sessions.map((s) => ctx.doc.splitTextToSize(s || ' ', sessionColWidth - pad * 2) as string[])
      for (const sl of parsedSessionLines) {
        maxCellHeight = Math.max(maxCellHeight, sl.length * 9.2)
      }
    }

    const rowHeight = Math.max(22, maxCellHeight + pad * 2)
    if (ctx.y + rowHeight > ctx.bottom) {
      ctx.doc.addPage()
      ctx.y = 36
      drawMatrixTableHeader()
    }

    const rowTop = ctx.y
    ctx.doc.setDrawColor(120, 120, 120)
    ctx.doc.setLineWidth(0.4)
    ctx.doc.rect(ctx.x, rowTop, tableWidth, rowHeight)

    // Left column divider and text
    ctx.doc.line(ctx.x + col0Width, rowTop, ctx.x + col0Width, rowTop + rowHeight)
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.setFontSize(8)
    ctx.doc.setTextColor(0, 0, 0)
    ctx.doc.text(headingLines, ctx.x + pad, rowTop + pad + 7)
    if (guideLines.length) {
      ctx.doc.setFont('helvetica', 'italic')
      ctx.doc.setFontSize(7.2)
      ctx.doc.setTextColor(70, 70, 70)
      ctx.doc.text(guideLines, ctx.x + pad, rowTop + pad + 7 + headingLines.length * 9.5 + 3)
    }

    if (row.isFullSpan) {
      ctx.doc.setFont('helvetica', 'normal')
      ctx.doc.setFontSize(8)
      ctx.doc.setTextColor(0, 0, 0)
      ctx.doc.text(fullSpanLines, ctx.x + col0Width + pad, rowTop + pad + 7)
    } else {
      parsedSessionLines.forEach((sLines, idx) => {
        const colX = ctx.x + col0Width + sessionColWidth * idx
        if (idx > 0) ctx.doc.line(colX, rowTop, colX, rowTop + rowHeight)
        ctx.doc.setFont('helvetica', 'normal')
        ctx.doc.setFontSize(7.8)
        ctx.doc.setTextColor(0, 0, 0)
        ctx.doc.text(sLines, colX + pad, rowTop + pad + 7)
      })
    }

    ctx.y = rowTop + rowHeight
  }

  // Rubric Table
  ctx.y += 14
  pdfSection(ctx, multiModel.multiLabels.rubricHeading)
  const rubricCol0 = Math.round(tableWidth * 0.55)
  const rubricCol1 = Math.round(tableWidth * 0.10)
  const rubricCol2 = Math.round(tableWidth * 0.10)
  const rubricCol3 = tableWidth - rubricCol0 - rubricCol1 - rubricCol2

  const drawRubricHeader = () => {
    pdfEnsure(ctx, 20)
    const top = ctx.y
    ctx.doc.setFillColor(241, 245, 249)
    ctx.doc.rect(ctx.x, top, tableWidth, 18, 'FD')
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.setFontSize(7.8)
    ctx.doc.setTextColor(0, 0, 0)
    ctx.doc.text(multiModel.multiLabels.rubricCriterion, ctx.x + 5, top + 12)
    ctx.doc.line(ctx.x + rubricCol0, top, ctx.x + rubricCol0, top + 18)
    ctx.doc.text(multiModel.multiLabels.yes, ctx.x + rubricCol0 + 12, top + 12)
    ctx.doc.line(ctx.x + rubricCol0 + rubricCol1, top, ctx.x + rubricCol0 + rubricCol1, top + 18)
    ctx.doc.text(multiModel.multiLabels.notYet, ctx.x + rubricCol0 + rubricCol1 + 7, top + 12)
    ctx.doc.line(ctx.x + rubricCol0 + rubricCol1 + rubricCol2, top, ctx.x + rubricCol0 + rubricCol1 + rubricCol2, top + 18)
    ctx.doc.text(multiModel.multiLabels.improvement, ctx.x + rubricCol0 + rubricCol1 + rubricCol2 + 5, top + 12)
    ctx.y = top + 18
  }
  drawRubricHeader()

  for (const item of multiModel.rubricItems) {
    const cLines = ctx.doc.splitTextToSize(item.criterion, rubricCol0 - 10) as string[]
    const rHeight = Math.max(18, cLines.length * 9 + 8)
    if (ctx.y + rHeight > ctx.bottom) {
      ctx.doc.addPage()
      ctx.y = 36
      drawRubricHeader()
    }
    const rTop = ctx.y
    ctx.doc.setDrawColor(120, 120, 120)
    ctx.doc.rect(ctx.x, rTop, tableWidth, rHeight)
    ctx.doc.line(ctx.x + rubricCol0, rTop, ctx.x + rubricCol0, rTop + rHeight)
    ctx.doc.line(ctx.x + rubricCol0 + rubricCol1, rTop, ctx.x + rubricCol0 + rubricCol1, rTop + rHeight)
    ctx.doc.line(ctx.x + rubricCol0 + rubricCol1 + rubricCol2, rTop, ctx.x + rubricCol0 + rubricCol1 + rubricCol2, rTop + rHeight)

    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setFontSize(7.8)
    ctx.doc.setTextColor(0, 0, 0)
    ctx.doc.text(cLines, ctx.x + 5, rTop + 11)

    if (item.status === 'yes') {
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.text('✓', ctx.x + rubricCol0 + 15, rTop + 12)
    } else if (item.status === 'not_yet') {
      ctx.doc.setFont('helvetica', 'bold')
      ctx.doc.text('✓', ctx.x + rubricCol0 + rubricCol1 + 15, rTop + 12)
    }

    ctx.y = rTop + rHeight
  }

  // Instructional coaching box
  ctx.y += 14
  pdfSection(ctx, multiModel.multiLabels.coachingHeading)
  pdfEnsure(ctx, 45)
  const coachTop = ctx.y
  ctx.doc.rect(ctx.x, coachTop, tableWidth, 40)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(7.8)
  if (multiModel.coachingNotes) ctx.doc.text(multiModel.coachingNotes, ctx.x + 6, coachTop + 12)
  ctx.doc.setFont('helvetica', 'italic')
  ctx.doc.setTextColor(90, 90, 90)
  ctx.doc.text(`${multiModel.multiLabels.coachingPlaceholder} ____________________________________________________________________________________________________`, ctx.x + 6, coachTop + 30)
  ctx.y = coachTop + 48

  if (multiModel.signatories.length) {
    pdfSection(ctx, multiModel.labels.signatures)
    pdfSignatoryGrid(ctx, multiModel.signatories)
  }

  const pageCount = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(multiModel.multiLabels.footer, margin, pageHeight - 16)
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' })
  }

  doc.save(`${safeFilename(`${multiModel.lesson.gradeLevel} ${multiModel.lesson.learningArea} - ${multiModel.lesson.title} - Daily Lesson Log`)}.pdf`)
}

export function downloadLessonPlanPdf(
  model: LessonPlanExportModel,
  preferences: TeacherExportPreferences,
) {
  if (model.templateLabel === 'Daily Lesson Log' && model.multiSession) {
    return downloadLessonPlanMultiSessionPdf(model.multiSession, preferences)
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: pdfFormat(preferences.paperSize), compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 54
  const ctx: PdfContext = { doc, x: margin, y: 54, width: pageWidth - margin * 2, bottom: pageHeight - 54 }
  const gradeAndSection = `${model.lesson.gradeLevel}${model.lesson.sections && model.lesson.sections !== 'Not specified' ? ` - ${model.lesson.sections}` : ''}`
  const sessionSummary = `${model.lesson.sessions} ${model.labels.sessionUnit}, ${model.lesson.duration}`

  pdfHeaderLine(ctx, model.labels.republic, { size: 8.5, gap: 12 })
  pdfHeaderLine(ctx, model.labels.department, { bold: true, size: 10, gap: 12 })
  pdfHeaderLine(ctx, model.identity.region, { size: 8.2, gap: 11 })
  pdfHeaderLine(ctx, model.identity.division, { size: 8.2, gap: 11 })
  pdfHeaderLine(ctx, model.identity.district, { size: 8.2, gap: 11 })
  pdfHeaderLine(ctx, model.identity.schoolName, { bold: true, size: 8.8, gap: 18 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(model.documentTitle, pageWidth / 2, ctx.y, { align: 'center' })
  ctx.y += 22

  pdfMetaRow(ctx, model.labels.teacher, model.identity.teacherName)
  pdfMetaRow(ctx, model.labels.gradeSection, gradeAndSection)
  pdfMetaRow(ctx, model.labels.learningArea, model.lesson.learningArea)
  pdfMetaRow(ctx, model.labels.lessonTitle, model.lesson.title)
  pdfMetaRow(ctx, model.labels.date, model.lesson.lessonDate)
  pdfMetaRow(ctx, model.labels.weekSchedule, model.lesson.weekLabel)
  pdfMetaRow(ctx, model.labels.schoolYear, model.lesson.schoolYear)
  pdfMetaRow(ctx, model.labels.gradingTerm, model.lesson.gradingTerm)
  pdfMetaRow(ctx, model.labels.curriculumPeriod, model.lesson.curriculumPeriod)
  pdfMetaRow(ctx, model.labels.sessionsDuration, sessionSummary)
  pdfMetaRow(ctx, model.labels.references, model.references)
  ctx.y += 10

  const groups: Array<[string, LessonPlanExportModel['ilaw'][keyof LessonPlanExportModel['ilaw']]]> = [
    [`I. ${model.labels.intentions}`, model.ilaw.intentions],
    [`L. ${model.labels.learningExperience}`, model.ilaw.learningExperience],
    [`A. ${model.labels.assessingLearning}`, model.ilaw.assessingLearning],
    [`W. ${model.labels.waysForward}`, model.ilaw.waysForward],
  ]
  for (const [heading, fields] of groups) {
    pdfSection(ctx, heading)
    for (const field of fields) pdfLabelBody(ctx, field.heading, field.body)
  }

  if (model.signatories.length) {
    pdfSection(ctx, model.labels.signatures)
    pdfSignatoryGrid(ctx, model.signatories)
  }

  const pageCount = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 22, { align: 'right' })
  }

  doc.save(lessonPlanExportFilename(model, 'pdf'))
}

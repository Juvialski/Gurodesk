export type CurriculumCatalogStatus = 'verified_competencies' | 'official_guide_catalogued' | 'official_family_catalogued' | 'transitional'

export type CurriculumCatalogTrack =
  | 'revised_k10'
  | 'legacy_k12'
  | 'sshs_core'
  | 'sshs_academic'
  | 'sshs_techpro'
  | 'sshs_grade12_new'
  | 'legacy_shs'

export type CurriculumCatalogEntry = {
  id: string
  curriculumCode: string
  curriculumName: string
  gradeLevel: string
  learningArea: string
  displayName: string
  group: string
  track: CurriculumCatalogTrack
  status: CurriculumCatalogStatus
  sourceTitle: string
  sourceUrl: string
  sourceAuthority: 'Department of Education'
  schoolYears: string[]
  notes: string
  aliases?: string[]
}

const MATATAG_PHASE1_URL = 'https://www.deped.gov.ph/matatagcurriculumk147/'
const REVISED_K10_PHASE2_URL = 'https://camiguin.deped.gov.ph/download/dm-no-0255-s-2025-rollout-training-of-the-revised-k-12-matatag-curriculum-phase-2-for-teachers-in-grades-235-8/'
const REVISED_K10_PHASE3_URL = 'https://region2.deped.gov.ph/regional-memorandum-no-163-s-2026-conduct-of-the-training-on-revised-grades-6-9-and-10-curriculum/'
const SSHS_URL = 'https://www.deped.gov.ph/strengthened-shs-program/'
const LEGACY_SHS_URL = 'https://lrmds.deped.gov.ph/'

const SCHOOL_YEAR_ORDER = ['2024-2025', '2025-2026', '2026-2027']
const CURRENT_SCHOOL_YEAR = ['2026-2027']

const K10_ROLLOUT_START: Record<string, string> = {
  Kindergarten: '2024-2025',
  'Grade 1': '2024-2025',
  'Grade 2': '2025-2026',
  'Grade 3': '2025-2026',
  'Grade 4': '2024-2025',
  'Grade 5': '2025-2026',
  'Grade 6': '2026-2027',
  'Grade 7': '2024-2025',
  'Grade 8': '2025-2026',
  'Grade 9': '2026-2027',
  'Grade 10': '2026-2027',
}

function schoolYearsFrom(start: string) {
  const index = SCHOOL_YEAR_ORDER.indexOf(start)
  return index >= 0 ? SCHOOL_YEAR_ORDER.slice(index) : CURRENT_SCHOOL_YEAR
}

const normalizeId = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

function k10Entry(
  gradeLevel: string,
  learningArea: string,
  options: Partial<Pick<CurriculumCatalogEntry, 'displayName' | 'group' | 'status' | 'notes' | 'aliases' | 'sourceUrl' | 'sourceTitle'>> = {},
): CurriculumCatalogEntry {
  const rolloutStart = K10_ROLLOUT_START[gradeLevel] ?? '2026-2027'
  const phase1 = rolloutStart === '2024-2025'
  const rolloutSourceUrl = phase1
    ? MATATAG_PHASE1_URL
    : rolloutStart === '2025-2026'
      ? REVISED_K10_PHASE2_URL
      : REVISED_K10_PHASE3_URL
  const rolloutSourceTitle = phase1
    ? 'DepEd MATATAG Curriculum Phase 1 Guides'
    : rolloutStart === '2025-2026'
      ? 'DepEd Revised K to 12 Curriculum Phase 2 rollout'
      : 'DepEd Revised K to 10 Curriculum Phase 3 rollout'
  return {
    id: `revised-k10-${normalizeId(gradeLevel)}-${normalizeId(learningArea)}`,
    curriculumCode: 'REVISED-K10-MATATAG',
    curriculumName: 'Revised K to 10 / MATATAG Curriculum',
    gradeLevel,
    learningArea,
    displayName: options.displayName ?? learningArea,
    group: options.group ?? 'Revised K to 10',
    track: 'revised_k10',
    status: options.status ?? (gradeLevel === 'Grade 7' && learningArea === 'Mathematics'
      ? 'verified_competencies'
      : phase1
        ? 'official_guide_catalogued'
        : 'official_family_catalogued'),
    sourceTitle: options.sourceTitle ?? rolloutSourceTitle,
    sourceUrl: options.sourceUrl ?? rolloutSourceUrl,
    sourceAuthority: 'Department of Education',
    schoolYears: schoolYearsFrom(rolloutStart),
    notes: options.notes ?? (gradeLevel === 'Grade 7' && learningArea === 'Mathematics'
      ? 'The complete Grade 7 Mathematics competency set is source-verified and bundled in GuroDesk.'
      : phase1
        ? 'The official curriculum guide is catalogued. Exact competency-level transcription remains source-gated until its guide is imported and verified.'
        : 'The revised curriculum family and grade rollout are catalogued from official DepEd issuances. Exact subject guide and competency transcription remain source-gated until the official guide is imported and verified.'),
    aliases: options.aliases,
  }
}

type K10EntryOptions = Parameters<typeof k10Entry>[2]
type K10SubjectDefinition = [learningArea: string, options?: K10EntryOptions]

const K10_BY_GRADE: Record<string, K10SubjectDefinition[]> = {
  Kindergarten: [
    ['Kindergarten', {
      displayName: 'Kindergarten Integrated Curriculum',
      notes: 'The official Kindergarten guide is catalogued as an integrated curriculum. GuroDesk keeps the guide together rather than inventing subject-level competency splits.',
    }],
  ],
  'Grade 1': [
    ['Language'],
    ['Reading and Literacy'],
    ['Mathematics'],
    ['Makabansa'],
    ['GMRC', { aliases: ['Good Manners and Right Conduct', 'Values Education / GMRC'] }],
  ],
  'Grade 2': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Makabansa'],
    ['GMRC', { aliases: ['Good Manners and Right Conduct', 'Values Education / GMRC'] }],
  ],
  'Grade 3': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Makabansa'],
    ['GMRC', { aliases: ['Good Manners and Right Conduct', 'Values Education / GMRC'] }],
  ],
  'Grade 4': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Araling Panlipunan'],
    ['MAPEH', { aliases: ['Music & Arts', 'Physical Education & Health'] }],
    ['EPP', { displayName: 'Edukasyong Pantahanan at Pangkabuhayan (EPP)', aliases: ['Edukasyong Pantahanan at Pangkabuhayan'] }],
    ['GMRC', { aliases: ['Good Manners and Right Conduct', 'Values Education / GMRC'] }],
  ],
  'Grade 5': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Araling Panlipunan'],
    ['MAPEH'],
    ['EPP', { displayName: 'Edukasyong Pantahanan at Pangkabuhayan (EPP)', aliases: ['Edukasyong Pantahanan at Pangkabuhayan'] }],
    ['GMRC', { aliases: ['Good Manners and Right Conduct', 'Values Education / GMRC'] }],
  ],
  'Grade 6': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Araling Panlipunan'],
    ['MAPEH'],
    ['EPP', { displayName: 'Edukasyong Pantahanan at Pangkabuhayan (EPP)', aliases: ['Edukasyong Pantahanan at Pangkabuhayan'] }],
    ['GMRC', { aliases: ['Good Manners and Right Conduct', 'Values Education / GMRC'] }],
  ],
  'Grade 7': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Araling Panlipunan'],
    ['MAPEH', { aliases: ['Music & Arts', 'Physical Education & Health'] }],
    ['TLE', { displayName: 'Technology and Livelihood Education (TLE)', aliases: ['Technology and Livelihood Education'] }],
    ['Values Education', { aliases: ['Values Education / GMRC', 'GMRC', 'ESP', 'Edukasyon sa Pagpapakatao'] }],
  ],
  'Grade 8': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Araling Panlipunan'],
    ['MAPEH'],
    ['TLE', { displayName: 'Technology and Livelihood Education (TLE)', aliases: ['Technology and Livelihood Education'] }],
    ['Values Education', { aliases: ['Values Education / GMRC', 'ESP', 'Edukasyon sa Pagpapakatao'] }],
  ],
  'Grade 9': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Araling Panlipunan'],
    ['MAPEH'],
    ['TLE', { displayName: 'Technology and Livelihood Education (TLE)', aliases: ['Technology and Livelihood Education'] }],
    ['Values Education', { aliases: ['Values Education / GMRC', 'ESP', 'Edukasyon sa Pagpapakatao'] }],
  ],
  'Grade 10': [
    ['English'],
    ['Filipino'],
    ['Mathematics'],
    ['Science'],
    ['Araling Panlipunan'],
    ['MAPEH'],
    ['TLE', { displayName: 'Technology and Livelihood Education (TLE)', aliases: ['Technology and Livelihood Education'] }],
    ['Values Education', { aliases: ['Values Education / GMRC', 'ESP', 'Edukasyon sa Pagpapakatao'] }],
  ],
}

const revisedK10Entries = Object.entries(K10_BY_GRADE).flatMap(([gradeLevel, subjects]) =>
  subjects.map(([learningArea, options]) => k10Entry(gradeLevel, learningArea, options)),
)

const LEGACY_K12_BY_GRADE: Record<string, string[]> = {
  'Grade 2': ['English', 'Filipino', 'Mathematics', 'Araling Panlipunan', 'MAPEH', 'Edukasyon sa Pagpapakatao', 'Mother Tongue'],
  'Grade 3': ['English', 'Filipino', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'Edukasyon sa Pagpapakatao', 'Mother Tongue'],
  'Grade 5': ['English', 'Filipino', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'EPP', 'Edukasyon sa Pagpapakatao'],
  'Grade 6': ['English', 'Filipino', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'EPP', 'Edukasyon sa Pagpapakatao'],
  'Grade 8': ['English', 'Filipino', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'TLE', 'Edukasyon sa Pagpapakatao'],
  'Grade 9': ['English', 'Filipino', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'TLE', 'Edukasyon sa Pagpapakatao'],
  'Grade 10': ['English', 'Filipino', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'TLE', 'Edukasyon sa Pagpapakatao'],
}

const LEGACY_YEARS_BY_GRADE: Record<string, string[]> = {
  'Grade 2': ['2024-2025'],
  'Grade 3': ['2024-2025'],
  'Grade 5': ['2024-2025'],
  'Grade 6': ['2024-2025', '2025-2026'],
  'Grade 8': ['2024-2025'],
  'Grade 9': ['2024-2025', '2025-2026'],
  'Grade 10': ['2024-2025', '2025-2026'],
}

const legacyK12Entries: CurriculumCatalogEntry[] = Object.entries(LEGACY_K12_BY_GRADE).flatMap(([gradeLevel, subjects]) => {
  const gradeNumber = gradeLevel.replace(/\D/g, '')
  return subjects.map((learningArea) => ({
    id: `legacy-k12-${normalizeId(gradeLevel)}-${normalizeId(learningArea)}`,
    curriculumCode: 'K12-LEGACY-TRANSITION',
    curriculumName: 'Existing K to 12 Curriculum (transition)',
    gradeLevel,
    learningArea,
    displayName: learningArea,
    group: 'Existing K to 12 · transition',
    track: 'legacy_k12' as const,
    status: 'transitional' as const,
    sourceTitle: `DepEd Learning Resource Portal — ${gradeLevel}`,
    sourceUrl: `https://lrmds.deped.gov.ph/grade/${gradeNumber}`,
    sourceAuthority: 'Department of Education' as const,
    schoolYears: LEGACY_YEARS_BY_GRADE[gradeLevel] ?? [],
    notes: 'This historical school-year selection predates the revised-curriculum rollout for this grade. The legacy learning area is catalogued for assignment compatibility; exact competencies remain source-gated unless a verified legacy manifest is imported.',
    aliases: learningArea === 'Edukasyon sa Pagpapakatao' ? ['ESP', 'Values Education'] : undefined,
  }))
})

function shsEntry(
  gradeLevel: 'Grade 11' | 'Grade 12',
  learningArea: string,
  group: string,
  track: Exclude<CurriculumCatalogTrack, 'revised_k10' | 'legacy_k12' | 'legacy_shs'>,
  notes = 'Official Strengthened Senior High School curriculum guide is catalogued. Competency-level transcription remains source-gated until its guide is imported and verified.',
): CurriculumCatalogEntry {
  return {
    id: `${track}-${normalizeId(gradeLevel)}-${normalizeId(learningArea)}`,
    curriculumCode: 'STRENGTHENED-SHS-2026',
    curriculumName: 'Strengthened Senior High School Curriculum',
    gradeLevel,
    learningArea,
    displayName: learningArea,
    group,
    track,
    status: 'official_guide_catalogued',
    sourceTitle: 'DepEd Strengthened Senior High School Program — Curriculum Guides',
    sourceUrl: SSHS_URL,
    sourceAuthority: 'Department of Education',
    schoolYears: CURRENT_SCHOOL_YEAR,
    notes,
  }
}

const SSHS_CORE = [
  'Mabisang Komunikasyon',
  'Effective Communication',
  'General Mathematics',
  'General Science',
  'Life and Career Skills',
  'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
]

const SSHS_ACADEMIC: Record<string, string[]> = {
  'Arts, Social Sciences, and Humanities': [
    'Arts 1 - Creative Industries: Visual Art, Literary Art, Media Art, Applied Art and Traditional Art',
    'Arts 2 - Creative Industries: Music, Dance and Theater',
    'Citizenship and Civic Engagement',
    'Contemporary Literature 1',
    'Contemporary Literature 2',
    'Creative Composition 1',
    'Creative Composition 2',
    'Filipino 1 - Wika at Komunikasyon sa Akademikong Filipino',
    'Filipino 2 - Filipino para sa Larang Teknikal Propesyonal',
    'Filipino 2 - Filipino sa Isports',
    'Filipino 2 - Filipino sa Sining at Disenyo',
    'Filipino Identity Through the Arts',
    'Introduction to Philosophy',
    'Leadership and Management in the Arts',
    'Malikhaing Pagsulat',
    'Philippine Governance / Philippine Politics and Governance',
    'Social Sciences Theory and Practice',
  ],
  'Business and Entrepreneurship': [
    'Business 1 - Basic Accounting',
    'Business 2 - Business Finance and Income Taxation',
    'Business 3 - Business Economics',
    'Contemporary Marketing',
    'Entrepreneurship',
    'Introduction to Organization and Management',
  ],
  'Science, Technology, Engineering, and Mathematics': [
    'Biology 1',
    'Biology 2',
    'Chemistry 1',
    'Chemistry 2',
    'Earth and Space Science 1',
    'Earth and Space Science 2',
    'Finite Mathematics 1',
    'Finite Mathematics 2',
    'Physics 1',
    'Physics 2',
  ],
  'Sports, Health, and Wellness': [
    'Human Movement 1 - Basic Anatomy in Sports and Exercise',
    'Human Movement 2 - Motor Skills Development',
    'Physical Education 1 - Fitness and Recreation',
    'Physical Education 2 - Sports and Dance',
    'Sports Activity Management',
    'Sports Coaching',
    'Sports Officiating',
  ],
}

const SSHS_TECHPRO: Record<string, string[]> = {
  'Aesthetic, Wellness, and Human Care': [
    'Aesthetic Services / Beauty Care',
    'Caregiving - Adult Care',
    'Caregiving - Child Care',
    'Hairdressing',
  ],
  'Agri-Fishery Business and Food Innovation': [
    'Agricultural Crops Production',
    'Agro-Entrepreneurship',
    'Aquaculture',
    'Fish Capture',
    'Food Processing',
    'Organic Agriculture Production',
    'Poultry Production - Chicken',
    'Ruminants Production',
    'Swine Production',
  ],
  'Artisanry and Creative Enterprise': [
    'Garments Artisanry',
    'Handicrafts (Weaving)',
  ],
  'Automotive and Small Engine Technologies': [
    'Automotive Servicing (Electrical Repair)',
    'Automotive Servicing (Engine and Chassis Repairs)',
    'Driving and Automotive Servicing',
    'Motorcycle and Small Engine Servicing',
  ],
  'Construction and Building Technology': [
    'Carpentry',
    'Construction Operation',
    'Manual Metal Arc Welding',
    'Technical Drafting',
  ],
  'Creative Arts and Design Technology': [
    'Animation',
    'Illustration',
    'Visual Graphic Design',
  ],
  'Hospitality and Tourism': [
    'Bakery Operations',
    'Events Management Services',
    'Food and Beverage Operation',
    'Hotel Operation (Front Office Services)',
    'Hotel Operation (Housekeeping Services)',
    'Kitchen Operations',
    'Tourism Services',
  ],
  'ICT Support and Computer Programming Technologies': [
    'Broadband Installation',
    'Computer Programming (.NET Technology)',
    'Computer Programming (Java)',
    'Computer Programming (Oracle Database)',
    'Computer Systems Servicing',
    'Contact Center Services',
  ],
  'Industrial Technologies': [
    'Commercial Air Conditioning Installation and Servicing',
    'Domestic Refrigeration and Air Conditioning Servicing',
    'Electrical Installation Maintenance',
    'Electronics Product Assembly and Servicing',
    'Mechatronics',
    'Photovoltaic Systems Installation',
  ],
  Maritime: [
    'Marine Engineering at the Support Level',
    'Marine Transportation at the Support Level',
    'Ships Catering Services',
  ],
}

const SSHS_GRADE12_NEW: Record<string, string[]> = {
  'Grade 12 · Arts, Social Sciences, and Humanities': [
    'Creative Production and Presentation',
  ],
  'Grade 12 · Science, Technology, Engineering, and Mathematics': [
    'Advanced Mathematics',
    'Basic Calculus',
    'Biology 3',
    'Biology 4',
    'Chemistry 3',
    'Chemistry 4',
    'Conceptual Biology and Earth and Space',
    'Conceptual Physics and Chemistry in Daily Life',
    'Database Management',
    'Earth and Space Science 3',
    'Earth and Space Science 4',
    'Empowerment Technologies',
    'Fundamentals of Data Analytics',
    'Physics 3',
    'Physics 4',
    'Pre-Calculus',
  ],
  'Grade 12 · Field Experience': [
    'Arts Apprenticeship - Dance',
    'Arts Apprenticeship - Literary Arts',
    'Arts Apprenticeship - Media Arts',
    'Arts Apprenticeship - Music',
    'Arts Apprenticeship - Theater Arts',
  ],
}

const shsCoreEntries = SSHS_CORE.map((subject) =>
  shsEntry('Grade 11', subject, 'Core Subjects', 'sshs_core'),
)

const shsAcademicEntries = Object.entries(SSHS_ACADEMIC).flatMap(([group, subjects]) =>
  subjects.map((subject) => shsEntry('Grade 11', subject, `Academic · ${group}`, 'sshs_academic')),
)

const shsTechProEntries = Object.entries(SSHS_TECHPRO).flatMap(([group, subjects]) =>
  subjects.map((subject) => shsEntry('Grade 11', subject, `TechPro · ${group}`, 'sshs_techpro')),
)

const shsGrade12NewEntries = Object.entries(SSHS_GRADE12_NEW).flatMap(([group, subjects]) =>
  subjects.map((subject) => shsEntry(
    'Grade 12',
    subject,
    group,
    'sshs_grade12_new',
    'Official new Grade 12 Strengthened SHS curriculum guide is catalogued. School applicability must follow current DepEd pilot/full-implementation rules.',
  )),
)

const legacyGrade12Entry: CurriculumCatalogEntry = {
  id: 'legacy-shs-grade12-non-pilot',
  curriculumCode: 'K12-SHS-LEGACY',
  curriculumName: 'Existing K to 12 Senior High School Curriculum',
  gradeLevel: 'Grade 12',
  learningArea: 'Legacy SHS subject (non-pilot school)',
  displayName: 'Legacy SHS subject (non-pilot school)',
  group: 'Transitional Grade 12',
  track: 'legacy_shs',
  status: 'transitional',
  sourceTitle: 'DepEd Learning Resource Portal — Existing K to 12 SHS Curriculum Guides',
  sourceUrl: LEGACY_SHS_URL,
  sourceAuthority: 'Department of Education',
  schoolYears: CURRENT_SCHOOL_YEAR,
  notes: 'For SY 2026-2027, Grade 12 learners in non-pilot schools continue under the existing SHS curriculum. Use this transition entry only when the school is not a Grade 12 Strengthened SHS pilot implementer.',
}

export const CURRICULUM_CATALOG: CurriculumCatalogEntry[] = [
  ...revisedK10Entries,
  ...legacyK12Entries,
  ...shsCoreEntries,
  ...shsAcademicEntries,
  ...shsTechProEntries,
  ...shsGrade12NewEntries,
  legacyGrade12Entry,
]

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en')
}

export function curriculumEntriesForGrade(gradeLevel: string, schoolYear = '2026-2027') {
  return CURRICULUM_CATALOG.filter((entry) =>
    entry.gradeLevel === gradeLevel && entry.schoolYears.includes(schoolYear),
  )
}

export function learningAreasForGrade(gradeLevel: string, schoolYear = '2026-2027') {
  return curriculumEntriesForGrade(gradeLevel, schoolYear)
    .map((entry) => entry.learningArea)
    .filter((value, index, array) => array.indexOf(value) === index)
}

export function findCurriculumCatalogEntry(gradeLevel: string, learningArea: string, schoolYear = '2026-2027') {
  const needle = normalized(learningArea)
  return curriculumEntriesForGrade(gradeLevel, schoolYear).find((entry) =>
    normalized(entry.learningArea) === needle
    || normalized(entry.displayName) === needle
    || (entry.aliases ?? []).some((alias) => normalized(alias) === needle),
  ) ?? null
}

export function curriculumCatalogGroups(gradeLevel: string, schoolYear = '2026-2027') {
  const grouped = new Map<string, CurriculumCatalogEntry[]>()
  for (const entry of curriculumEntriesForGrade(gradeLevel, schoolYear)) {
    const values = grouped.get(entry.group) ?? []
    values.push(entry)
    grouped.set(entry.group, values)
  }
  return [...grouped.entries()].map(([group, entries]) => ({ group, entries }))
}

export const CURRICULUM_CATALOG_STATS = {
  entries: CURRICULUM_CATALOG.length,
  revisedK10: revisedK10Entries.length,
  legacyK12Transition: legacyK12Entries.length,
  strengthenedShs: shsCoreEntries.length + shsAcademicEntries.length + shsTechProEntries.length + shsGrade12NewEntries.length,
  verifiedCompetencyPacks: CURRICULUM_CATALOG.filter((entry) => entry.status === 'verified_competencies').length,
}

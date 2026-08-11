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

const REVISED_K10_GUIDES_URL = 'https://bukidnon.deped.gov.ph/matatag-curriculum/'
const SSHS_URL = 'https://www.deped.gov.ph/strengthened-shs-program/'
const LRMDS_URL = 'https://lrmds.deped.gov.ph/'

const SCHOOL_YEAR_ORDER = ['2024-2025', '2025-2026', '2026-2027']
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

function normalizeId(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function schoolYearsFrom(start: string) {
  const index = SCHOOL_YEAR_ORDER.indexOf(start)
  return index >= 0 ? SCHOOL_YEAR_ORDER.slice(index) : ['2026-2027']
}

type K10Subject = { name: string; displayName?: string; aliases?: string[] }
const subject = (name: string, displayName?: string, aliases?: string[]): K10Subject => ({ name, displayName, aliases })

const K10_BY_GRADE: Record<string, K10Subject[]> = {
  Kindergarten: [subject('Kindergarten', 'Kindergarten Integrated Curriculum')],
  'Grade 1': [
    subject('Language'), subject('Reading and Literacy'), subject('Mathematics'), subject('Makabansa'),
    subject('GMRC', undefined, ['Good Manners and Right Conduct', 'Values Education / GMRC']),
  ],
  'Grade 2': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Makabansa'),
    subject('GMRC', undefined, ['Good Manners and Right Conduct', 'Values Education / GMRC']),
  ],
  'Grade 3': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Makabansa'),
    subject('GMRC', undefined, ['Good Manners and Right Conduct', 'Values Education / GMRC']),
  ],
  'Grade 4': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Araling Panlipunan'),
    subject('MAPEH', undefined, ['Music & Arts', 'Physical Education & Health']),
    subject('EPP', 'Edukasyong Pantahanan at Pangkabuhayan (EPP)', ['Edukasyong Pantahanan at Pangkabuhayan']),
    subject('GMRC', undefined, ['Good Manners and Right Conduct', 'Values Education / GMRC']),
  ],
  'Grade 5': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Araling Panlipunan'), subject('MAPEH'),
    subject('EPP', 'Edukasyong Pantahanan at Pangkabuhayan (EPP)', ['Edukasyong Pantahanan at Pangkabuhayan']),
    subject('GMRC', undefined, ['Good Manners and Right Conduct', 'Values Education / GMRC']),
  ],
  'Grade 6': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Araling Panlipunan'), subject('MAPEH'),
    subject('EPP', 'Edukasyong Pantahanan at Pangkabuhayan (EPP)', ['Edukasyong Pantahanan at Pangkabuhayan']),
    subject('GMRC', undefined, ['Good Manners and Right Conduct', 'Values Education / GMRC']),
  ],
  'Grade 7': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Araling Panlipunan'),
    subject('MAPEH', undefined, ['Music & Arts', 'Physical Education & Health']),
    subject('TLE', 'Technology and Livelihood Education (TLE)', ['Technology and Livelihood Education']),
    subject('Values Education', undefined, ['Values Education / GMRC', 'GMRC', 'ESP', 'Edukasyon sa Pagpapakatao']),
  ],
  'Grade 8': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Araling Panlipunan'), subject('MAPEH'),
    subject('TLE', 'Technology and Livelihood Education (TLE)', ['Technology and Livelihood Education']),
    subject('Values Education', undefined, ['Values Education / GMRC', 'ESP', 'Edukasyon sa Pagpapakatao']),
  ],
  'Grade 9': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Araling Panlipunan'), subject('MAPEH'),
    subject('TLE', 'Technology and Livelihood Education (TLE)', ['Technology and Livelihood Education']),
    subject('Values Education', undefined, ['Values Education / GMRC', 'ESP', 'Edukasyon sa Pagpapakatao']),
  ],
  'Grade 10': [
    subject('English'), subject('Filipino'), subject('Mathematics'), subject('Science'), subject('Araling Panlipunan'), subject('MAPEH'),
    subject('TLE', 'Technology and Livelihood Education (TLE)', ['Technology and Livelihood Education']),
    subject('Values Education', undefined, ['Values Education / GMRC', 'ESP', 'Edukasyon sa Pagpapakatao']),
  ],
}

function revisedEntry(gradeLevel: string, item: K10Subject): CurriculumCatalogEntry {
  const start = K10_ROLLOUT_START[gradeLevel] ?? '2026-2027'
  return {
    id: `revised-k10-${normalizeId(gradeLevel)}-${normalizeId(item.name)}`,
    curriculumCode: 'REVISED-K10-MATATAG',
    curriculumName: 'Revised K to 10 / MATATAG Curriculum',
    gradeLevel,
    learningArea: item.name,
    displayName: item.displayName ?? item.name,
    group: 'Revised K to 10',
    track: 'revised_k10',
    status: 'verified_competencies',
    sourceTitle: 'DepEd MATATAG / Revised K to 10 Curriculum Guides',
    sourceUrl: REVISED_K10_GUIDES_URL,
    sourceAuthority: 'Department of Education',
    schoolYears: schoolYearsFrom(start),
    notes: 'The complete official competency set is source-verified, page-pinned, and bundled in GuroDesk.',
    aliases: item.aliases,
  }
}

const revisedK10Entries = Object.entries(K10_BY_GRADE).flatMap(([grade, items]) => items.map((item) => revisedEntry(grade, item)))

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
  'Grade 2': ['2024-2025'], 'Grade 3': ['2024-2025'], 'Grade 5': ['2024-2025'], 'Grade 6': ['2024-2025', '2025-2026'],
  'Grade 8': ['2024-2025'], 'Grade 9': ['2024-2025', '2025-2026'], 'Grade 10': ['2024-2025', '2025-2026'],
}
const legacyK12Entries: CurriculumCatalogEntry[] = Object.entries(LEGACY_K12_BY_GRADE).flatMap(([gradeLevel, areas]) => areas.map((learningArea) => ({
  id: `legacy-k12-${normalizeId(gradeLevel)}-${normalizeId(learningArea)}`,
  curriculumCode: 'K12-LEGACY-TRANSITION',
  curriculumName: 'Existing K to 12 Curriculum (transition)',
  gradeLevel,
  learningArea,
  displayName: learningArea,
  group: 'Existing K to 12 · transition',
  track: 'legacy_k12',
  status: 'transitional',
  sourceTitle: `DepEd Learning Resource Portal — ${gradeLevel}`,
  sourceUrl: `${LRMDS_URL}grade/${gradeLevel.replace(/\D/g, '')}`,
  sourceAuthority: 'Department of Education',
  schoolYears: LEGACY_YEARS_BY_GRADE[gradeLevel] ?? [],
  notes: 'Historical pre-rollout selection retained for assignment compatibility. Exact legacy competencies remain source-gated unless a verified manifest is imported.',
  aliases: learningArea === 'Edukasyon sa Pagpapakatao' ? ['ESP', 'Values Education'] : undefined,
})))

function shsEntry(
  gradeLevel: 'Grade 11' | 'Grade 12',
  learningArea: string,
  group: string,
  track: Extract<CurriculumCatalogTrack, 'sshs_core' | 'sshs_academic' | 'sshs_techpro' | 'sshs_grade12_new'>,
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
    status: 'verified_competencies',
    sourceTitle: 'DepEd Strengthened Senior High School Program — Curriculum Guides',
    sourceUrl: SSHS_URL,
    sourceAuthority: 'Department of Education',
    schoolYears: ['2026-2027'],
    notes: 'The complete official competency set is source-verified, page-pinned, and bundled in GuroDesk.',
  }
}

const SSHS_CORE = [
  'Mabisang Komunikasyon', 'Effective Communication', 'General Mathematics', 'General Science', 'Life and Career Skills',
  'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
]
const SSHS_ACADEMIC: Record<string, string[]> = {
  'Arts, Social Sciences, and Humanities': [
    'Arts 1 - Creative Industries: Visual Art, Literary Art, Media Art, Applied Art and Traditional Art',
    'Arts 2 - Creative Industries: Music, Dance and Theater', 'Citizenship and Civic Engagement', 'Contemporary Literature 1',
    'Contemporary Literature 2', 'Creative Composition 1', 'Creative Composition 2',
    'Filipino 1 - Wika at Komunikasyon sa Akademikong Filipino', 'Filipino 2 - Filipino para sa Larang Teknikal Propesyonal',
    'Filipino 2 - Filipino sa Isports', 'Filipino 2 - Filipino sa Sining at Disenyo', 'Filipino Identity Through the Arts',
    'Introduction to Philosophy', 'Leadership and Management in the Arts', 'Malikhaing Pagsulat',
    'Philippine Governance / Philippine Politics and Governance', 'Social Sciences Theory and Practice',
  ],
  'Business and Entrepreneurship': [
    'Business 1 - Basic Accounting', 'Business 2 - Business Finance and Income Taxation', 'Business 3 - Business Economics',
    'Contemporary Marketing', 'Entrepreneurship', 'Introduction to Organization and Management',
  ],
  'Science, Technology, Engineering, and Mathematics': [
    'Biology 1', 'Biology 2', 'Chemistry 1', 'Chemistry 2', 'Earth and Space Science 1', 'Earth and Space Science 2',
    'Finite Mathematics 1', 'Finite Mathematics 2', 'Physics 1', 'Physics 2',
  ],
  'Sports, Health, and Wellness': [
    'Human Movement 1 - Basic Anatomy in Sports and Exercise', 'Human Movement 2 - Motor Skills Development',
    'Physical Education 1 - Fitness and Recreation', 'Physical Education 2 - Sports and Dance', 'Sports Activity Management',
    'Sports Coaching', 'Sports Officiating',
  ],
}
const SSHS_TECHPRO: Record<string, string[]> = {
  'Aesthetic, Wellness, and Human Care': ['Aesthetic Services / Beauty Care', 'Caregiving - Adult Care', 'Caregiving - Child Care', 'Hairdressing'],
  'Agri-Fishery Business and Food Innovation': [
    'Agricultural Crops Production', 'Agro-Entrepreneurship', 'Aquaculture', 'Fish Capture', 'Food Processing',
    'Organic Agriculture Production', 'Poultry Production - Chicken', 'Ruminants Production', 'Swine Production',
  ],
  'Artisanry and Creative Enterprise': ['Garments Artisanry', 'Handicrafts (Weaving)'],
  'Automotive and Small Engine Technologies': [
    'Automotive Servicing (Electrical Repair)', 'Automotive Servicing (Engine and Chassis Repairs)', 'Driving and Automotive Servicing',
    'Motorcycle and Small Engine Servicing',
  ],
  'Construction and Building Technology': ['Carpentry', 'Construction Operation', 'Manual Metal Arc Welding', 'Technical Drafting'],
  'Creative Arts and Design Technology': ['Animation', 'Illustration', 'Visual Graphic Design'],
  'Hospitality and Tourism': [
    'Bakery Operations', 'Events Management Services', 'Food and Beverage Operation', 'Hotel Operation (Front Office Services)',
    'Hotel Operation (Housekeeping Services)', 'Kitchen Operations', 'Tourism Services',
  ],
  'ICT Support and Computer Programming Technologies': [
    'Broadband Installation', 'Computer Programming (.NET Technology)', 'Computer Programming (Java)',
    'Computer Programming (Oracle Database)', 'Computer Systems Servicing', 'Contact Center Services',
  ],
  'Industrial Technologies': [
    'Commercial Air Conditioning Installation and Servicing', 'Domestic Refrigeration and Air Conditioning Servicing',
    'Electrical Installation Maintenance', 'Electronics Product Assembly and Servicing', 'Mechatronics', 'Photovoltaic Systems Installation',
  ],
  Maritime: ['Marine Engineering at the Support Level', 'Marine Transportation at the Support Level', 'Ships Catering Services'],
}
const SSHS_GRADE12_NEW: Record<string, string[]> = {
  'Arts, Social Sciences, and Humanities': ['Creative Production and Presentation'],
  'Science, Technology, Engineering, and Mathematics': [
    'Advanced Mathematics', 'Basic Calculus', 'Biology 3', 'Biology 4', 'Chemistry 3', 'Chemistry 4',
    'Conceptual Biology and Earth and Space', 'Conceptual Physics and Chemistry in Daily Life', 'Database Management',
    'Earth and Space Science 3', 'Earth and Space Science 4', 'Empowerment Technologies', 'Fundamentals of Data Analytics',
    'Physics 3', 'Physics 4', 'Pre-Calculus',
  ],
  'Field Experience / Arts Apprenticeship': [
    'Arts Apprenticeship - Dance', 'Arts Apprenticeship - Literary Arts', 'Arts Apprenticeship - Media Arts',
    'Arts Apprenticeship - Music', 'Arts Apprenticeship - Theater Arts',
  ],
}

const shsCoreEntries = SSHS_CORE.map((name) => shsEntry('Grade 11', name, 'Core Subjects', 'sshs_core'))
const shsAcademicEntries = Object.entries(SSHS_ACADEMIC).flatMap(([group, names]) => names.map((name) => shsEntry('Grade 11', name, `Academic · ${group}`, 'sshs_academic')))
const shsTechProEntries = Object.entries(SSHS_TECHPRO).flatMap(([group, names]) => names.map((name) => shsEntry('Grade 11', name, `TechPro · ${group}`, 'sshs_techpro')))
const shsGrade12NewEntries = Object.entries(SSHS_GRADE12_NEW).flatMap(([group, names]) => names.map((name) => shsEntry('Grade 12', name, `Grade 12 · ${group}`, 'sshs_grade12_new')))
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
  sourceUrl: LRMDS_URL,
  sourceAuthority: 'Department of Education',
  schoolYears: ['2026-2027'],
  notes: 'For SY 2026-2027, this represents the existing SHS curriculum path for a Grade 12 class that is not using a Strengthened SHS Grade 12 pilot/new-guide offering.',
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

function normalized(value: string) { return value.trim().toLocaleLowerCase('en') }

export function curriculumEntriesForGrade(gradeLevel: string, schoolYear = '2026-2027') {
  return CURRICULUM_CATALOG.filter((entry) => entry.gradeLevel === gradeLevel && entry.schoolYears.includes(schoolYear))
}

export function learningAreasForGrade(gradeLevel: string, schoolYear = '2026-2027') {
  return curriculumEntriesForGrade(gradeLevel, schoolYear).map((entry) => entry.learningArea).filter((value, index, array) => array.indexOf(value) === index)
}

export function findCurriculumCatalogEntry(gradeLevel: string, learningArea: string, schoolYear = '2026-2027') {
  const needle = normalized(learningArea)
  return curriculumEntriesForGrade(gradeLevel, schoolYear).find((entry) => normalized(entry.learningArea) === needle
    || normalized(entry.displayName) === needle
    || (entry.aliases ?? []).some((alias) => normalized(alias) === needle)) ?? null
}

export function curriculumCatalogGroups(gradeLevel: string, schoolYear = '2026-2027') {
  const groups = new Map<string, CurriculumCatalogEntry[]>()
  for (const entry of curriculumEntriesForGrade(gradeLevel, schoolYear)) {
    const values = groups.get(entry.group) ?? []
    values.push(entry)
    groups.set(entry.group, values)
  }
  return [...groups.entries()].map(([group, entries]) => ({ group, entries }))
}

export const CURRICULUM_CATALOG_STATS = {
  entries: CURRICULUM_CATALOG.length,
  revisedK10: revisedK10Entries.length,
  legacyK10: legacyK12Entries.length,
  strengthenedShs: shsCoreEntries.length + shsAcademicEntries.length + shsTechProEntries.length + shsGrade12NewEntries.length,
  verifiedCompetencyPacks: CURRICULUM_CATALOG.filter((entry) => entry.status === 'verified_competencies').length,
}

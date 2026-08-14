#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(path, 'utf8')
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`${label}: missing ${needle}`)
}

const [
  appType,
  schoolType,
  schoolHelpers,
  schoolRepository,
  picker,
  css,
  migration,
  repository,
  lessonType,
  lessonExport,
  tosType,
  tosExport,
  tosDocx,
  tosTemplate,
  assessmentType,
  assessmentModel,
  assessmentPresentation,
  assessmentPreview,
  documentTemplate,
  docxTemplate,
] = await Promise.all([
  read('src/types/app.ts'),
  read('src/types/school.ts'),
  read('src/lib/schoolDirectory.ts'),
  read('src/lib/schoolDirectoryRepository.ts'),
  read('src/components/SchoolPicker.tsx'),
  read('src/school-directory.css'),
  read('supabase/migrations/202608140040_school_district_identity.sql'),
  read('src/lib/repository.ts'),
  read('src/types/export.ts'),
  read('src/lib/lessonPlanExport.ts'),
  read('src/types/tosExport.ts'),
  read('src/lib/tosExport.ts'),
  read('src/lib/tosDocxExport.ts'),
  read('src/types/tosTemplate.ts'),
  read('src/types/assessmentExport.ts'),
  read('src/lib/assessmentExportModel.ts'),
  read('src/lib/assessmentExportPresentation.ts'),
  read('src/pages/AssessmentPrintPreviewPage.tsx'),
  read('src/types/documentTemplate.ts'),
  read('src/lib/docxTemplate.ts'),
])

requireText(appType, 'districtVerified?: boolean', 'Profile type')
requireText(repository, 'district_verified: profile.districtVerified', 'Profile persistence')
requireText(schoolType, 'districtName: string | null', 'School type')
requireText(schoolType, 'offset?: number', 'Paged school search type')
requireText(schoolHelpers, "districtSource: 'deped_official'", 'Verified district identity')
requireText(schoolHelpers, "districtSource: district ? 'manual' : 'unknown'", 'Manual district identity')
requireText(schoolRepository, "search_philippine_schools_v2", 'Paged school RPC')
requireText(schoolRepository, 'p_offset:', 'Paged school offset')
requireText(schoolRepository, 'loadSchoolDistricts', 'District repository')
requireText(picker, 'Load more schools', 'A-Z pagination UX')
requireText(picker, 'Verified School ID → District mapping is not loaded', 'District fallback UX')
requireText(css, 'height: auto !important', 'Mobile result row auto-height')
requireText(css, 'overflow-wrap: anywhere', 'Long school-name wrapping')
requireText(migration, 'district_source_url', 'District provenance schema')
requireText(migration, 'list_philippine_school_districts', 'District list RPC')
requireText(migration, 'search_philippine_schools_v2', 'Paged district search RPC')
requireText(migration, "'districtVerified'", 'Historical district snapshot')
requireText(lessonType, 'district: string', 'Lesson export identity')
requireText(lessonExport, 'district: clean(profile.district)', 'Lesson export district')
requireText(lessonExport, 'model.identity.district', 'Lesson document district header')
requireText(tosType, 'district: string', 'TOS export identity')
requireText(tosExport, 'district: clean(profile.district)', 'TOS export district')
requireText(tosDocx, "['Schools Division', model.identity.division, 'District', model.identity.district]", 'TOS DOCX district')
requireText(tosTemplate, "'district'", 'TOS template district')
requireText(assessmentType, 'district?: string', 'Assessment export option')
requireText(assessmentModel, 'district: clean(options.district)', 'Assessment export district')
requireText(assessmentPresentation, "role: 'district'", 'Assessment district header')
requireText(assessmentPreview, "district: profile.district ?? ''", 'Assessment preview district')
requireText(documentTemplate, "| 'district'", 'Lesson template district key')
requireText(docxTemplate, 'district: model.identity.district', 'Custom DOCX district value')

console.log('✓ School district + mobile A-Z contract passed')

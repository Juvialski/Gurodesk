import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { AssessmentDocumentView } from '../../src/components/AssessmentDocumentView'
import { buildAssessmentDocxBlob, buildAssessmentPdf, buildAssessmentPrintModel, assessmentPrintHtml } from '../../src/lib/assessmentExport'
import { buildAssessmentAnswerKeyExportModel, buildAssessmentStudentExportModel, buildAssessmentTeacherExportModel } from '../../src/lib/assessmentExportModel'
import { assessmentPaperCanonicalSignature, buildAssessmentPaperPresentation } from '../../src/lib/assessmentExportPresentation'
import { ASSESSMENT_QUESTION_TYPES } from '../../src/types/assessment'
import { buildTest4Assessment } from '../fixtures/test4Assessment'

const exportOptions = {
  teacherName: 'Maria L. Santos',
  schoolName: 'GuroDesk Integrated School',
  region: 'National Capital Region',
  division: 'Schools Division of Manila',
  learnerName: '',
  section: '',
}

function xmlText(zip: PizZip, name: string) {
  return zip.file(name)?.asText() ?? ''
}

describe('canonical Test 4 assessment paper', () => {
  it('contains exactly 20 questions, 41 points, all 11 types, and five visuals', () => {
    const assessment = buildTest4Assessment()
    expect(assessment.items).toHaveLength(20)
    expect(assessment.items.reduce((sum, item) => sum + item.pointsPossible, 0)).toBe(41)
    expect([...new Set(assessment.items.map((item) => item.questionType))]).toEqual([...ASSESSMENT_QUESTION_TYPES])
    expect(assessment.items.filter((item) => item.visual)).toHaveLength(5)
  })

  it('drives preview and browser print from one renderer-neutral hierarchy', () => {
    const assessment = buildTest4Assessment()
    for (const model of [
      buildAssessmentStudentExportModel(assessment, exportOptions),
      buildAssessmentTeacherExportModel(assessment, { ...exportOptions, includeAnswer: true, includeCompetency: true, includeCognitiveCategory: true, includeRationale: true }),
      buildAssessmentAnswerKeyExportModel(assessment, exportOptions),
    ]) {
      const canonical = buildAssessmentPaperPresentation(model)
      expect(assessmentPaperCanonicalSignature(buildAssessmentPrintModel(model))).toEqual(assessmentPaperCanonicalSignature(canonical))
      expect(canonical.header.identityLines.map((line) => line.text)).toEqual([
        'Republic of the Philippines',
        'Department of Education',
        'National Capital Region',
        'Schools Division of Manila',
        'GuroDesk Integrated School',
      ])
      expect(canonical.sections.flatMap((section) => section.questions)).toHaveLength(20)

      const preview = renderToStaticMarkup(<AssessmentDocumentView model={model} showCompetency showCognitive showRationale />)
      const print = assessmentPrintHtml(model)
      expect(preview).toContain('data-paper-model="assessment-paper-v1"')
      expect(print).toContain('data-paper-model="assessment-paper-v1"')
      expect(preview).toContain(canonical.header.documentTitle)
      expect(print).toContain(canonical.header.documentTitle)
      expect(preview).toContain('GuroDesk Integrated School')
      expect(print).toContain('GuroDesk Integrated School')
      for (const section of canonical.sections) {
        if (!section.title) continue
        expect(preview).toContain(section.title)
        expect(print).toContain(section.title)
      }
    }
  })

  it('applies the same section, response-space, and localization policies', () => {
    const assessment = buildTest4Assessment()
    const student = buildAssessmentStudentExportModel(assessment, exportOptions)
    const paper = buildAssessmentPaperPresentation(student)
    expect(paper.sections).toHaveLength(11)
    expect(paper.sections.map((section) => section.questionType)).toEqual([...ASSESSMENT_QUESTION_TYPES])
    expect(paper.sections.map((section) => section.title)).toEqual([
      'Part I - Multiple Choice',
      'Part II - True or False',
      'Part III - Short Answer',
      'Part IV - Constructed Response',
      'Part V - Identification',
      'Part VI - Fill in the Blank',
      'Part VII - Numerical Answer',
      'Part VIII - Problem Solving',
      'Part IX - Matching Type',
      'Part X - Multiple Select',
      'Part XI - Essay / Extended Response',
    ])
    const questions = paper.sections.flatMap((section) => section.questions)
    expect(questions.filter((question) => question.questionType === 'short_answer').every((question) => question.response.lines === 2)).toBe(true)
    expect(questions.find((question) => question.questionType === 'true_false')?.response.trueFalseLabels).toEqual(['True', 'False'])
    expect(questions.find((question) => question.questionType === 'numerical_answer')?.response.unitLabel).toBe('Unit')
    expect(questions.find((question) => question.questionType === 'essay')?.response.lines).toBeGreaterThanOrEqual(7)

    const filipino = buildAssessmentStudentExportModel(assessment, { ...exportOptions, documentLanguage: 'filipino' })
    const filipinoQuestions = buildAssessmentPaperPresentation(filipino).sections.flatMap((section) => section.questions)
    expect(filipinoQuestions.find((question) => question.questionType === 'true_false')?.response.trueFalseLabels).toEqual(['Tama', 'Mali'])
    expect(filipinoQuestions.find((question) => question.questionType === 'numerical_answer')?.response.unitLabel).toBe('Yunit')
  })

  it('renders canonical continuation headers, section titles, and visuals in PDF and DOCX', async () => {
    const model = buildAssessmentStudentExportModel(buildTest4Assessment(), exportOptions)
    const paper = buildAssessmentPaperPresentation(model)
    const pdf = buildAssessmentPdf(model, 'a4')
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    const pageOperators = ((pdf.internal as unknown as { pages: string[][] }).pages ?? []).flat().join('\n')
    expect(pageOperators).toContain('ASSESSMENT')
    expect(pageOperators).toContain('continued')
    expect(pageOperators).toContain('Part I - Multiple Choice')
    expect(pageOperators).toContain('Part XI - Essay / Extended Response')
    expect(pageOperators).toMatch(/\bre\b|\bm\b/u)

    const docx = await buildAssessmentDocxBlob(model, 'a4')
    const zip = new PizZip(await docx.arrayBuffer())
    const documentXml = xmlText(zip, 'word/document.xml')
    const headerXml = Object.keys(zip.files).filter((name) => /^word\/header\d+\.xml$/u.test(name)).map((name) => xmlText(zip, name)).join('\n')
    expect(documentXml).toContain('Republic of the Philippines')
    expect(documentXml).toContain('Department of Education')
    expect(documentXml).toContain('GuroDesk Integrated School')
    for (const section of paper.sections) expect(documentXml).toContain(section.title)
    expect(headerXml).toContain(paper.header.continuationDocumentTitle)
    expect(headerXml).toContain(paper.header.continuationAssessmentTitle)
    expect(Object.keys(zip.files).filter((name) => /^word\/media\/.+\.svg$/u.test(name))).toHaveLength(5)
    expect(documentXml).toContain('<w:drawing>')
    expect(documentXml).toContain('<w:cantSplit/>')
    expect(documentXml).toContain('<w:pBdr>')
    expect(documentXml).toContain('<w:bottom')
  })

  it('keeps every renderer wired to the canonical presentation builder', () => {
    const exportSource = readFileSync(new URL('../../src/lib/assessmentExport.ts', import.meta.url), 'utf8')
    const previewSource = readFileSync(new URL('../../src/components/AssessmentDocumentView.tsx', import.meta.url), 'utf8')
    expect(exportSource.match(/buildAssessmentPaperPresentation\(/gu)?.length).toBeGreaterThanOrEqual(4)
    expect(previewSource).toMatch(/const paper = buildAssessmentPaperPresentation\(model\)/u)
  })
})

import PizZip from 'pizzip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { wordMaster, workbookMaster } from '../fixtures/mailMergeFixtures'
import { inspectMailMerge, mergeWord, mergeWorkbook } from '../../src/lib/mailMerge'
import { fillDocxTemplate } from '../../src/lib/docxTemplate'
import { openOfficeArchive } from '../../src/lib/officeArchive'

beforeAll(() => {
  vi.stubGlobal('DOMParser', DOMParser); vi.stubGlobal('XMLSerializer', XMLSerializer)
  const prototype = Object.getPrototypeOf(new DOMParser().parseFromString('<root/>', 'application/xml').documentElement)
  Object.defineProperty(prototype, 'children', { configurable: true, get() { return Array.from(this.childNodes as NodeListOf<ChildNode>).filter(node => node.nodeType === 1) } })
})
const data = { fields: { school_name: 'Barangay Sample School', teacher_name: 'Fixture Teacher', district: 'Manual District' }, rows: { questions: [{ number: 1, prompt: 'What is 2 + 2?', options: 'A. 3\nB. 4' }, { number: 2, prompt: 'State a property.', options: 'Write your response.' }] }, audience: 'student' as const }

describe('real OOXML teacher-layout merge fixtures', () => {
  it('repeats formatted Word rows, merges split-run fields and headers/footers, and preserves master/media/styles', async () => {
    const master = await wordMaster(); const original = new PizZip(master)
    const output = new PizZip(await mergeWord(master, data).arrayBuffer())
    const xml = output.file('word/document.xml')!.asText()
    expect(xml).toContain('Barangay Sample School'); expect(xml).toContain('What is 2 + 2?'); expect(xml).toContain('State a property.'); expect(xml).not.toContain('{{')
    expect(xml).toContain('<w:b'); expect(xml).toContain('<w:i'); expect(xml).toContain('<w:u'); expect(xml).toContain('superscript'); expect(xml).toContain('subscript'); expect(xml).toContain('<w:br')
    expect(xml).toContain('<m:oMath>'); expect(xml).toContain('x + 2 = 5')
    expect(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('w:tr').length).toBe(2)
    for (const name of Object.keys(original.files).filter(name => /media\/|styles.xml|numbering.xml|\.rels$/.test(name))) expect(output.file(name)?.asUint8Array()).toEqual(original.file(name)?.asUint8Array())
    expect(output.file('word/header1.xml')!.asText()).toContain('Manual District')
    expect(output.file('word/footer1.xml')!.asText()).toContain('Fixture Teacher')
    expect(new PizZip(master).file('word/document.xml')!.asText()).toBe(original.file('word/document.xml')!.asText())
    expect(inspectMailMerge(master, 'docx')).toContainEqual({ key: 'prompt', group: 'questions' })
  })
  it('repairs legacy label mapping without deleting mixed runs, signature blocks or drawings', async () => {
    const master = await wordMaster()
    const output = new PizZip(await fillDocxTemplate(master, [{ fieldKey: 'schoolName', elementId: 'p0', locator: { kind: 'body_paragraph', paragraphIndex: 0 }, mode: 'replace', confidence: 1 }], { schoolName: 'Mapped School' }).arrayBuffer())
    const xml = output.file('word/document.xml')!.asText()
    expect(xml).toContain('Mapped School'); expect(xml).toContain('School: '); expect(xml).toContain('Student copy'); expect(xml).toContain('Signature: ')
    expect(xml).toContain('<w:i'); expect(xml).toContain('<w:u')
  })
  it('fills existing workbook rows and preserves formulas, print areas, secondary sheets and rich styles', async () => {
    const master = workbookMaster(); const original = new PizZip(master)
    const output = new PizZip(await mergeWorkbook(master, data).arrayBuffer())
    const xml = output.file('xl/worksheets/sheet1.xml')!.asText()
    expect(xml).toContain('Barangay Sample School'); expect(xml).toContain('What is 2 + 2?'); expect(xml).toContain('State a property.'); expect(xml).not.toContain('{{')
    expect(xml).toContain('<f>SUM(B3:B4)</f>'); expect(xml).toContain('<f>1+1</f>'); expect(xml).toContain('ref="A1:C1"'); expect(xml).toContain('width="22"'); expect(xml).toContain('ht="24"'); expect(xml).toContain('<b/>'); expect(xml).toContain('<i/>')
    expect(output.file('xl/worksheets/sheet2.xml')!.asText()).toBe(original.file('xl/worksheets/sheet2.xml')!.asText())
    expect(output.file('xl/styles.xml')!.asText()).toBe(original.file('xl/styles.xml')!.asText())
    expect(output.file('xl/workbook.xml')!.asText()).toContain('TOS!$A$1:$C$8')
    expect(inspectMailMerge(master, 'xlsx')).toContainEqual({ key: 'prompt', group: 'questions' })
  })
  it('refuses overflow, missing fields, unclosed blocks and answer fields in student output', async () => {
    expect(() => mergeWorkbook(workbookMaster(), { ...data, rows: { questions: [...data.rows.questions, data.rows.questions[0]] } })).toThrow('styled rows')
    expect(() => mergeWorkbook(workbookMaster(), { ...data, fields: {} })).toThrow('Unfilled')
    expect(() => mergeWord(workbookMaster(), data)).toThrow('parts are missing')
    expect(() => mergeWorkbook(workbookMaster(), { ...data, fields: { ...data.fields, answer_key: 'B' } })).toThrow('Student copies')
  })
  it('exports numeric destinations as numeric Excel cells and preserves text identifiers', async () => {
    const zip = new PizZip(workbookMaster())
    zip.file('xl/worksheets/sheet1.xml', zip.file('xl/worksheets/sheet1.xml')!.asText().replaceAll('{{prompt}}', '{{points}}'))
    const master = zip.generate({ type: 'arraybuffer' })
    const output = new PizZip(await mergeWorkbook(master, { ...data, rows: { questions: [{ points: 3 }, { points: 4 }] } }).arrayBuffer())
    expect(output.file('xl/worksheets/sheet1.xml')!.asText()).toMatch(/r="A3"[^>]*t="n"[^>]*><v>3<\/v>/)
    expect(output.file('xl/worksheets/sheet1.xml')!.asText()).toMatch(/r="A4"[^>]*t="n"[^>]*><v>4<\/v>/)
  })
  it('rejects macros, entity declarations, broken external relationships and actual archive expansion attacks', () => {
    for (const [name, content] of [['xl/vbaProject.bin', 'macro'], ['xl/evil.xml', '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///C:/private">]><x>&x;</x>'], ['xl/_rels/bad.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="bad" Target="file:///private" TargetMode="External" Type="image"/></Relationships>']] as const) {
      const zip = new PizZip(workbookMaster()); zip.file(name, content)
      expect(() => openOfficeArchive(zip.generate({ type: 'arraybuffer' }), 'xlsx')).toThrow()
    }
    const bomb = new PizZip(workbookMaster()); bomb.file('xl/bomb.xml', ' '.repeat(5 * 1024 * 1024))
    expect(() => openOfficeArchive(bomb.generate({ type: 'arraybuffer', compression: 'DEFLATE' }), 'xlsx')).toThrow()
    const broken = new PizZip(workbookMaster()); broken.remove('xl/worksheets/sheet2.xml')
    expect(() => openOfficeArchive(broken.generate({ type: 'arraybuffer' }), 'xlsx')).toThrow('broken')
  })
  it('refuses Strict Word XML instead of mixing incompatible namespaces in a filled document', async () => {
    const zip = new PizZip(await wordMaster())
    zip.file('word/document.xml', zip.file('word/document.xml')!.asText().replaceAll('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main'))
    expect(() => openOfficeArchive(zip.generate({ type: 'arraybuffer' }), 'docx')).toThrow('Strict or unsupported')
  })
})

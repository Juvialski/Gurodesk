import { describe, expect, it } from 'vitest'
import { previewRosterCsv, previewRosterTabularRows, type TabularRows } from '../../src/lib/resultsImport'

describe('Phases 6 & 7 — Roster Drag-and-Drop & Paste Learner Names', () => {
  it('parses pasted multiline names with whitespace trimming and skips empty lines', () => {
    const rawPastedText = `
      Dela Cruz, Juan M.   
      
      Santos, Maria A.
      
      Aquino, Paolo B.
    `
    const cleanNames = rawPastedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(cleanNames).toEqual([
      'Dela Cruz, Juan M.',
      'Santos, Maria A.',
      'Aquino, Paolo B.',
    ])

    const tabular: TabularRows = {
      headers: ['Learner Name'],
      rows: cleanNames.map((name) => [name]),
      source: 'csv',
    }

    const preview = previewRosterTabularRows(tabular, {
      sectionName: 'Rizal',
      existingLearners: [],
    })

    expect(preview.ready).toBe(true)
    expect(preview.rows.length).toBe(3)
    expect(preview.rows[0].displayName).toBe('Dela Cruz, Juan M.')
    expect(preview.rows[1].displayName).toBe('Santos, Maria A.')
    expect(preview.rows[2].displayName).toBe('Aquino, Paolo B.')
    expect(preview.mapping['Learner Name']).toBe('display_name')
  })

  it('detects duplicate display names in pasted or dropped rosters', () => {
    const csvContent = `Learner Name,Ref
Juan Dela Cruz,A1
Juan Dela Cruz,A2
Maria Santos,A3`

    const preview = previewRosterCsv(csvContent, {
      sectionName: 'Rizal',
      existingLearners: [],
    })

    expect(preview.rows[0].status).toBe('ready')
    expect(preview.rows[1].status).toBe('duplicate')
    expect(preview.rows[2].status).toBe('ready')
    expect(preview.rows[1].messages.some((msg) => msg.includes('duplicates'))).toBe(true)
  })
})

describe('Phase 8 — SF1 & Composite Name Roster Mapping', () => {
  it('correctly maps various learner header variants including DepEd SF1 labels', () => {
    const sf1Variants = [
      'Name',
      'Learner Name',
      'Student Name',
      "Learner's Name",
      'Learner Name (Last, First Middle)',
      'Display Name',
      'Full Name',
      'Pangalan',
    ]

    for (const headerName of sf1Variants) {
      const csv = `"${headerName}"\n"Cruz, Juan"\n"Santos, Maria"`
      const preview = previewRosterCsv(csv, { sectionName: 'Diamond' })
      expect(preview.mapping[headerName]).toBe('display_name')
      expect(preview.rows.length).toBe(2)
      expect(preview.rows[0].displayName).toBe('Cruz, Juan')
    }
  })
})

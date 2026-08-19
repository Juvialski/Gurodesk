import type { AnswerSheetDefinition, AnswerSheetPageLayout } from '../../types/answerSheet'

/**
 * Renders a single AnswerSheetPageLayout into a pure, standalone SVG vector string.
 */
export function renderAnswerSheetPageSvg(
  sheet: AnswerSheetDefinition,
  page: AnswerSheetPageLayout,
): string {
  const { widthMm, heightMm } = page.dimensionsMm
  const fiducials = page.fiducialMarkers

  const rawGrade = String(sheet.gradeLevel || '').trim()
  const gradeLabel = rawGrade
    ? rawGrade.toLowerCase().startsWith('grade')
      ? rawGrade
      : `Grade ${rawGrade}`
    : ''

  const totalPoints = page.items.reduce((acc, item) => {
    return acc + (item.manualBox?.pointsPossible || 1)
  }, 0)

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthMm} ${heightMm}" width="${widthMm}mm" height="${heightMm}mm" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">`

  // 1. Page Background & Border
  svg += `<rect x="0" y="0" width="${widthMm}" height="${heightMm}" fill="#ffffff" />`

  // 2. Corner Fiducial Markers
  const renderFiducial = (f: typeof fiducials.topLeft) => {
    const x = f.centerMm.xMm - f.sizeMm / 2
    const y = f.centerMm.yMm - f.sizeMm / 2
    const centerInnerSize = f.sizeMm * 0.36
    const innerX = f.centerMm.xMm - centerInnerSize / 2
    const innerY = f.centerMm.yMm - centerInnerSize / 2
    return `
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${f.sizeMm}" height="${f.sizeMm}" fill="#000000" />
      <rect x="${innerX.toFixed(2)}" y="${innerY.toFixed(2)}" width="${centerInnerSize.toFixed(2)}" height="${centerInnerSize.toFixed(2)}" fill="#ffffff" />
    `
  }

  svg += renderFiducial(fiducials.topLeft)
  svg += renderFiducial(fiducials.topRight)
  svg += renderFiducial(fiducials.bottomLeft)
  svg += renderFiducial(fiducials.bottomRight)

  // 3. Header Text & Assessment Details (Clean & Professional)
  const hx = page.headerBoundsMm.xMm
  const hy = page.headerBoundsMm.yMm
  svg += `
    <g transform="translate(${hx}, ${hy})">
      <text x="0" y="3.2" font-size="2.6" font-weight="900" fill="#0f172a" letter-spacing="0.2">${escapeXml(sheet.assessmentTitle)} — ANSWER SHEET</text>
      <text x="0" y="6.4" font-size="1.8" font-weight="600" fill="#475569">${escapeXml(sheet.learningArea)}${gradeLabel ? ` · ${escapeXml(gradeLabel)}` : ''}${sheet.gradingTermLabel ? ` · ${escapeXml(sheet.gradingTermLabel)}` : ''}${sheet.schoolYear ? ` (${escapeXml(sheet.schoolYear)})` : ''}</text>
    </g>
  `

  // 4. Learner Info Line (Ultra-compact & sleek)
  const lx = page.learnerBoxBoundsMm.xMm
  const ly = page.learnerBoxBoundsMm.yMm
  const lw = page.learnerBoxBoundsMm.widthMm
  const lh = page.learnerBoxBoundsMm.heightMm

  if (sheet.mode === 'personalized' && sheet.learner) {
    svg += `
      <g transform="translate(${lx}, ${ly})">
        <rect x="0" y="0" width="${lw}" height="${lh}" rx="1" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.25" />
        <text x="2" y="3.6" font-size="1.7" font-weight="700" fill="#334155">STUDENT: <tspan font-weight="800" fill="#0f172a">${escapeXml(sheet.learner.displayName)}</tspan> · SEC: <tspan font-weight="700" fill="#334155">${escapeXml(sheet.sectionName || 'Assigned')}</tspan> · LRN: <tspan font-weight="600" fill="#64748b">${escapeXml(sheet.learner.localReference || '—')}</tspan> · SCORE: <tspan font-weight="700" fill="#334155">____ / ${totalPoints}</tspan></text>
      </g>
    `
  } else {
    svg += `
      <g transform="translate(${lx}, ${ly})">
        <text x="0" y="3.6" font-size="1.7" font-weight="700" fill="#334155">NAME:</text>
        <line x1="15" y1="4.0" x2="${lw - 58}" y2="4.0" stroke="#94a3b8" stroke-width="0.3" />
        <text x="${lw - 54}" y="3.6" font-size="1.7" font-weight="700" fill="#334155">SEC:</text>
        <line x1="${lw - 47}" y1="4.0" x2="${lw - 28}" y2="4.0" stroke="#94a3b8" stroke-width="0.3" />
        <text x="${lw - 24}" y="3.6" font-size="1.7" font-weight="700" fill="#334155">SCORE:</text>
        <line x1="${lw - 14}" y1="4.0" x2="${lw}" y2="4.0" stroke="#94a3b8" stroke-width="0.3" />
      </g>
    `
  }

  // 5. QR Code Region (Compact 13mm)
  const qrx = page.qrCode.boundsMm.xMm
  const qry = page.qrCode.boundsMm.yMm
  const qrw = page.qrCode.boundsMm.widthMm
  const qrh = page.qrCode.boundsMm.heightMm

  svg += `
    <g transform="translate(${qrx}, ${qry})">
      <rect x="-0.5" y="-0.5" width="${qrw + 1}" height="${qrh + 1}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.2" rx="0.5" />
      <path d="${page.qrCode.svgPath}" fill="#000000" />
      <text x="${qrw / 2}" y="${qrh + 1.8}" font-size="1.2" font-weight="700" fill="#64748b" text-anchor="middle">v1·${sheet.mode === 'personalized' ? 'ROSTER' : 'GENERIC'}</text>
    </g>
  `

  // 6. Subtle Marking Instructions Hint
  const hintY = ly + lh + 2.2
  svg += `
    <g transform="translate(${lx}, ${hintY})">
      <text x="0" y="0" font-size="1.3" font-weight="500" fill="#64748b">Shade bubbles completely: <tspan font-weight="800" fill="#0f172a">●</tspan> (not <tspan fill="#dc2626">✕</tspan> or <tspan fill="#dc2626">✓</tspan>)</text>
    </g>
  `

  // 7. Render Item Regions & Bubbles
  for (const item of page.items) {
    const ib = item.boundsMm
    const numLabel = item.itemNumber < 10 ? `0${item.itemNumber}` : `${item.itemNumber}`

    // Item row container
    svg += `<g transform="translate(${ib.xMm}, ${ib.yMm})">`

    // Question Number
    svg += `<text x="0" y="${(ib.heightMm / 2 + 0.7).toFixed(2)}" font-size="2.0" font-weight="800" fill="#1e293b" text-anchor="start">${escapeXml(numLabel)}.</text>`

    // Bubbles
    if (item.bubbles && item.bubbles.length > 0) {
      for (const b of item.bubbles) {
        const cx = (b.centerMm.xMm - ib.xMm).toFixed(2)
        const cy = (b.centerMm.yMm - ib.yMm).toFixed(2)
        const r = b.radiusMm.toFixed(2)
        svg += `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#1e293b" stroke-width="0.35" />
          <text x="${cx}" y="${(Number(cy) + 0.6).toFixed(2)}" font-size="1.6" font-weight="700" fill="#1e293b" text-anchor="middle">${escapeXml(b.label)}</text>
        `
      }
    } else if (item.matchingPrompts && item.matchingPrompts.length > 0) {
      // Matching sub-prompt rows
      for (const prompt of item.matchingPrompts) {
        for (const b of prompt.bubbles) {
          const cx = (b.centerMm.xMm - ib.xMm).toFixed(2)
          const cy = (b.centerMm.yMm - ib.yMm).toFixed(2)
          const r = b.radiusMm.toFixed(2)
          svg += `
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#1e293b" stroke-width="0.35" />
            <text x="${cx}" y="${(Number(cy) + 0.6).toFixed(2)}" font-size="1.5" font-weight="700" fill="#1e293b" text-anchor="middle">${escapeXml(b.label)}</text>
          `
        }
      }
    } else if (item.manualBox) {
      // Manual / Teacher-Scored Box
      const mb = item.manualBox.boundsMm
      const mx = (mb.xMm - ib.xMm).toFixed(2)
      const my = (mb.yMm - ib.yMm).toFixed(2)
      const mw = mb.widthMm.toFixed(2)
      const mh = mb.heightMm.toFixed(2)

      svg += `
        <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="0.6" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.2" stroke-dasharray="0.8 0.5" />
        <text x="${(Number(mx) + 1.5).toFixed(2)}" y="${(Number(my) + Number(mh) / 2 + 0.5).toFixed(2)}" font-size="1.4" font-weight="600" fill="#64748b">Teacher Scored</text>
        <text x="${(Number(mx) + Number(mw) - 1.5).toFixed(2)}" y="${(Number(my) + Number(mh) / 2 + 0.5).toFixed(2)}" font-size="1.4" font-weight="700" fill="#475569" text-anchor="end">[  / ${item.manualBox.pointsPossible} pt]</text>
      `
    }

    svg += `</g>`
  }

  // 8. Footer Info (Minimal)
  const footerX = fiducials.bottomLeft.centerMm.xMm - fiducials.bottomLeft.sizeMm / 2 + 1
  svg += `
    <g transform="translate(${footerX.toFixed(2)}, ${heightMm - 2})">
      <text x="0" y="0" font-size="1.1" font-weight="500" fill="#94a3b8">ID: ${escapeXml(sheet.assessmentId)} · v${sheet.assessmentVersionNumber} · Scannable OMR</text>
    </g>
  `

  svg += `</svg>`
  return svg
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generates a full printable HTML document containing one or multiple answer sheets.
 */
export function generatePrintableAnswerSheetsHtml(sheets: AnswerSheetDefinition[]): string {
  if (!sheets.length) return ''
  const paperSize = sheets[0].paperSize || 'a4'

  const pagesHtml = sheets.flatMap((sheet) => {
    return sheet.pages.map((page) => {
      const svg = renderAnswerSheetPageSvg(sheet, page)
      return `<div class="sheet-page">${svg}</div>`
    })
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GuroDesk Smart Answer Sheets</title>
  <style>
    @page {
      size: ${paperSize};
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    .sheet-page {
      background: #ffffff;
      margin: 12px auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      page-break-after: always;
      break-after: page;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .sheet-page svg {
      display: block;
      width: 100%;
      height: auto;
    }
    @media print {
      html, body {
        background: transparent;
        margin: 0;
        padding: 0;
      }
      .sheet-page {
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        break-after: page;
      }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`
}

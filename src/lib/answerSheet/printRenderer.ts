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

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthMm} ${heightMm}" width="${widthMm}mm" height="${heightMm}mm" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">`

  // 1. Page Background & Border
  svg += `<rect x="0" y="0" width="${widthMm}" height="${heightMm}" fill="#ffffff" />`

  // 2. Corner Fiducial Markers
  const renderFiducial = (f: typeof fiducials.topLeft) => {
    const x = f.centerMm.xMm - f.sizeMm / 2
    const y = f.centerMm.yMm - f.sizeMm / 2
    const centerInnerSize = f.sizeMm * 0.35
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

  // 3. Header Text & Assessment Details
  const hx = page.headerBoundsMm.xMm
  const hy = page.headerBoundsMm.yMm
  svg += `
    <g transform="translate(${hx}, ${hy})">
      <text x="0" y="3.5" font-size="3.2" font-weight="900" fill="#0f172a" letter-spacing="0.3">GURODESK SMART ANSWER SHEET</text>
      <text x="0" y="7.5" font-size="2.6" font-weight="700" fill="#1e293b">${escapeXml(sheet.assessmentTitle)}</text>
      <text x="0" y="11.2" font-size="2.1" font-weight="500" fill="#64748b">${escapeXml(sheet.learningArea)} · Grade ${escapeXml(sheet.gradeLevel)} · ${escapeXml(sheet.gradingTermLabel)} ${sheet.schoolYear ? `(${escapeXml(sheet.schoolYear)})` : ''}</text>
    </g>
  `

  // 4. Learner Info Box
  const lx = page.learnerBoxBoundsMm.xMm
  const ly = page.learnerBoxBoundsMm.yMm
  const lw = page.learnerBoxBoundsMm.widthMm
  const lh = page.learnerBoxBoundsMm.heightMm

  svg += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.3" />`

  if (sheet.mode === 'personalized' && sheet.learner) {
    svg += `
      <g transform="translate(${lx + 2.5}, ${ly + 4})">
        <text x="0" y="0" font-size="2.0" font-weight="700" fill="#475569">STUDENT:</text>
        <text x="14" y="0" font-size="2.4" font-weight="800" fill="#0f172a">${escapeXml(sheet.learner.displayName)}</text>
        <text x="0" y="4.2" font-size="1.9" font-weight="600" fill="#64748b">SECTION: <tspan font-weight="700" fill="#334155">${escapeXml(sheet.sectionName || 'Assigned Section')}</tspan> · <tspan fill="#059669">PRE-ASSIGNED ROSTER SHEET</tspan></text>
      </g>
    `
  } else {
    svg += `
      <g transform="translate(${lx + 2.5}, ${ly + 4})">
        <text x="0" y="0" font-size="1.9" font-weight="700" fill="#475569">STUDENT NAME:</text>
        <line x1="18" y1="0.5" x2="${lw - 40}" y2="0.5" stroke="#94a3b8" stroke-width="0.3" />
        <text x="${lw - 36}" y="0" font-size="1.9" font-weight="700" fill="#475569">DATE:</text>
        <line x1="${lw - 28}" y1="0.5" x2="${lw - 4}" y2="0.5" stroke="#94a3b8" stroke-width="0.3" />
        <text x="0" y="4.5" font-size="1.9" font-weight="700" fill="#475569">GRADE &amp; SEC:</text>
        <line x1="16" y1="5.0" x2="${lw - 4}" y2="5.0" stroke="#94a3b8" stroke-width="0.3" />
      </g>
    `
  }

  // 5. QR Code Region
  const qrx = page.qrCode.boundsMm.xMm
  const qry = page.qrCode.boundsMm.yMm
  const qrw = page.qrCode.boundsMm.widthMm
  const qrh = page.qrCode.boundsMm.heightMm

  svg += `
    <g transform="translate(${qrx}, ${qry})">
      <rect x="-1" y="-1" width="${qrw + 2}" height="${qrh + 2}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.2" rx="1" />
      <path d="${page.qrCode.svgPath}" fill="#000000" />
      <text x="${qrw / 2}" y="${qrh + 2.6}" font-size="1.6" font-weight="700" fill="#64748b" text-anchor="middle">LAYOUT v1 · ${sheet.mode === 'personalized' ? 'ROSTER' : 'GENERIC'}</text>
    </g>
  `

  // 6. Marking Instructions Banner
  const bannerY = ly + lh + 1.8
  svg += `
    <g transform="translate(${lx}, ${bannerY})">
      <text x="0" y="2.0" font-size="1.7" font-weight="600" fill="#64748b">INSTRUCTIONS: Fill bubbles completely with dark pen or 2B pencil: <tspan font-weight="800" fill="#0f172a">●</tspan> (not <tspan fill="#dc2626">✕</tspan> or <tspan fill="#dc2626">✓</tspan>). Keep page clean and uncreased.</text>
    </g>
  `

  // 7. Render Item Regions & Bubbles
  for (const item of page.items) {
    const ib = item.boundsMm
    const numLabel = item.itemNumber < 10 ? `0${item.itemNumber}` : `${item.itemNumber}`

    // Item row container
    svg += `<g transform="translate(${ib.xMm}, ${ib.yMm})">`

    // Question Number
    svg += `<text x="0" y="${(ib.heightMm / 2 + 0.8).toFixed(2)}" font-size="2.3" font-weight="800" fill="#1e293b" text-anchor="start">${escapeXml(numLabel)}.</text>`

    // Bubbles
    if (item.bubbles && item.bubbles.length > 0) {
      for (const b of item.bubbles) {
        const cx = (b.centerMm.xMm - ib.xMm).toFixed(2)
        const cy = (b.centerMm.yMm - ib.yMm).toFixed(2)
        const r = b.radiusMm.toFixed(2)
        svg += `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#1e293b" stroke-width="0.35" />
          <text x="${cx}" y="${(Number(cy) + 0.7).toFixed(2)}" font-size="1.8" font-weight="700" fill="#1e293b" text-anchor="middle">${escapeXml(b.label)}</text>
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
            <text x="${cx}" y="${(Number(cy) + 0.7).toFixed(2)}" font-size="1.7" font-weight="700" fill="#1e293b" text-anchor="middle">${escapeXml(b.label)}</text>
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
        <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="0.8" fill="#f1f5f9" stroke="#94a3b8" stroke-width="0.25" stroke-dasharray="1 0.6" />
        <text x="${(Number(mx) + 2).toFixed(2)}" y="${(Number(my) + Number(mh) / 2 + 0.6).toFixed(2)}" font-size="1.6" font-weight="600" fill="#64748b">Teacher Scored</text>
        <text x="${(Number(mx) + Number(mw) - 2).toFixed(2)}" y="${(Number(my) + Number(mh) / 2 + 0.6).toFixed(2)}" font-size="1.6" font-weight="700" fill="#475569" text-anchor="end">[  / ${item.manualBox.pointsPossible} pt]</text>
      `
    }

    svg += `</g>`
  }

  // 8. Footer Info
  const footerX = fiducials.bottomLeft.centerMm.xMm - fiducials.bottomLeft.sizeMm / 2 + 2
  const footerY = heightMm - (fiducials.bottomLeft.centerMm.yMm - fiducials.bottomLeft.sizeMm / 2) + 4
  svg += `
    <g transform="translate(${footerX.toFixed(2)}, ${heightMm - 8})">
      <text x="0" y="0" font-size="1.6" font-weight="500" fill="#94a3b8">GuroDesk Assessment ID: ${escapeXml(sheet.assessmentId)} · Version ${sheet.assessmentVersionNumber} · Scannable OMR Sheet</text>
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

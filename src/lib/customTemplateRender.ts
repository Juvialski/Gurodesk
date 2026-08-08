import { renderAsync } from 'docx-preview'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function renderDocxBlob(blob: Blob, container: HTMLElement) {
  container.innerHTML = ''
  await renderAsync(blob, container, container, {
    className: 'gurodesk-custom-docx',
    inWrapper: true,
    breakPages: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
  })
}

function mm(px: number) {
  return px * 25.4 / 96
}

export async function customDocxPreviewToPdf(container: HTMLElement, filename: string) {
  const pages = Array.from(container.querySelectorAll<HTMLElement>('section.gurodesk-custom-docx'))
  if (!pages.length) throw new Error('The custom template preview has no rendered pages.')

  let pdf: jsPDF | null = null
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    const canvas = await html2canvas(page, {
      scale: 1.7,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    const width = mm(page.getBoundingClientRect().width || 794)
    const height = mm(page.getBoundingClientRect().height || 1123)
    const orientation = width > height ? 'landscape' : 'portrait'
    if (!pdf) pdf = new jsPDF({ orientation, unit: 'mm', format: [width, height], compress: true })
    else pdf.addPage([width, height], orientation)
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, width, height, undefined, 'FAST')
  }
  pdf?.save(filename)
}

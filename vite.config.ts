import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('docx') || id.includes('pizzip') || id.includes('docx-preview')) return 'vendor-docx'
            if (id.includes('xlsx')) return 'vendor-xlsx'
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
          }
        },
      },
    },
  },
})

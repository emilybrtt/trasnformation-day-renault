import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O .env fica na raiz do monorepo (um só, documentado em .env.example), não
  // dentro de apps/web — sem isso o Vite não acha as variáveis VITE_* (mesmo
  // problema que o Prisma tinha com o DATABASE_URL, achado testando a Fase D).
  envDir: '../../',
  server: {
    port: 5173,
  },
})

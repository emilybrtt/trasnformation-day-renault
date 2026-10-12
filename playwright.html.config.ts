import { defineConfig } from '@playwright/test'

// Config isolada para o plano B da demo (HTML autocontido, sem servidor/API).
// Não usa o webServer do playwright.config.ts (que sobe o apps/web) de propósito:
// este arquivo testa só docs/design/Portal Pagamentos Jurídico.html via file://.
export default defineConfig({
  testDir: './e2e-html',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    viewport: { width: 1440, height: 1000 },
  },
})

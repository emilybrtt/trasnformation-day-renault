import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // O job de e2e do CI não sobe a API separadamente (só Postgres + emulador
      // do Auth) — o Playwright precisa subir ela mesmo pro roteiro da demo
      // conseguir fazer requisições de verdade.
      command: 'npm run dev -w @gavve/api',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Build + `vite preview` em vez de `vite dev`: o dev server compila cada
      // módulo sob demanda (sem bundling) e isso é lento o bastante numa
      // runner compartilhada do CI pra o grafo inteiro da SPA (React, router,
      // zod, react-hook-form...) estourar os 30s de timeout mesmo com o
      // healthcheck HTTP já respondendo — achado vendo o job de e2e do CI
      // falhar sem nenhum erro, só timeout esperando o botão de login
      // aparecer. `vite preview` serve o bundle de produção já pronto, o que
      // é instantâneo e também mais fiel ao ambiente real do deploy.
      command: 'npm run build -w @gavve/web && npm run preview -w @gavve/web -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})

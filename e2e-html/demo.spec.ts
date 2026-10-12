import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plano B da demo: docs/design/Portal Pagamentos Jurídico.html é um arquivo HTML
// autocontido (sem build, sem API). Este teste abre o arquivo direto via file://
// e exercita o roteiro único (docs/ROTEIRO_DEMO.md): escritório envia -> semáforo
// da analista -> chamado/rateio (um para cada um dos 3 fluxos) -> pagamento ->
// dashboard -> assistente.

const HTML_PATH = path.resolve(__dirname, '..', 'docs', 'design', 'Portal Pagamentos Jurídico.html')
const SHOTS_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots', 'html')
const FILE_URL = 'file://' + HTML_PATH

test.beforeAll(() => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
})

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, name), fullPage: true })
}

const jsErrorsByPage = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  jsErrorsByPage.set(page, errors)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(FILE_URL)
})

test.afterEach(async ({ page }) => {
  const errors = jsErrorsByPage.get(page) ?? []
  expect(errors, 'nenhum erro de JS deve ocorrer durante o roteiro').toEqual([])
})

test('login mostra os 3 perfis', async ({ page }) => {
  await expect(page.locator('[data-login="c"]')).toBeVisible()
  await expect(page.locator('[data-login="o"]')).toBeVisible()
  await expect(page.locator('[data-login="d"]')).toBeVisible()
  await shot(page, '01-login.png')
})

test('escritório envia uma requisição (passo 1 do roteiro)', async ({ page }) => {
  await page.click('[data-login="c"]')
  await expect(page.locator('h1:visible')).toContainText('suas requisições')
  await shot(page, '02-escritorio-inicio.png')

  await page.click('[data-nav="c-new"]')
  await page.click('[data-act="sample"]')
  await shot(page, '03-escritorio-form-preenchido.png')

  await page.click('button[type=submit]')
  await expect(page.locator('.dhead .eyebrow').first()).toBeVisible()
  await shot(page, '04-escritorio-requisicao-enviada.png')
})

test('semáforo da analista: validar e devolver (passo 2 do roteiro)', async ({ page }) => {
  await page.click('[data-login="o"]')
  await expect(page.locator('h1:visible')).toContainText('fila')
  await shot(page, '05-operador-fila.png')

  // filtro por tipo de fluxo
  await page.selectOption('#of-fluxo', 'RBS_DD')
  await shot(page, '06-operador-fila-filtro-fluxo.png')
  await page.selectOption('#of-fluxo', 'Todos')

  // abre uma requisição "novo" e devolve (mostra o caminho de devolução)
  await page.fill('#of-q', 'RQ-2026-0162')
  await page.click('[data-oopen="RQ-2026-0162"]')
  await expect(page.locator('.dec .dh h2')).toContainText('decisão')
  await shot(page, '07-operador-validacao.png')
  await page.click('[data-act="nao"]')
  await page.click('[data-dcat="Anexo faltando"]')
  await page.fill('#d-txt', 'Falta o termo de acordo homologado. Reenvie com o anexo.')
  await shot(page, '08-operador-devolucao.png')
  await page.click('[data-act="devolver"]')
  await expect(page.locator('#layer .toast')).toContainText('devolvida')
})

test('3 fluxos: RBS_DD, ANEXO_V e RC_HONORARIOS até o pagamento (passos 3 e 4)', async ({
  page,
}) => {
  async function runFlow(
    id: string,
    fluxoLabel: string,
    stepTitle: string,
    chamadoVal: string,
    lbs: string,
    shotPrefix: string,
  ) {
    await page.click('[data-nav="o-fila"]')
    await page.fill('#of-q', id)
    await page.click(`[data-oopen="${id}"]`)
    const checks = page.locator('[data-dchk]')
    const n = await checks.count()
    for (let i = 0; i < n; i++) await checks.nth(i).click()
    await page.click('[data-act="validar"]')
    await expect(page.locator('.crumbs')).toContainText('Pacote SSC')
    await expect(page.locator('.step h2').nth(1)).toContainText(stepTitle)
    await shot(page, `${shotPrefix}-01-pacote-ssc-${fluxoLabel}.png`)

    await page.fill('#s-ch', chamadoVal)
    await page.click('[data-act="chamado"]')
    await expect(page.locator('.apibox.ok b').last()).toBeVisible({ timeout: 2000 })
    await shot(page, `${shotPrefix}-02-registrado-${fluxoLabel}.png`)

    await page.fill('#s-lbs', lbs)
    await page.fill('#s-dt', '2026-10-12')
    await page.setInputFiles('#s-cp', {
      name: 'comprovante.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 comprovante fictício de teste'),
    })
    await page.click('[data-act="pagar"]')
    await page.waitForTimeout(1100) // integração simulada (~900ms)

    const status = await page.evaluate((rid) => {
      type PortalRow = { id: string; status: string }
      const w = window as unknown as { __portalData?: () => PortalRow[] }
      const rows = w.__portalData ? w.__portalData() : []
      return rows.find((r) => r.id === rid)?.status
    }, id)
    expect(status).toBe('Pago')
  }

  await page.click('[data-login="o"]')

  await runFlow(
    'RQ-2026-0166',
    'RC_HONORARIOS',
    'enviar a NF no Portal 0800',
    '0800-654321',
    '4500177001',
    '09',
  )
  await runFlow(
    'RQ-2026-0165',
    'ANEXO_V',
    'preencher o Anexo V no portal SSC',
    'AV-654321',
    '4500177002',
    '10',
  )
  await runFlow(
    'RQ-2026-0163',
    'RBS_DD',
    'abrir chamado no portal SSC',
    '2026-654321',
    '4500177003',
    '11',
  )
})

test('dashboard do dono do fluxo: filtros, KPIs, gráficos e exportação (passo 5)', async ({
  page,
}) => {
  await page.click('[data-login="d"]')
  await expect(page.locator('h1:visible')).toContainText('fluxo de pagamentos')
  await shot(page, '12-dono-painel.png')

  // novos filtros
  await page.click('#f-fluxo button[data-v="RC_HONORARIOS"]')
  await shot(page, '13-dono-painel-filtro-fluxo.png')
  await page.click('#f-fluxo button[data-v="todos"]')
  await page.selectOption('#f-firm', { index: 1 })
  await page.selectOption('#f-firm', 'todos')

  // novos gráficos/tabelas existem e renderizam algo
  await expect(page.locator('#c-fluxo svg, #c-fluxo .note')).toHaveCount(1)
  await expect(page.locator('#c-mot svg, #c-mot .note')).toHaveCount(1)
  await expect(page.locator('#t-zedoa table')).toBeVisible()
  await expect(page.locator('#c-funil svg, #c-funil .note')).toHaveCount(1)
  await shot(page, '14-dono-painel-funil-zedoa.png')

  // exportar excel (base filtrada)
  const [download1] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-xls-base'),
  ])
  expect(download1.suggestedFilename()).toMatch(/\.xls$/)

  // relatório + exportar excel
  await page.click('#btn-go-rel')
  await expect(page.locator('.report')).toBeVisible()
  await shot(page, '15-dono-relatorio.png')
  const [download2] = await Promise.all([page.waitForEvent('download'), page.click('#r-xls')])
  expect(download2.suggestedFilename()).toMatch(/\.xls$/)

  // budget e regras
  await page.click('#nav-bud')
  await shot(page, '16-dono-budget.png')
  await page.click('#nav-reg')
  await shot(page, '17-dono-regras.png')
  await page.click('#nav-painel')
})

test('assistente de IA: abre e degrada graciosamente fora do runtime do Claude (passo 6)', async ({
  page,
}) => {
  await page.click('[data-login="d"]')
  await page.click('#ast-fab')
  await expect(page.locator('#ast')).toBeVisible()
  await shot(page, '18-assistente.png')
  // fora do ambiente claude.ai, window.claude não existe: o assistente deve avisar,
  // nunca travar a página (já coberto pelo afterEach, que falha se houver jserror).
  await expect(page.locator('.ast-empty p, .m-a')).toBeVisible()
})

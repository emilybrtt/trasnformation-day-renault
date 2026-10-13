import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Roteiro da demo (Fase D) — já com os 3 fluxos do F12. Pastas e valores batem
// de propósito com os casos propositais do seed (B4): pasta 14945 + R$ 4.410,64
// + R$ 4.589,36 já existe 3x no banco, então criar uma 4ª solicitação com os
// mesmos dados dispara o alerta DUPLICIDADE de verdade (não é mock).
const SCREENSHOTS_DIR = join(process.cwd(), 'docs', 'screenshots')
const DEMO_PDFS_DIR = join(process.cwd(), 'docs', 'demo-pdfs')

async function print(page: Page, nome: string) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  await page.screenshot({ path: join(SCREENSHOTS_DIR, nome), fullPage: true })
}

async function loginComo(page: Page, perfil: 'Escritório' | 'Analista' | 'Gestor') {
  await page.goto('/login')
  await page.getByRole('button', { name: new RegExp(perfil) }).click()
  await expect(page.getByText(perfil === 'Escritório' ? 'Escritório parceiro' : perfil === 'Analista' ? 'Operador · Jurídico' : 'Dono do fluxo')).toBeVisible({
    timeout: 15_000,
  })
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Saír' }).click()
  await expect(page).toHaveURL(/\/login/)
}

test.describe.configure({ mode: 'serial' })

test('roteiro completo: RBS_DD com duplicidade, da criação ao comprovante', async ({ page }) => {
  // --- Escritório cria a solicitação (guia real, extraída pela IA) ---
  await loginComo(page, 'Escritório')
  await page.getByRole('link', { name: '+ Nova solicitação' }).click()

  await page.getByRole('button', { name: /Guia de recolhimento/ }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.locator('input[type="file"]').setInputFiles(join(DEMO_PDFS_DIR, 'guia-1.pdf'))
  await expect(page.getByText('confira os campos abaixo').first()).toBeVisible({ timeout: 15_000 })
  await print(page, '01-escritorio-pdf-extraido.png')

  // Força o caso de duplicidade do seed (B4): mesma pasta/área/motivo/valores.
  await page.getByLabel('Pasta Projuris').fill('14945')
  await page.getByLabel('Área').selectOption({ label: 'TRABALHISTA PIF/PDV' })
  await page.getByLabel('Motivo').selectOption({ label: 'CONDENAÇÃO' })
  await page.getByLabel('Valor principal').fill('4410.64')
  await page.getByLabel('Juros/correção').fill('4589.36')

  await expect(page.getByText('Centro de custo')).toBeVisible()
  await expect(page.getByText('GI85031')).toBeVisible() // de-para resolvido pelo servidor
  await print(page, '02-escritorio-dados-contabeis.png')

  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Enviar para conferência' }).click()

  await expect(page).toHaveURL(/\/solicitacoes\/[a-z0-9]{10,}/, { timeout: 15_000 })
  const url = page.url()
  const id = url.match(/\/solicitacoes\/([a-z0-9]{10,})/)![1]
  await expect(page.getByText('Em conferência')).toBeVisible()
  await print(page, '03-escritorio-solicitacao-enviada.png')

  // --- Analista confere: vê a duplicidade, resolve, aprova ---
  await logout(page)
  await loginComo(page, 'Analista')
  await page.goto(`/solicitacoes/${id}`)

  await expect(page.getByText('DUPLICIDADE').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Possível duplicidade/)).toBeVisible()
  await print(page, '04-analista-alerta-duplicidade.png')

  const totalAlertas = await page.getByPlaceholder('justificativa').count()
  for (let i = 0; i < totalAlertas; i++) {
    await page.getByPlaceholder('justificativa').first().fill('Confirmado com o escritório — pagamento em parcelas, não é duplicado.')
    await page.getByRole('button', { name: 'Resolver' }).first().click()
    await expect(page.getByText('✓ resolvido').nth(i)).toBeVisible()
  }

  await page.getByRole('button', { name: 'Aprovar' }).click()
  await expect(page.getByText('Chamado pronto')).toBeVisible({ timeout: 15_000 })
  await print(page, '05-analista-aprovado-chamado-pronto.png')

  // --- Chamado RBS_DD: rateio.xlsx + enviar ao LBS/SAP ---
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar rateio.xlsx' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('rateio.xlsx')

  await page.getByRole('button', { name: 'Enviar ao LBS/SAP' }).click()
  await expect(page.getByText('Chamado aberto')).toBeVisible({ timeout: 15_000 })
  await print(page, '06-analista-chamado-aberto-lbs.png')

  // --- Registrar pagamento + comprovante ---
  await page.getByLabel('Data do pagamento').fill('2026-10-12')
  await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(join(DEMO_PDFS_DIR, 'guia-1.pdf'))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pago', { exact: true })).toBeVisible({ timeout: 15_000 })
  await print(page, '07-analista-pago.png')

  // --- Escritório vê o comprovante disponível ---
  await logout(page)
  await loginComo(page, 'Escritório')
  await page.goto(`/solicitacoes/${id}`)
  await expect(page.getByRole('button', { name: 'Baixar comprovante' })).toBeVisible()
  await print(page, '08-escritorio-comprovante-disponivel.png')
})

test('fluxo ANEXO_V: aprovado → chamado Portal SSC (mock) → pago', async ({ page }) => {
  await loginComo(page, 'Escritório')
  await page.goto('/solicitacoes/nova')
  await page.getByRole('button', { name: /Anexo V — Adiantamento/ }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.getByLabel('Pasta Projuris').fill(String(Math.floor(10000 + Math.random() * 89999)))
  await page.getByLabel('Área').selectOption({ label: 'CONSUMIDOR' })
  await page.getByLabel('Motivo').selectOption({ label: 'ACORDO' })
  await page.getByLabel('Valor principal').fill('5000')

  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Enviar para conferência' }).click()
  await expect(page).toHaveURL(/\/solicitacoes\/[a-z0-9]{10,}/, { timeout: 15_000 })
  const id = page.url().match(/\/solicitacoes\/([a-z0-9]{10,})/)![1]

  await logout(page)
  await loginComo(page, 'Analista')
  await page.goto(`/solicitacoes/${id}`)
  await page.getByRole('button', { name: 'Aprovar' }).click()

  await page.getByRole('button', { name: 'Abrir chamado Anexo V (Portal SSC)' }).click()
  await expect(page.getByText('Chamado aberto')).toBeVisible({ timeout: 15_000 })

  await page.getByLabel('Data do pagamento').fill('2026-10-12')
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pago', { exact: true })).toBeVisible({ timeout: 15_000 })
  await print(page, '09-fluxo-anexo-v-pago.png')
})

test('fluxo RC_HONORARIOS: aprovado → RC (SAP) → NF (0800) → pagamento programado (SAP) → pago', async ({ page }) => {
  await loginComo(page, 'Escritório')
  await page.goto('/solicitacoes/nova')
  await page.getByRole('button', { name: /Honorários \(NF\)/ }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.locator('input[type="file"]').setInputFiles(join(DEMO_PDFS_DIR, 'nf-1.pdf'))
  await expect(page.getByText('confira os campos abaixo').first()).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('Pasta Projuris').fill(String(Math.floor(10000 + Math.random() * 89999)))
  await page.getByLabel('Área').selectOption({ label: 'CÍVEL' })
  await page.getByLabel('Motivo').selectOption({ label: 'CONDENAÇÃO/CUSTAS' })

  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Enviar para conferência' }).click()
  await expect(page).toHaveURL(/\/solicitacoes\/[a-z0-9]{10,}/, { timeout: 15_000 })
  const id = page.url().match(/\/solicitacoes\/([a-z0-9]{10,})/)![1]

  await logout(page)
  await loginComo(page, 'Analista')
  await page.goto(`/solicitacoes/${id}`)
  await page.getByRole('button', { name: 'Aprovar' }).click()

  await page.getByRole('button', { name: 'Criar RC (SAP)' }).click()
  await expect(page.getByText('RC criado')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Lançar NF (Portal 0800)' }).click()
  await expect(page.getByText('NF lançada')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Programar pagamento (SAP)' }).click()
  await expect(page.getByText('Pagamento programado')).toBeVisible({ timeout: 15_000 })
  await print(page, '10-fluxo-rc-honorarios-pagamento-programado.png')

  await page.getByLabel('Data do pagamento').fill('2026-10-12')
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pago', { exact: true })).toBeVisible({ timeout: 15_000 })
  await print(page, '11-fluxo-rc-honorarios-pago.png')
})

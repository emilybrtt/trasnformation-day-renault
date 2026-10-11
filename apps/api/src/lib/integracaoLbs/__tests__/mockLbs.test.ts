import { describe, expect, it } from 'vitest'
import { MockLbs } from '../mockLbs.js'

describe('MockLbs', () => {
  it('devolve um número de chamado no formato BR-xxxxxx', async () => {
    const lbs = new MockLbs(5)
    const { numeroChamado } = await lbs.enviar('sol-123')
    expect(numeroChamado).toMatch(/^BR-\d{6}$/)
  })

  it('respeita o delay configurado', async () => {
    const inicio = Date.now()
    await new MockLbs(50).enviar('sol-123')
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(45)
  })
})

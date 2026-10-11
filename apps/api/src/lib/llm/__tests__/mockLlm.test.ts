import { describe, expect, it } from 'vitest'
import { MockLlm } from '../mockLlm.js'

describe('MockLlm', () => {
  it('é determinístico para o mesmo prompt', async () => {
    const llm = new MockLlm()
    const a = await llm.gerarTexto('quanto pagamos em 2026?')
    const b = await llm.gerarTexto('quanto pagamos em 2026?')
    expect(a).toBe(b)
    expect(a).toContain('quanto pagamos em 2026?')
  })
})

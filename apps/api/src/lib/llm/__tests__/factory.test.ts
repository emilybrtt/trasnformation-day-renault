import { describe, expect, it } from 'vitest'
import { criarLlmProvider } from '../index.js'

describe('criarLlmProvider', () => {
  it('usa MockLlm por padrão', () => {
    expect(criarLlmProvider({}).nome).toBe('mock')
  })

  it('usa GeminiProvider quando LLM_PROVIDER=gemini', () => {
    expect(criarLlmProvider({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'x' }).nome).toBe('gemini')
  })
})

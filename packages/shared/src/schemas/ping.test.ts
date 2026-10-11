import { describe, expect, it } from 'vitest'
import { pingSchema } from './ping.js'

describe('pingSchema', () => {
  it('aceita { status: "ok" }', () => {
    expect(pingSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' })
  })

  it('rejeita status diferente de "ok"', () => {
    expect(() => pingSchema.parse({ status: 'nope' })).toThrow()
  })
})

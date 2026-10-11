import { describe, expect, it } from 'vitest'
import { criarStorageProvider } from '../index.js'

describe('criarStorageProvider', () => {
  it('usa LocalDiskStorage por padrão', () => {
    expect(criarStorageProvider({}).nome).toBe('local')
  })

  it('usa GcsStorage quando STORAGE_PROVIDER=gcs', () => {
    expect(criarStorageProvider({ STORAGE_PROVIDER: 'gcs', GCS_BUCKET: 'b' }).nome).toBe('gcs')
  })
})

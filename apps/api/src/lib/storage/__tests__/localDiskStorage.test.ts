import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDiskStorage } from '../localDiskStorage.js'

describe('LocalDiskStorage', () => {
  let baseDir: string
  let storage: LocalDiskStorage

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'gavve-storage-'))
    storage = new LocalDiskStorage(baseDir)
  })

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true })
  })

  it('salva e lê o mesmo conteúdo', async () => {
    const { chave, url } = await storage.salvar('guias/2026/abc.pdf', Buffer.from('conteudo'), 'application/pdf')
    expect(chave).toBe('guias/2026/abc.pdf')
    expect(url).toBe('/arquivos/guias/2026/abc.pdf')
    expect((await storage.ler('guias/2026/abc.pdf')).toString()).toBe('conteudo')
  })

  it('remove o arquivo', async () => {
    await storage.salvar('a.pdf', Buffer.from('x'), 'application/pdf')
    await storage.remover('a.pdf')
    await expect(storage.ler('a.pdf')).rejects.toThrow()
  })

  it('remover em arquivo inexistente não lança erro', async () => {
    await expect(storage.remover('nao-existe.pdf')).resolves.toBeUndefined()
  })

  it('rejeita path traversal', async () => {
    await expect(storage.salvar('../fora.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow(
      /inválida/,
    )
    await expect(storage.ler('../../etc/passwd')).rejects.toThrow(/inválida/)
  })
})

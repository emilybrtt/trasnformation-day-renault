import { describe, expect, it, vi } from 'vitest'
import { GcsStorage } from '../gcsStorage.js'

function criarClienteFake() {
  const arquivos = new Map<string, Buffer>()
  const file = (chave: string) => ({
    save: vi.fn(async (conteudo: Buffer) => {
      arquivos.set(chave, conteudo)
    }),
    download: vi.fn(async () => [arquivos.get(chave) ?? Buffer.alloc(0)] as [Buffer]),
    getSignedUrl: vi.fn(async () => [`https://signed.example/${chave}`] as [string]),
    delete: vi.fn(async () => {
      arquivos.delete(chave)
    }),
  })
  const bucket = vi.fn((_nome: string) => ({ file: vi.fn(file) }))
  return { bucket } as unknown as import('@google-cloud/storage').Storage
}

describe('GcsStorage', () => {
  it('exige GCS_BUCKET configurado', () => {
    expect(() => new GcsStorage('', criarClienteFake())).toThrow(/GCS_BUCKET/)
  })

  it('salva, lê, gera url assinada e remove', async () => {
    const storage = new GcsStorage('bucket-demo', criarClienteFake())
    const salvo = await storage.salvar('nf/123.pdf', Buffer.from('nf'), 'application/pdf')
    expect(salvo.url).toBe('https://signed.example/nf/123.pdf')
    expect((await storage.ler('nf/123.pdf')).toString()).toBe('nf')
    await storage.remover('nf/123.pdf')
    expect((await storage.ler('nf/123.pdf')).length).toBe(0)
  })
})

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative } from 'node:path'
import type { ArquivoSalvo, StorageProvider } from './types.js'

// Fallback do Cloud Storage para rodar 100% local. A rota de download fica em
// /arquivos/:chave (B13); aqui só cuidamos do disco.
export class LocalDiskStorage implements StorageProvider {
  readonly nome = 'local' as const
  private readonly baseDir: string

  constructor(baseDir = join(process.cwd(), 'uploads')) {
    this.baseDir = baseDir
  }

  private resolverCaminho(chave: string): string {
    const caminho = normalize(join(this.baseDir, chave))
    const relativo = relative(this.baseDir, caminho)
    if (relativo.startsWith('..') || isAbsolute(relativo)) {
      throw new Error(`Chave de arquivo inválida: "${chave}"`)
    }
    return caminho
  }

  async salvar(chave: string, conteudo: Buffer, _contentType?: string): Promise<ArquivoSalvo> {
    const caminho = this.resolverCaminho(chave)
    await mkdir(dirname(caminho), { recursive: true })
    await writeFile(caminho, conteudo)
    return { chave, url: await this.obterUrl(chave) }
  }

  async ler(chave: string): Promise<Buffer> {
    return readFile(this.resolverCaminho(chave))
  }

  async obterUrl(chave: string): Promise<string> {
    return `/arquivos/${chave}`
  }

  async remover(chave: string): Promise<void> {
    await rm(this.resolverCaminho(chave), { force: true })
  }
}

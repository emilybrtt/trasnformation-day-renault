import { Storage as GcsClient } from '@google-cloud/storage'
import type { ArquivoSalvo, StorageProvider } from './types.js'

export class GcsStorage implements StorageProvider {
  readonly nome = 'gcs' as const
  private readonly bucketName: string
  private readonly client: GcsClient

  constructor(bucketName: string, client = new GcsClient()) {
    if (!bucketName) throw new Error('GCS_BUCKET não configurado')
    this.bucketName = bucketName
    this.client = client
  }

  private bucket() {
    return this.client.bucket(this.bucketName)
  }

  async salvar(chave: string, conteudo: Buffer, contentType: string): Promise<ArquivoSalvo> {
    const file = this.bucket().file(chave)
    await file.save(conteudo, { contentType })
    return { chave, url: await this.obterUrl(chave) }
  }

  async ler(chave: string): Promise<Buffer> {
    const [conteudo] = await this.bucket().file(chave).download()
    return conteudo
  }

  async obterUrl(chave: string): Promise<string> {
    const [url] = await this.bucket()
      .file(chave)
      .getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 })
    return url
  }

  async remover(chave: string): Promise<void> {
    await this.bucket().file(chave).delete({ ignoreNotFound: true })
  }
}

export interface ArquivoSalvo {
  chave: string
  url: string
}

export interface StorageProvider {
  readonly nome: 'local' | 'gcs'
  salvar(chave: string, conteudo: Buffer, contentType: string): Promise<ArquivoSalvo>
  ler(chave: string): Promise<Buffer>
  obterUrl(chave: string): Promise<string>
  remover(chave: string): Promise<void>
}

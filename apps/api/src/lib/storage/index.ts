import { GcsStorage } from './gcsStorage.js'
import { LocalDiskStorage } from './localDiskStorage.js'
import type { StorageProvider } from './types.js'

export type { ArquivoSalvo, StorageProvider } from './types.js'

let instancia: StorageProvider | undefined

export function criarStorageProvider(env = process.env): StorageProvider {
  if (env.STORAGE_PROVIDER === 'gcs') {
    return new GcsStorage(env.GCS_BUCKET ?? '')
  }
  return new LocalDiskStorage()
}

/** Instância única (lazy) para uso pelas rotas da API. */
export function getStorage(): StorageProvider {
  instancia ??= criarStorageProvider()
  return instancia
}

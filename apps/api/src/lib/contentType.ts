const CONTENT_TYPES_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Infere o Content-Type pela extensão do nome do arquivo/chave de storage —
 * usado nas rotas de download (B13), que não guardam o mimetype original. */
export function inferirContentType(nomeOuChave: string): string {
  const extensao = nomeOuChave.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES_POR_EXTENSAO[extensao] ?? 'application/octet-stream'
}

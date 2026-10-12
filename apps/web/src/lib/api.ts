import { auth, authPronto } from './firebase'

export class ApiError extends Error {
  status: number
  corpo: unknown

  constructor(status: number, corpo: unknown) {
    super(typeof corpo === 'object' && corpo && 'erro' in corpo ? String((corpo as { erro: unknown }).erro) : 'Erro na API')
    this.status = status
    this.corpo = corpo
  }
}

const BASE_URL = import.meta.env.VITE_API_URL

async function autorizacao(): Promise<HeadersInit> {
  await authPronto
  const token = await auth.currentUser?.getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Fetch com injeção automática do `Authorization: Bearer <idToken>` do usuário
 * autenticado no Firebase. Lança `ApiError` em respostas não-2xx. */
export async function apiFetch<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const headers = { ...(await autorizacao()), ...init.headers }
  const temBody = init.body !== undefined && !(init.body instanceof FormData)

  const res = await fetch(`${BASE_URL}${caminho}`, {
    ...init,
    headers: temBody ? { 'Content-Type': 'application/json', ...headers } : headers,
  })

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''
  const corpo = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) throw new ApiError(res.status, corpo)
  return corpo as T
}

export function apiGet<T>(caminho: string): Promise<T> {
  return apiFetch<T>(caminho)
}

export function apiPost<T>(caminho: string, body?: unknown): Promise<T> {
  return apiFetch<T>(caminho, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) })
}

export function apiPatch<T>(caminho: string, body?: unknown): Promise<T> {
  return apiFetch<T>(caminho, { method: 'PATCH', body: JSON.stringify(body) })
}

/** Baixa um arquivo autenticado (ex.: /anexos/:id/download) e dispara o save
 * no navegador. O fetch segue o 302 (signed URL do GCS ou /arquivos/* local)
 * mantendo o header de autorização, já que o redirect é same-origin ou para
 * uma signed URL que não precisa dele. */
export async function baixarArquivo(caminho: string, nomeArquivoSugerido: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${caminho}`, { headers: await autorizacao() })
  if (!res.ok) throw new ApiError(res.status, await res.text())

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivoSugerido
  link.click()
  URL.revokeObjectURL(url)
}

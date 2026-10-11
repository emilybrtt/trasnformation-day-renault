import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CriarSolicitacaoInput } from '@gavve/shared'
import { apiGet, apiPost } from '../lib/api'
import type { DeParaLinha, Fornecedor, ListaSolicitacoes, SolicitacaoDetalhe } from '../types/solicitacao'

export function useListaSolicitacoes(filtros: { status?: string; tipoFluxo?: string; pageSize?: number } = {}) {
  const params = new URLSearchParams()
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.tipoFluxo) params.set('tipo', filtros.tipoFluxo)
  params.set('pageSize', String(filtros.pageSize ?? 100))

  return useQuery({
    queryKey: ['solicitacoes', filtros],
    queryFn: () => apiGet<ListaSolicitacoes>(`/solicitacoes?${params.toString()}`),
  })
}

export function useSolicitacao(id: string | undefined) {
  return useQuery({
    queryKey: ['solicitacao', id],
    queryFn: () => apiGet<SolicitacaoDetalhe>(`/solicitacoes/${id}`),
    enabled: !!id,
  })
}

export function useListas() {
  return useQuery({
    queryKey: ['listas'],
    queryFn: () =>
      apiGet<{ areas: readonly string[]; motivos: readonly string[]; tiposFluxo: readonly string[]; formasPagamento: readonly string[] }>(
        '/listas',
      ),
    staleTime: Infinity,
  })
}

export function useDePara(area: string | undefined, motivo: string | undefined) {
  return useQuery({
    queryKey: ['de-para', area, motivo],
    queryFn: () => apiGet<DeParaLinha[]>(`/de-para?area=${encodeURIComponent(area!)}&motivo=${encodeURIComponent(motivo!)}`),
    enabled: !!area && !!motivo,
  })
}

export function useFornecedores(busca: string) {
  return useQuery({
    queryKey: ['fornecedores', busca],
    queryFn: () => apiGet<Fornecedor[]>(`/fornecedores${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
  })
}

export function useCriarSolicitacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CriarSolicitacaoInput) => apiPost<SolicitacaoDetalhe>('/solicitacoes', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['solicitacoes'] }),
  })
}

export function useEnviarSolicitacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/enviar`),
    onSuccess: (_dados, id) => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
    },
  })
}

export function useUploadAnexo() {
  return useMutation({
    mutationFn: async ({ solicitacaoId, tipo, arquivo }: { solicitacaoId: string; tipo: string; arquivo: File }) => {
      const formData = new FormData()
      formData.set('tipo', tipo)
      formData.set('arquivo', arquivo)
      return apiPost(`/solicitacoes/${solicitacaoId}/anexos`, formData)
    },
  })
}

export function useExtrairPdf() {
  return useMutation({
    mutationFn: async ({ tipo, arquivo }: { tipo: 'GUIA' | 'NF'; arquivo: File }) => {
      const formData = new FormData()
      formData.set('tipo', tipo)
      formData.set('arquivo', arquivo)
      return apiPost<{
        sucesso: boolean
        chave: string
        dadosExtraidos: Record<string, unknown>
        fornecedorSugerido: Fornecedor | null
      }>('/extracao', formData)
    },
  })
}

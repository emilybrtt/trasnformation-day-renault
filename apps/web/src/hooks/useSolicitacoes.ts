import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CriarSolicitacaoInput } from '@gavve/shared'
import { apiGet, apiPatch, apiPost } from '../lib/api'
import type { ChamadoRbsDd, DeParaLinha, Fornecedor, ListaSolicitacoes, Notificacao, SolicitacaoDetalhe } from '../types/solicitacao'

export interface FiltrosSolicitacoes {
  status?: string
  tipoFluxo?: string
  semaforo?: string
  escritorio?: string
  pasta?: string
  pageSize?: number
}

export function useListaSolicitacoes(filtros: FiltrosSolicitacoes = {}) {
  const params = new URLSearchParams()
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.tipoFluxo) params.set('tipo', filtros.tipoFluxo)
  if (filtros.semaforo) params.set('semaforo', filtros.semaforo)
  if (filtros.escritorio) params.set('escritorio', filtros.escritorio)
  if (filtros.pasta) params.set('pasta', filtros.pasta)
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

export function useAtualizarSolicitacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CriarSolicitacaoInput> }) =>
      apiPatch<SolicitacaoDetalhe>(`/solicitacoes/${id}`, input),
    onSuccess: (_dados, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
      queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
    },
  })
}

/** Invalida a lista e o detalhe depois de qualquer ação da Analista — usada por
 * todas as mutações abaixo (aprovar, devolver, chamado, pagamento etc.). */
function useInvalidarSolicitacao() {
  const queryClient = useQueryClient()
  return (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['solicitacoes'] })
    queryClient.invalidateQueries({ queryKey: ['solicitacao', id] })
  }
}

export function useAprovarSolicitacao() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: (id: string) => apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/aprovar`),
    onSuccess: (_d, id) => invalidar(id),
  })
}

export function useDevolverSolicitacao() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: ({ id, comentario }: { id: string; comentario: string }) =>
      apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/devolver`, { comentario }),
    onSuccess: (_d, { id }) => invalidar(id),
  })
}

export function useResolverAlerta(solicitacaoId: string) {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: ({ alertaId, justificativa }: { alertaId: string; justificativa: string }) =>
      apiPost(`/alertas/${alertaId}/resolver`, { justificativa }),
    onSuccess: () => invalidar(solicitacaoId),
  })
}

// --- ANEXO_V: chamado no Portal SSC (mock) ---
export function useAbrirChamadoAnexoV() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: (id: string) => apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/chamado-anexo-v`),
    onSuccess: (_d, id) => invalidar(id),
  })
}

// --- RC_HONORARIOS: RC (SAP) → NF (Portal 0800) → pagamento programado (SAP) ---
export function useCriarRc() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: (id: string) => apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/rc`),
    onSuccess: (_d, id) => invalidar(id),
  })
}

export function useLancarNf() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: (id: string) => apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/nf-0800`),
    onSuccess: (_d, id) => invalidar(id),
  })
}

export function useProgramarPagamento() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: (id: string) => apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/programar-pagamento`),
    onSuccess: (_d, id) => invalidar(id),
  })
}

// --- RBS_DD: chamado pronto (campos pra copiar) + envio simulado ao LBS/SAP ---
export function useChamadoRbsDd(id: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['chamado', id],
    queryFn: () => apiGet<ChamadoRbsDd>(`/solicitacoes/${id}/chamado`),
    enabled: !!id && habilitado,
  })
}

export function useEnviarLbs() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: (id: string) => apiPost<SolicitacaoDetalhe>(`/integracoes/lbs/enviar/${id}`),
    onSuccess: (_d, id) => invalidar(id),
  })
}

// --- comum aos 3 fluxos: registrar o pagamento (+ comprovante opcional) ---
export function useRegistrarPagamento() {
  const invalidar = useInvalidarSolicitacao()
  return useMutation({
    mutationFn: ({
      id,
      dataPagamento,
      numeroDocumentoLbs,
      comprovante,
    }: {
      id: string
      dataPagamento: string
      numeroDocumentoLbs?: string
      comprovante?: File
    }) => {
      const formData = new FormData()
      formData.set('dataPagamento', dataPagamento)
      if (numeroDocumentoLbs) formData.set('numeroDocumentoLbs', numeroDocumentoLbs)
      if (comprovante) formData.set('comprovante', comprovante)
      return apiPost<SolicitacaoDetalhe>(`/solicitacoes/${id}/pagamento`, formData)
    },
    onSuccess: (_d, { id }) => invalidar(id),
  })
}

export function useAnexos(solicitacaoId: string | undefined) {
  return useQuery({
    queryKey: ['anexos', solicitacaoId],
    queryFn: () => apiGet<Array<{ id: string; tipo: string; nomeArquivo: string; createdAt: string }>>(`/solicitacoes/${solicitacaoId}/anexos`),
    enabled: !!solicitacaoId,
  })
}

export function useNotificacoes() {
  return useQuery({
    queryKey: ['notificacoes'],
    queryFn: () => apiGet<Notificacao[]>('/notificacoes'),
  })
}

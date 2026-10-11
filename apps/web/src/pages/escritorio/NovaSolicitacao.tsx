import { zodResolver } from '@hookform/resolvers/zod'
import { criarSolicitacaoSchema, FORMAS_PAGAMENTO } from '@gavve/shared'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Botao } from '../../components/ui/Button'
import { useToast, mensagemDeErro } from '../../hooks/useToast'
import { useCriarSolicitacao, useEnviarSolicitacao, useExtrairPdf, useUploadAnexo } from '../../hooks/useSolicitacoes'
import { LinhaLancamentoCampos } from './LinhaLancamentoCampos'

export const formSchema = criarSolicitacaoSchema.omit({ escritorioId: true })
export type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

const TIPOS_CARD = [
  { valor: 'RBS_DD_GUIA', titulo: 'Guia de recolhimento (RBS/DD)', descricao: 'Condenação, acordo ou custas com guia judicial' },
  { valor: 'RC_HONORARIOS_NF', titulo: 'Honorários (NF)', descricao: 'Nota fiscal de honorários do escritório' },
  { valor: 'ANEXO_V_ADIANTAMENTO', titulo: 'Anexo V — Adiantamento', descricao: 'Solicitação de adiantamento de verba' },
  { valor: 'ANEXO_V_BAIXA', titulo: 'Anexo V — Baixa', descricao: 'Prestação de contas de um adiantamento' },
  { valor: 'ANEXO_V_REEMBOLSO', titulo: 'Anexo V — Reembolso', descricao: 'Reembolso de despesa já paga pelo escritório' },
] as const

const TIPO_DOCUMENTO_POR_FLUXO: Partial<Record<string, 'GUIA' | 'NF'>> = {
  RBS_DD_GUIA: 'GUIA',
  RC_HONORARIOS_NF: 'NF',
}

const LINHA_VAZIA = { pastaProjuris: '', area: '', motivo: '', valorPrincipal: 0, valorJurosCorrecao: 0 }

const RASCUNHO_KEY = 'gavve:rascunho-nova-solicitacao'

export function NovaSolicitacao() {
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null)
  const [extraindo, setExtraindo] = useState(false)
  const navigate = useNavigate()
  const { notificar } = useToast()

  const { register, control, handleSubmit, watch, setValue, trigger, formState } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { dataDocumento: new Date(), formaPagamento: 'BOLETO', linhas: [LINHA_VAZIA] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'linhas' })

  const tipoFluxo = watch('tipoFluxo')
  const linhas = watch('linhas')
  const valorTotal = linhas?.reduce((acc, l) => acc + (Number(l.valorPrincipal) || 0) + (Number(l.valorJurosCorrecao) || 0), 0) ?? 0

  // Rascunho salvo automaticamente (debounce 2s) — só no navegador deste
  // escritório; não é a mesma coisa que o status RASCUNHO no servidor, é uma
  // conveniência para não perder o que já foi digitado se a aba for recarregada.
  useEffect(() => {
    const salvo = localStorage.getItem(RASCUNHO_KEY)
    if (salvo) {
      try {
        const dados = JSON.parse(salvo) as FormValues
        Object.entries(dados).forEach(([campo, valor]) => setValue(campo as keyof FormValues, valor as never))
      } catch {
        // rascunho corrompido — ignora e começa do zero
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const assinatura = watch((valores) => {
      const id = setTimeout(() => localStorage.setItem(RASCUNHO_KEY, JSON.stringify(valores)), 2000)
      return () => clearTimeout(id)
    })
    return () => assinatura.unsubscribe()
  }, [watch])

  const extrairPdf = useExtrairPdf()
  const criar = useCriarSolicitacao()
  const enviar = useEnviarSolicitacao()
  const uploadAnexo = useUploadAnexo()

  async function aoSelecionarArquivo(arquivo: File) {
    const tipoDocumento = TIPO_DOCUMENTO_POR_FLUXO[tipoFluxo]
    if (!tipoDocumento) return
    setArquivoAnexo(arquivo)
    setExtraindo(true)
    try {
      const resultado = await extrairPdf.mutateAsync({ tipo: tipoDocumento, arquivo })
      if (resultado.sucesso) {
        const dados = resultado.dadosExtraidos as Record<string, unknown>
        if (typeof dados.valor === 'number') setValue('linhas.0.valorPrincipal', dados.valor)
        if (typeof dados.valorServico === 'number') setValue('linhas.0.valorPrincipal', dados.valorServico)
        if (typeof dados.numeroDocumento === 'string') setValue('numeroDocumentoLbs', dados.numeroDocumento)
        if (resultado.fornecedorSugerido) setValue('fornecedorId', resultado.fornecedorSugerido.id)
        notificar('✨ Preenchido pela IA, confira os campos abaixo.')
      } else {
        notificar('Não deu para ler o PDF automaticamente — preencha os campos manualmente.', 'erro')
      }
    } catch (err) {
      notificar(mensagemDeErro(err, 'Falha ao enviar o PDF.'), 'erro')
    } finally {
      setExtraindo(false)
    }
  }

  async function avancarDoPasso1() {
    const ok = await trigger(['tipoFluxo', 'formaPagamento', 'dataDocumento'])
    if (ok) setPasso(2)
  }

  async function avancarDoPasso2() {
    const ok = await trigger('linhas')
    if (ok) setPasso(3)
  }

  async function enviarSolicitacao(dados: FormOutput) {
    try {
      const criada = await criar.mutateAsync(dados)
      if (arquivoAnexo && TIPO_DOCUMENTO_POR_FLUXO[dados.tipoFluxo]) {
        await uploadAnexo.mutateAsync({ solicitacaoId: criada.id, tipo: TIPO_DOCUMENTO_POR_FLUXO[dados.tipoFluxo]!, arquivo: arquivoAnexo })
      }
      await enviar.mutateAsync(criada.id)
      localStorage.removeItem(RASCUNHO_KEY)
      notificar('Solicitação enviada para conferência.')
      navigate(`/solicitacoes/${criada.id}`)
    } catch (err) {
      notificar(mensagemDeErro(err, 'Não foi possível enviar a solicitação.'), 'erro')
    }
  }

  const enviando = criar.isPending || uploadAnexo.isPending || enviar.isPending

  return (
    <div>
      <h1 className="f-display text-4xl font-bold">Nova solicitação</h1>
      <div className="f-mono mt-4 flex gap-6 text-xs uppercase tracking-wide text-[var(--muted)]">
        {(['1. Tipo', '2. Lançamentos', '3. Revisão'] as const).map((rotulo, i) => (
          <span key={rotulo} className={passo === i + 1 ? 'border-b-2 border-[var(--accent)] pb-1 font-semibold text-[var(--ink)]' : ''}>
            {rotulo}
          </span>
        ))}
      </div>

      <form className="mt-8" onSubmit={handleSubmit(enviarSolicitacao)}>
        {passo === 1 && (
          <div>
            <p className="mb-3 text-sm font-medium">Tipo de pagamento</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TIPOS_CARD.map((card) => (
                <button
                  key={card.valor}
                  type="button"
                  onClick={() => setValue('tipoFluxo', card.valor)}
                  className={`border p-4 text-left transition ${
                    tipoFluxo === card.valor ? 'border-[var(--ink)] bg-[var(--surface)]' : 'border-[var(--line)] hover:border-[var(--line-2)]'
                  }`}
                >
                  <span className="f-display block font-semibold">{card.titulo}</span>
                  <span className="block text-xs text-[var(--muted)]">{card.descricao}</span>
                </button>
              ))}
            </div>
            {formState.errors.tipoFluxo && <p className="mt-2 text-xs text-[var(--bad-ink)]">Escolha um tipo de pagamento.</p>}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Forma de pagamento
                <select {...register('formaPagamento')} className="border border-[var(--line-2)] px-3 py-2">
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Data do documento
                <input {...register('dataDocumento', { valueAsDate: true })} type="date" className="border border-[var(--line-2)] px-3 py-2" />
              </label>
            </div>

            <div className="mt-8 flex justify-end">
              <Botao variante="primaria" type="button" onClick={avancarDoPasso1}>
                Continuar
              </Botao>
            </div>
          </div>
        )}

        {passo === 2 && (
          <div>
            {TIPO_DOCUMENTO_POR_FLUXO[tipoFluxo] && (
              <div className="mb-6 border border-dashed border-[var(--line-2)] p-4">
                <p className="f-mono text-xs uppercase tracking-wide text-[var(--muted)]">
                  Upload do {TIPO_DOCUMENTO_POR_FLUXO[tipoFluxo] === 'GUIA' ? 'PDF da guia' : 'PDF da nota fiscal'}
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={extraindo}
                  onChange={(e) => e.target.files?.[0] && void aoSelecionarArquivo(e.target.files[0])}
                  className="mt-2 text-sm"
                />
                {extraindo && <p className="mt-2 text-xs text-[var(--muted)]">Lendo o PDF…</p>}
                {arquivoAnexo && !extraindo && <p className="mt-2 text-xs text-[var(--ok-ink)]">✨ {arquivoAnexo.name} — confira os campos abaixo.</p>}
              </div>
            )}

            <label className="mb-6 flex max-w-xs flex-col gap-1 text-sm">
              Nº do documento (LBS/SAP)
              <input {...register('numeroDocumentoLbs')} className="border border-[var(--line-2)] px-3 py-2" />
            </label>

            <div className="flex flex-col gap-4">
              {fields.map((field, index) => (
                <LinhaLancamentoCampos
                  key={field.id}
                  control={control}
                  register={register}
                  index={index}
                  errors={formState.errors.linhas}
                  onRemover={() => remove(index)}
                  podeRemover={fields.length > 1}
                />
              ))}
            </div>
            <button type="button" onClick={() => append(LINHA_VAZIA)} className="f-mono mt-3 text-xs uppercase tracking-wide underline">
              + adicionar lançamento
            </button>

            <div className="mt-8 flex justify-between">
              <Botao type="button" onClick={() => setPasso(1)}>
                Voltar
              </Botao>
              <Botao variante="primaria" type="button" onClick={avancarDoPasso2}>
                Continuar
              </Botao>
            </div>
          </div>
        )}

        {passo === 3 && (
          <div>
            <p className="mb-4 text-sm">Revise os dados antes de enviar para conferência.</p>
            <div className="border border-[var(--ink)] p-5">
              <p>
                <strong>{TIPOS_CARD.find((t) => t.valor === tipoFluxo)?.titulo}</strong> · {linhas?.length ?? 0} lançamento(s)
              </p>
              <p className="f-display mt-2 text-3xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
              </p>
            </div>

            <div className="mt-8 flex justify-between">
              <Botao type="button" onClick={() => setPasso(2)}>
                Voltar
              </Botao>
              <Botao variante="primaria" type="submit" carregando={enviando}>
                Enviar para conferência
              </Botao>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

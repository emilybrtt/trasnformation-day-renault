export class ErroHttp extends Error {
  status: number
  corpo: Record<string, unknown>

  constructor(status: number, corpo: Record<string, unknown>) {
    super(typeof corpo.erro === 'string' ? corpo.erro : 'Erro')
    this.status = status
    this.corpo = corpo
  }
}

export const naoEncontrado = () => new ErroHttp(404, { erro: 'Recurso não encontrado' })
export const transicaoInvalida = (de: string, para: string) =>
  new ErroHttp(409, { erro: `Transição inválida: não é possível ir de ${de} para ${para}` })

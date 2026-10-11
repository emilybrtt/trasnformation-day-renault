import { enviarMensagemAgenteSchema } from '@gavve/shared'
import { Router } from 'express'
import { assincrona } from '../lib/assincrona.js'
import { DECLARACOES_FERRAMENTAS } from '../lib/llm/ferramentas.js'
import { getLlmProvider } from '../lib/llm/index.js'
import { EXECUTORES_FERRAMENTAS } from '../services/agente.js'
import { auth, exige } from '../middleware/auth.js'

export const agenteRouter = Router()

const TAMANHO_HISTORICO = 6

const RESPOSTA_SEM_FERRAMENTA =
  'Não entendi a pergunta. Tente perguntar sobre total pago, comparativo entre anos, ' +
  'média de honorários, realizado por período/ordem interna, pastas com maior valor ou pendências em aberto.'

agenteRouter.post(
  '/agente/mensagem',
  auth,
  exige('ANALISTA', 'GESTOR'),
  assincrona(async (req, res) => {
    const { mensagem, historico } = enviarMensagemAgenteSchema.parse(req.body)
    const historicoLimitado = (historico ?? []).slice(-TAMANHO_HISTORICO)

    const escolha = await getLlmProvider().escolherFerramenta(mensagem, historicoLimitado, DECLARACOES_FERRAMENTAS)
    const executor = escolha && EXECUTORES_FERRAMENTAS[escolha.ferramenta]

    if (!escolha || !executor) {
      res.json({ texto: RESPOSTA_SEM_FERRAMENTA })
      return
    }

    res.json(await executor(escolha.parametros))
  }),
)

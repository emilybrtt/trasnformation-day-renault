import type { Semaforo, Severidade } from '@prisma/client'

const ORDEM: Record<Semaforo, number> = { VERDE: 0, AMARELO: 1, VERMELHO: 2 }

/** O semáforo do lançamento é o pior entre seus alertas abertos (regra do B7). */
export function piorSemaforo(semaforos: Semaforo[]): Semaforo {
  return semaforos.reduce<Semaforo>((pior, atual) => (ORDEM[atual] > ORDEM[pior] ? atual : pior), 'VERDE')
}

/** O semáforo da solicitação é o pior entre os lançamentos e os alertas que não
 * pertencem a um lançamento específico (ex.: SALDO_ADIANTAMENTO, documento
 * obrigatório ausente). */
export function semaforoDaSolicitacao(
  lancamentos: { semaforo: Semaforo }[],
  alertasDaSolicitacao: { severidade: Severidade }[],
): Semaforo {
  return piorSemaforo([
    ...lancamentos.map((l) => l.semaforo),
    ...alertasDaSolicitacao.map((a) => a.severidade as Semaforo),
  ])
}

import type { Semaforo } from '@prisma/client'

const ORDEM: Record<Semaforo, number> = { VERDE: 0, AMARELO: 1, VERMELHO: 2 }

/** O semáforo da solicitação é o pior entre os seus lançamentos (regra do B7). */
export function piorSemaforo(semaforos: Semaforo[]): Semaforo {
  return semaforos.reduce<Semaforo>((pior, atual) => (ORDEM[atual] > ORDEM[pior] ? atual : pior), 'VERDE')
}

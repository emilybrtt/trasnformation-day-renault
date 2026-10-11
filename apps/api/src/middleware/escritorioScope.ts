import type { UsuarioAutenticado } from './auth.js'

/**
 * ANALISTA e GESTOR veem tudo; ESCRITORIO só vê recursos do próprio escritório.
 * Os cards B6+ usam isto depois de buscar o recurso (ex.: a Solicitacao) para
 * decidir se devolvem 404 — nunca 403, para não revelar que o recurso existe.
 */
export function podeAcessarEscritorio(
  usuario: UsuarioAutenticado,
  escritorioIdDoRecurso: string | null | undefined,
): boolean {
  if (usuario.perfil !== 'ESCRITORIO') return true
  return usuario.escritorioId === escritorioIdDoRecurso
}

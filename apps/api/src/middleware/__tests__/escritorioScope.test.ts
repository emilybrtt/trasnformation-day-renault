import { describe, expect, it } from 'vitest'
import type { UsuarioAutenticado } from '../auth.js'
import { podeAcessarEscritorio } from '../escritorioScope.js'

function usuario(parcial: Partial<UsuarioAutenticado>): UsuarioAutenticado {
  return {
    firebaseUid: 'u1',
    nome: 'Teste',
    email: 'teste@gavve.demo',
    perfil: 'ESCRITORIO',
    escritorioId: null,
    ...parcial,
  }
}

describe('podeAcessarEscritorio', () => {
  it('ANALISTA e GESTOR acessam qualquer escritório', () => {
    expect(podeAcessarEscritorio(usuario({ perfil: 'ANALISTA' }), 'escritorio-x')).toBe(true)
    expect(podeAcessarEscritorio(usuario({ perfil: 'GESTOR' }), 'escritorio-x')).toBe(true)
  })

  it('ESCRITORIO só acessa o próprio escritório', () => {
    const usuarioEscritorio = usuario({ perfil: 'ESCRITORIO', escritorioId: 'escritorio-alfa' })
    expect(podeAcessarEscritorio(usuarioEscritorio, 'escritorio-alfa')).toBe(true)
    expect(podeAcessarEscritorio(usuarioEscritorio, 'escritorio-beta')).toBe(false)
    expect(podeAcessarEscritorio(usuarioEscritorio, null)).toBe(false)
  })
})

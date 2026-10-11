const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatadorData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatarMoeda(valor: number | string): string {
  return formatadorMoeda.format(Number(valor))
}

export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '—'
  return formatadorData.format(new Date(data))
}

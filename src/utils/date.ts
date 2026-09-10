export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new Error(`Fecha no válida: ${dateKey}`)

  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0)

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error(`Fecha no válida: ${dateKey}`)
  }

  return date
}

export function shiftDateKey(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + amount)
  return getLocalDateKey(date)
}

export function startOfWeek(dateKey: string) {
  const date = parseDateKey(dateKey)
  const weekday = date.getDay()
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday))
  return getLocalDateKey(date)
}

export function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parseDateKey(dateKey))
}

export function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(parseDateKey(dateKey))
}

export function formatWeekdayShort(dateKey: string) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
    .format(parseDateKey(dateKey))
    .replace('.', '')
    .slice(0, 2)
    .toUpperCase()
}

export function compareDateKeys(a: string, b: string) {
  return a.localeCompare(b)
}

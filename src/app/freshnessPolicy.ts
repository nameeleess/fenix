export function getCurrentLocalDateKey(
  date = new Date(),
) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function millisecondsUntilNextLocalDay(
  now = new Date(),
) {
  const nextDay = new Date(now)

  nextDay.setHours(24, 0, 0, 50)

  return Math.max(
    250,
    nextDay.getTime() - now.getTime(),
  )
}

import { AppError } from './errors'
import type { DateWindow } from './types'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const toDateWindowUtc = (date: string): DateWindow => {
  if (!DATE_REGEX.test(date)) {
    throw new AppError('INVALID_INPUT', 'date must use YYYY-MM-DD format', 400, false, {
      date,
    })
  }

  const start = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) {
    throw new AppError('INVALID_INPUT', 'date is invalid', 400, false, {
      date,
    })
  }

  const startIso = start.toISOString()
  const parsedDayKey = startIso.slice(0, 10)
  if (parsedDayKey !== date) {
    throw new AppError('INVALID_INPUT', 'date is invalid', 400, false, {
      date,
    })
  }

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  return {
    dayKey: date,
    startIso,
    endIso: end.toISOString(),
  }
}

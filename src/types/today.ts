import type { BaseEntity } from './common'

export type TodayBlock =
  | 'morning'
  | 'postworkout'
  | 'development'
  | 'work'
  | 'night'

export type TodayTaskStatus =
  | 'pending'
  | 'completed'
  | 'skipped'
  | 'not_applicable'

export type TodayTaskKind =
  | 'routine'
  | 'development'
  | 'one_off'

export type TodayApplicability =
  | 'always'
  | 'training_day'
  | 'non_training_day'
  | 'work_day'
  | 'non_work_day'
  | 'manual'

/*
 * Plantilla reutilizable de Hoy.
 *
 * Define la estructura de días futuros,
 * pero nunca representa directamente
 * lo ocurrido en una fecha concreta.
 */
export interface DailyRoutineTemplate
  extends BaseEntity {
  name: string

  description: string | null

  isActive: boolean
}

/*
 * Elemento perteneciente a una plantilla.
 *
 * Cuando se crea una ejecución diaria,
 * sus datos se copian como snapshot a
 * DailyRoutineTask.
 *
 * De esta forma una modificación futura
 * de la plantilla nunca reescribe el pasado.
 */
export interface DailyRoutineTemplateItem
  extends BaseEntity {
  templateId: string

  block: TodayBlock

  order: number

  title: string

  description: string | null

  applicability: TodayApplicability

  /*
   * Horario orientativo cuando realmente
   * exista una regla horaria.
   *
   * Formato:
   * HH:MM
   */
  targetTime: string | null

  /*
   * Hora límite cuando exista.
   *
   * Formato:
   * HH:MM
   */
  latestTime: string | null

  /*
   * 0 = domingo
   * 1 = lunes
   * ...
   * 6 = sábado
   *
   * null significa que no existe una
   * restricción semanal específica.
   */
  timingDays: number[] | null
}

/*
 * Ejecución de Hoy correspondiente a
 * una fecha concreta.
 *
 * Su existencia NO significa que el
 * usuario haya pulsado "Iniciar día".
 *
 * startedAt registra exclusivamente
 * esa acción de UX.
 */
export interface DailyRoutine
  extends BaseEntity {
  date: string

  templateId: string | null

  startedAt: string | null
}

/*
 * Snapshot histórico de una tarea concreta.
 *
 * Training y Nutrition NO se copian aquí.
 * Sus estados siguen perteneciendo a sus
 * respectivos módulos.
 */
export interface DailyRoutineTask
  extends BaseEntity {
  dailyRoutineId: string

  date: string

  sourceTemplateItemId: string | null

  block: TodayBlock

  order: number

  kind: TodayTaskKind

  title: string

  description: string | null

  /*
   * Snapshot de la regla de aplicabilidad
   * existente cuando se creó este día.
   */
  applicability: TodayApplicability

  status: TodayTaskStatus

  completedAt: string | null

  statusChangedAt: string | null

  /*
   * Snapshot de las reglas horarias que
   * correspondían a esta fecha.
   */
  targetTime: string | null

  latestTime: string | null

  timingApplies: boolean
}

/*
 * Jornada laboral efectiva de una fecha.
 *
 * Cambiar este registro afecta únicamente
 * a esa fecha.
 */
export interface WorkShift
  extends BaseEntity {
  date: string

  isWorking: boolean

  startTime: string | null

  endTime: string | null

  status: TodayTaskStatus

  statusChangedAt: string | null

  notes: string | null
}
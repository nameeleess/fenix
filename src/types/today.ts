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
   *
   * Ejemplo:
   * 07:00
   */
  targetTime: string | null

  /*
   * Hora límite cuando exista.
   *
   * Ejemplo:
   * 07:15
   */
  latestTime: string | null

  /*
   * Días de la semana en los que la regla
   * horaria es aplicable.
   *
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
 * Ejecución de Hoy correspondiente a una
 * fecha concreta.
 *
 * Su existencia NO significa que el usuario
 * haya iniciado visualmente el día.
 *
 * startedAt solo registra la acción UX:
 * "Iniciar día".
 */
export interface DailyRoutine
  extends BaseEntity {
  date: string

  templateId: string | null

  startedAt: string | null
}

/*
 * Snapshot histórico de una tarea concreta
 * de una fecha.
 *
 * Puede proceder de una plantilla o haber
 * sido creada únicamente para ese día.
 *
 * Training y Nutrition NO se copian aquí.
 * Sus estados continúan perteneciendo a sus
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
 * Es independiente de patrones futuros:
 * cambiar el turno de hoy no modifica
 * automáticamente otros días.
 */
export interface WorkShift
  extends BaseEntity {
  date: string

  isWorking: boolean

  startTime: string | null

  endTime: string | null

  status: TodayTaskStatus

  notes: string | null
}
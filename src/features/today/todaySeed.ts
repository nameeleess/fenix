import {
  db,
} from '../../db/database'

import type {
  DailyRoutineTemplate,
  DailyRoutineTemplateItem,
} from '../../types/today'

const TODAY_SEED_VERSION = '1'

const DEFAULT_TEMPLATE_ID =
  'today-template-default-v1'

function createBase(id: string) {
  const now =
    new Date().toISOString()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
}

function createInitialTemplate():
  DailyRoutineTemplate {
  return {
    ...createBase(
      DEFAULT_TEMPLATE_ID,
    ),

    name: 'Rutina base FÉNIX',

    description: null,

    isActive: true,
  }
}

function createInitialTemplateItems():
  DailyRoutineTemplateItem[] {
  return [
    {
      ...createBase(
        'today-item-wake-up',
      ),

      templateId:
        DEFAULT_TEMPLATE_ID,

      block: 'morning',

      order: 10,

      title: 'Levantarse',

      description:
        'Agua + hacer la cama.',

      applicability: 'always',

      targetTime: '07:00',

      latestTime: '07:15',

      timingDays: [
        1,
        2,
        3,
        4,
        5,
        6,
      ],
    },

    {
      ...createBase(
        'today-item-morning-hygiene',
      ),

      templateId:
        DEFAULT_TEMPLATE_ID,

      block: 'morning',

      order: 20,

      title: 'Higiene',

      description:
        'Dientes, cara, lentillas…',

      applicability: 'always',

      targetTime: null,

      latestTime: null,

      timingDays: null,
    },

    {
      ...createBase(
        'today-item-prepare-gym',
      ),

      templateId:
        DEFAULT_TEMPLATE_ID,

      block: 'morning',

      order: 30,

      title: 'Preparar gym',

      description: null,

      applicability:
        'training_day',

      targetTime: null,

      latestTime: null,

      timingDays: null,
    },

    {
      ...createBase(
        'today-item-night-hygiene',
      ),

      templateId:
        DEFAULT_TEMPLATE_ID,

      block: 'night',

      order: 10,

      title: 'Higiene',

      description: null,

      applicability: 'always',

      targetTime: null,

      latestTime: null,

      timingDays: null,
    },

    {
      ...createBase(
        'today-item-night-mobility',
      ),

      templateId:
        DEFAULT_TEMPLATE_ID,

      block: 'night',

      order: 20,

      title: 'Movilidad',

      description: null,

      applicability: 'always',

      targetTime: null,

      latestTime: null,

      timingDays: null,
    },
  ]
}

export async function ensureTodaySeed() {
  const currentVersion =
    await db.appMeta.get(
      'todaySeedVersion',
    )

  if (
    currentVersion?.value ===
    TODAY_SEED_VERSION
  ) {
    return
  }

  await db.transaction(
    'rw',

    db.appMeta,
    db.dailyRoutineTemplates,
    db.dailyRoutineTemplateItems,

    async () => {
      const existingTemplates =
        await db
          .dailyRoutineTemplates
          .toArray()

      const hasActiveTemplate =
        existingTemplates.some(
          (template) =>
            template.deletedAt ===
              null &&
            template.isActive,
        )

      /*
       * Regla crítica:
       *
       * El seed solo crea contenido
       * inicial si todavía no existe una
       * plantilla activa.
       *
       * Nunca sobrescribe posteriormente
       * una plantilla que el usuario haya
       * editado desde FÉNIX.
       */
      if (!hasActiveTemplate) {
        await db
          .dailyRoutineTemplates
          .add(
            createInitialTemplate(),
          )

        await db
          .dailyRoutineTemplateItems
          .bulkAdd(
            createInitialTemplateItems(),
          )
      }

      await db.appMeta.put({
        key: 'todaySeedVersion',

        value:
          TODAY_SEED_VERSION,

        updatedAt:
          new Date().toISOString(),
      })
    },
  )
}
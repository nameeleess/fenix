import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const SCREENSHOT_DIR = path.resolve('qa/v2.1/evidence/screenshots')

const visualOverflowFailures: string[] = []

export function resetVisualStateChecks() {
  visualOverflowFailures.length = 0
}

export function assertVisualStateChecks() {
  expect(visualOverflowFailures, `Visual overflow failures:\n${visualOverflowFailures.join('\n')}`).toEqual([])
}

export async function openApp(page: Page) {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
  if (!response || !response.ok()) {
    throw new Error(`FÉNIX preview navigation failed: status=${response?.status() ?? 'no-response'} url=${page.url()}`)
  }

  const mainNavigation = page.getByRole('navigation', { name: 'Navegación principal' })

  try {
    await expect(mainNavigation).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.fenix-route-loading')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible({ timeout: 15_000 })

    // Catch reload/update races: the shell must remain stable briefly after Today is ready.
    await page.waitForTimeout(300)
    await expect(mainNavigation).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible()
  } catch (error) {
    const diagnostics = await page.evaluate(async () => {
      let registrations: string[] = []
      try {
        if ('serviceWorker' in navigator) {
          registrations = (await navigator.serviceWorker.getRegistrations()).map((item) => item.scope)
        }
      } catch {
        registrations = ['<service-worker-inspection-failed>']
      }

      return {
        url: location.href,
        readyState: document.readyState,
        title: document.title,
        bodyText: document.body?.innerText.slice(0, 2400) ?? '',
        hasController: 'serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false,
        registrations,
      }
    })

    throw new Error([
      `FÉNIX browser boot did not stabilize: ${error instanceof Error ? error.message : String(error)}`,
      `diagnostics=${JSON.stringify(diagnostics)}`,
      `pageErrors=${JSON.stringify(pageErrors)}`,
      `consoleErrors=${JSON.stringify(consoleErrors)}`,
    ].join('\n'), { cause: error })
  }
}

export async function mainNav(page: Page, name: 'Hoy' | 'Training' | 'Nutrition' | 'Progreso') {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  const button = nav.getByRole('button', { name, exact: true })
  await expect(nav).toBeVisible()
  await button.click()
  await expect(button).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

export async function segmented(page: Page, navName: string, name: string) {
  const nav = page.getByRole('navigation', { name: navName })
  const button = nav.getByRole('button', { name, exact: true })
  await expect(nav).toBeVisible()
  await button.click()
  await expect(button).toHaveAttribute('aria-current', 'page')
}

export async function screenshotState(page: Page, fileName: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await expect(page.locator('body')).toBeVisible()
  await page.evaluate(async () => {
    window.scrollTo(0, 0)
    document.querySelectorAll<HTMLElement>('.ds-sheet,[role="dialog"]').forEach(element => element.scrollTo(0, 0))
    await document.fonts.ready
    const visibleImages = Array.from(document.images).filter(image => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0
    })
    await Promise.all(visibleImages.map(image => image.decode()))
  })
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const pixels = Math.max(0, document.documentElement.scrollWidth - viewportWidth)
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((item) => item.right > viewportWidth + 2 || item.left < -2)
      .sort((a, b) => Math.max(b.right - viewportWidth, -b.left) - Math.max(a.right - viewportWidth, -a.left))
      .slice(0, 8)
    return { pixels, offenders }
  })
  if (overflow.pixels > 2) {
    visualOverflowFailures.push(`${fileName}: horizontal overflow=${overflow.pixels}px; offenders=${JSON.stringify(overflow.offenders)}`)
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName), fullPage: false, animations: 'disabled' })
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
  const receipt = await page.evaluate(() => ({
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).filter(element => element.getClientRects().length).map(element => element.textContent?.trim()),
    entities: Array.from(document.querySelectorAll('[role="dialog"] [data-exercise-id]')).map(element => element.getAttribute('data-exercise-id')),
    visualRegionCandidates: Array.from(document.querySelectorAll<HTMLElement>([
      '.ds-phoenix-art',
      '.training-anatomy',
      '.training-exercise-anatomy',
      '.training-exercise-visual__media',
      '.recipe-visual',
      '.nutrition-vnext-meal__visual',
      '.today-dashboard-card img',
      '.today-hero img',
      '[data-central-autoexception]',
    ].join(','))).filter(element => {
      const box = element.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0
    }).map(element => {
      const box = element.getBoundingClientRect()
      return {
        selectorHint: element.getAttribute('data-central-autoexception') ?? (typeof element.className === 'string' ? element.className : element.tagName.toLowerCase()),
        x: Math.max(0, Math.round(box.x)),
        y: Math.max(0, Math.round(box.y)),
        w: Math.min(innerWidth, Math.round(box.right)) - Math.max(0, Math.round(box.x)),
        h: Math.min(innerHeight, Math.round(box.bottom)) - Math.max(0, Math.round(box.y)),
      }
    }),
    viewport: [innerWidth, innerHeight], deviceScaleFactor: devicePixelRatio,
  }))
  if (fileName.startsWith('09_')) expect(receipt.entities).toEqual(['ex-bench-press'])
  fs.writeFileSync(path.join(SCREENSHOT_DIR, `${fileName}.receipt.json`), JSON.stringify({
    state:fileName, captureStatus:'CAPTURE_ONLY_NOT_PARITY', ...receipt,
    actualSHA256:sha(fs.readFileSync(path.join(SCREENSHOT_DIR, fileName))),
    fixtureSHA256:sha(fs.readFileSync('qa/v2.1/e2e/helpers.ts')),
    activeFixtureSHA256:sha(fs.readFileSync('qa/v2.1/e2e/activeGoldenFixture.ts')),
    nutritionFixtureSHA256:sha(fs.readFileSync('qa/v2.1/e2e/nutritionGoldenFixture.ts')),
    harnessSHA256:sha(fs.readFileSync('qa/v2.1/e2e/visual.spec.ts')),
    contractSHA256:sha(fs.readFileSync('qa/v2.1/golden-screen-contract.json')),
    buildIndexSHA256:sha(fs.readFileSync('dist/index.html')),
  }, null, 2))
}

export async function closeTopSheet(page: Page) {
  const dialog = page.getByRole('dialog').last()
  if (await dialog.count()) {
    const close = dialog.getByRole('button', { name: 'Cerrar' }).first()
    if (await close.count()) await close.click()
  }
}


export async function seedGoldenVisualFacts(page: Page, goldenIndex?: string) {
  await page.evaluate(async (stateIndex) => {
    const request = indexedDB.open('fenix-db')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })

    const stores = [
      'weightEntries',
      'bodyMeasurements',
      'progressFeaturedExercises',
      'plannedWorkoutSessions',
      'workoutSessions',
      'workoutSessionExercises',
      'exerciseSets',
      'dailyRoutines',
      'dailyRoutineTasks',
      'workoutTemplates',
      'exercises',
      'dailyRoutineTemplates',
      'dailyRoutineTemplateItems',
      'workoutTemplateExercises',
      'appMeta',
      'workShifts',
    ]
    const tx = database.transaction(stores, 'readwrite')
    const getAll = <T,>(name: string) => new Promise<T[]>((resolve, reject) => {
      const op = tx.objectStore(name).getAll()
      op.onerror = () => reject(op.error)
      op.onsuccess = () => resolve(op.result as T[])
    })
    const put = (name: string, value: unknown) => tx.objectStore(name).put(value)
    // Remove only QA-owned planning/history rows before inserting the canonical
    // fixture. The browser context is isolated per visual state; production
    // data and the application schema are never touched by this fixture.
    tx.objectStore('plannedWorkoutSessions').clear()
    tx.objectStore('workoutSessions').clear()
    tx.objectStore('workoutSessionExercises').clear()
    tx.objectStore('exerciseSets').clear()
    const stamp = (id: string, at: string) => ({
      id, createdAt: at, updatedAt: at, deletedAt: null, version: 1,
    })

    const weightSeries = [
      ['2026-08-10', 70.1], ['2026-08-13', 69.6], ['2026-08-17', 68.8],
      ['2026-08-20', 68.1], ['2026-08-24', 67.3], ['2026-08-27', 66.9],
      ['2026-08-31', 66.4], ['2026-09-01', 66.1], ['2026-09-03', 66.2],
    ] as const
    for (const [date, weightKg] of weightSeries) {
      const at = `${date}T05:30:00.000Z`
      put('weightEntries', {
        ...stamp(`visual-weight-${date}`, at), date, recordedAt: at, weightKg,
        comparable: true, exceptionNote: null, notes: null, bodyFatPercent: null,
        fatMassKg: null, muscleMassKg: null, biaSource: null,
      })
    }

    const measures = [
      ['2026-07-03', 92.1, 33.4, 33.2],
      ['2026-08-03', 89.9, 34.0, 33.9],
      ['2026-09-03', 87.8, 34.6, 34.5],
    ] as const
    for (const [date, waistCm, rightArmCm, leftArmCm] of measures) {
      const at = `${date}T05:40:00.000Z`
      put('bodyMeasurements', {
        ...stamp(`visual-measure-${date}`, at), date, recordedAt: at, waistCm,
        rightArmCm, leftArmCm, notes: null,
      })
    }

    const exercises = await getAll<{ id: string; name: string; deletedAt: string | null }>('exercises')
    if (stateIndex === '09') {
      const bench = exercises.find(item => item.id === 'ex-bench-press')
      if (bench) put('exercises', { ...bench, techniqueNotes: 'Acuéstate en el banco con los pies firmes en el suelo y la espalda estable.\nBaja la barra de forma controlada hasta el pecho (mitad inferior).\nEmpuja la barra de manera explosiva manteniendo el control y una trayectoria estable.' })
    }
    // Isolated test facts, not claimed Golden values. Do not assign barbell loads
    // to mobility exercises merely because IndexedDB returns them first.
    const strengthIds = ['ex-bench-press', 'ex-incline-dumbbell-press', 'ex-seated-cable-row', 'ex-rdl', 'ex-ez-bar-curl']
    const activeExercises = strengthIds.map(id => exercises.find(item => item.id === id && item.deletedAt === null)).filter((item): item is typeof exercises[number] => Boolean(item))
    activeExercises.slice(0, 5).forEach((exercise, index) => {
      put('progressFeaturedExercises', {
        ...stamp(`visual-featured-${index + 1}`, '2026-09-03T05:45:00.000Z'),
        exerciseId: exercise.id, order: index + 1,
      })
    })

    const templates = await getAll<{ id: string; name: string; type?: string; dayOfWeek?: number | null; isFormalStrength?: boolean; estimatedDurationMinutes: number; deletedAt: string | null }>('workoutTemplates')
    const formal = templates.filter((item) => item.deletedAt === null && item.isFormalStrength)
    const lowerB = formal.find((item) => item.name.trim().toLocaleLowerCase() === 'lower b') ?? formal[0]
    // Keep one canonical future session. The app's deterministic planning
    // window would otherwise regenerate every weekday template on reload,
    // producing the wrong Golden surface (the agenda queue instead of the
    // single `PRÓXIMA SESIÓN` card).
    formal.forEach((template) => {
      if (stateIndex !== '04') tx.objectStore('workoutTemplates').put({ ...template, dayOfWeek: null })
    })
    if (stateIndex === '04') {
      const mobility = templates.find(item => item.id === 'workout-mobility-daily' && item.deletedAt === null)
      if (mobility) tx.objectStore('workoutTemplates').put({ ...mobility, dayOfWeek: 6 })
      const recovery = templates.find(item => item.id === 'workout-recovery-weekly' && item.deletedAt === null)
      if (recovery) tx.objectStore('workoutTemplates').put({ ...recovery, deletedAt: '2026-09-03T05:00:00.000Z' })
    }
    if (['07', '08', '10'].includes(stateIndex ?? '')) {
      const routine = formal.find(item => item.name === (stateIndex === '10' ? 'Upper A' : 'Upper B'))
      if (!routine) throw new Error('Canonical Upper routine missing')
      put('workoutTemplates', { ...routine, dayOfWeek: null, estimatedDurationMinutes: 55, description: stateIndex === '08' ? 'Rutina enfocada en el desarrollo del tren superior con énfasis en empuje y tirón, trabajando pecho, espalda y brazos de forma equilibrada.' : 'Fuerza e hipertrofia · Tren superior' })
      const configs = await getAll<{id:string;workoutTemplateId:string}>('workoutTemplateExercises')
      configs.filter(item => item.workoutTemplateId === routine.id).forEach(item => put('workoutTemplateExercises', { ...item, deletedAt: '2026-09-03T05:00:00.000Z' }))
      const ids = stateIndex === '10'
        ? ['ex-bench-press','ex-pull-up','ex-incline-dumbbell-press','ex-chest-supported-row','ex-lateral-raise','ex-face-pull']
        : ['ex-bench-press','ex-lat-pulldown','ex-chest-supported-row','ex-lateral-raise','ex-hammer-curl','ex-overhead-triceps-extension']
      ids.forEach((exerciseId, index) => {
        if (!exercises.some(item => item.id === exerciseId)) throw new Error(`Canonical exercise missing: ${exerciseId}`)
        put('workoutTemplateExercises', { ...stamp(`visual-upper-config-${index}`, '2026-09-03T05:00:00.000Z'), workoutTemplateId: routine.id, exerciseId, order:index+1,
          targetSets:index < 2 ? 4 : 3, minReps:[8,6,8,12,10,10][index], maxReps:[12,10,12,15,12,15][index],
          targetRirMin:index === 0 ? 2 : 1,targetRirMax:2,restSeconds:stateIndex==='10'?[90,120,90,90,60,60][index]:120,referenceWeight:exerciseId === 'ex-bench-press' ? 24 : null,alternativeExerciseIds:[],supersetGroupId:stateIndex==='10'&&index>=4?'A':null,targetSeconds:null })
      })
    }
    if (lowerB && stateIndex === '03') {
      const configs = await getAll<{id:string;workoutTemplateId:string}>('workoutTemplateExercises')
      configs.filter(config => config.workoutTemplateId === lowerB.id).forEach(config => put('workoutTemplateExercises', {...config,deletedAt:'2026-09-03T05:00:00.000Z'}))
      const lowerExercises = [
        ['ex-leg-press',4,8,12,2,2],['ex-leg-extension',3,12,15,1,2],['ex-leg-curl',3,10,12,1,2],['ex-hip-thrust',4,8,12,1,2],
      ] as const
      lowerExercises.forEach(([exerciseId,targetSets,minReps,maxReps,targetRirMin,targetRirMax],index) => put('workoutTemplateExercises', {
        ...stamp(`visual-lower-b-config-${index}`,'2026-09-03T05:00:00.000Z'),workoutTemplateId:lowerB.id,exerciseId,order:index+1,
        targetSets,minReps,maxReps,targetRirMin,targetRirMax,restSeconds:120,referenceWeight:null,alternativeExerciseIds:[],supersetGroupId:null,targetSeconds:null,
      }))
    }
    if (lowerB) {
      const at = '2026-09-04T06:00:00.000Z'
      put('plannedWorkoutSessions', {
        ...stamp('visual-focus-lower-b', at),
        workoutTemplateId: lowerB.id,
        templateName: lowerB.name,
        originalScheduledDate: '2026-09-04',
        scheduledDate: '2026-09-04',
        status: 'pending',
        executionSessionId: null,
        isFormalStrength: true,
        isExtra: false,
        estimatedDurationMinutes: lowerB.estimatedDurationMinutes ?? 60,
        rescheduleCount: 0,
        resolvedAt: null,
        notes: null,
      })
    }
    if (lowerB && stateIndex === '03') put('plannedWorkoutSessions', {
      ...stamp('visual-future-omission','2026-09-03T04:00:00.000Z'),workoutTemplateId:lowerB.id,templateName:lowerB.name,
      originalScheduledDate:'2026-09-05',scheduledDate:'2026-09-05',status:'omitted',executionSessionId:null,
      isFormalStrength:true,isExtra:false,estimatedDurationMinutes:60,rescheduleCount:0,resolvedAt:'2026-09-03T04:00:00.000Z',notes:'QA fixture: explicitly omitted future session',
    })
    const sessionDates = stateIndex === '09'
      ? ['2024-08-24']
      : ['2026-08-14','2026-08-17','2026-08-18','2026-08-20','2026-08-21','2026-08-24','2026-08-25','2026-08-27','2026-08-28','2026-08-31','2026-09-01','2026-09-02']
    if (stateIndex === '06') {
      // Twenty-eight independent historical sessions; totals are calculated by
      // the application from these facts, never painted into a QA-only KPI.
      const earlier = Array.from({length:16}, (_, index) => new Date(Date.UTC(2026, 6, 20 + index)).toISOString().slice(0,10))
      sessionDates.unshift(...earlier)
    }
    sessionDates.forEach((date, sessionIndex) => {
      const template = formal.find(item => item.name === (['Upper A','Lower A','Upper B','Lower B'][new Date(`${date}T12:00:00Z`).getUTCDay() === 1 ? 0 : new Date(`${date}T12:00:00Z`).getUTCDay() === 2 ? 1 : new Date(`${date}T12:00:00Z`).getUTCDay() === 5 ? 3 : 2])) ?? formal[0]
      if (!template) return
      const plannedId = `visual-planned-${date}`
      const sessionId = `visual-session-${date}`
      const startedAt = `${date}T06:00:00.000Z`
      const canonicalHistory: Record<string,[number,number]> = {
        '2026-09-02':[54,14], '2026-09-01':[62,16], '2026-08-31':[55,14], '2026-08-28':[58,15],
        '2026-08-27':[52,13], '2026-08-25':[60,16], '2026-08-24':[48,12], '2026-08-21':[57,15],
      }
      const [duration, totalSets] = stateIndex === '06' ? canonicalHistory[date] ?? [56,12] : [60,12]
      const endedAt = new Date(Date.parse(startedAt) + duration * 60000).toISOString()
      put('plannedWorkoutSessions', {
        ...stamp(plannedId, startedAt), workoutTemplateId: template.id, templateName: template.name,
        originalScheduledDate: date, scheduledDate: date, status: 'completed',
        executionSessionId: sessionId, isFormalStrength: true, isExtra: false,
        estimatedDurationMinutes: 60, rescheduleCount: 0, resolvedAt: endedAt, notes: null,
      })
      put('workoutSessions', {
        ...stamp(sessionId, startedAt), workoutTemplateId: template.id, templateName: template.name,
        status: 'completed', plannedWorkoutId: plannedId, startedAt, completedAt: endedAt,
        endedAt, notes: null,
      })
      activeExercises.slice(0, 4).forEach((exercise, exerciseIndex) => {
        const setCount = Math.floor(totalSets / 4) + (exerciseIndex < totalSets % 4 ? 1 : 0)
        const sessionExerciseId = `visual-session-ex-${sessionIndex}-${exerciseIndex}`
        put('workoutSessionExercises', {
          ...stamp(sessionExerciseId, startedAt), workoutSessionId: sessionId,
          sourceTemplateExerciseId: null, exerciseId: exercise.id, exerciseName: exercise.name,
          order: exerciseIndex + 1, targetSets: setCount, minReps: 8, maxReps: 12,
          targetRirMin: 1, targetRirMax: 2, restSeconds: 120,
          substitutedFromExerciseId: null, notes: null, targetSeconds: null,
        })
        for (let setIndex = 1; setIndex <= setCount; setIndex += 1) {
          put('exerciseSets', {
            ...stamp(`visual-set-${sessionIndex}-${exerciseIndex}-${setIndex}`, endedAt),
            workoutSessionId: sessionId, workoutSessionExerciseId: sessionExerciseId,
            exerciseId: exercise.id, exerciseName: exercise.name, order: setIndex, setType: 'working',
            weight: stateIndex === '09' && exerciseIndex === 0 ? 24 : 20 + exerciseIndex * 7.5, reps: stateIndex === '09' && exerciseIndex === 0 ? 10 : 8 + ((sessionIndex + setIndex) % 4),
            rir: 1 + (setIndex % 2), completedAt: endedAt,
          })
        }
      })
    })

    const routineTemplates = await getAll<{ id: string; deletedAt: string | null }>('dailyRoutineTemplates')
    const routineTemplate = routineTemplates.find((item) => item.deletedAt === null)
    if (routineTemplate && stateIndex === '01') {
      const existingRoutines=await getAll<{id:string;date:string}>('dailyRoutines')
      const current=existingRoutines.find(item=>item.date==='2026-09-03')
      if(!current) throw new Error('G01 requires the real current-day execution')
      const existingTasks=await getAll<{id:string;date:string}>('dailyRoutineTasks')
      existingTasks.filter(item=>item.date==='2026-09-03').forEach(item=>tx.objectStore('dailyRoutineTasks').delete(item.id))
      tx.objectStore('dailyRoutineTemplateItems').clear()
      const at='2026-09-03T05:00:00.000Z'
      put('dailyRoutines',{...current,startedAt:at})
      const entries=[['morning','Higiene','completed'],['morning','Movilidad','completed'],['development','Planificación','completed'],['night','Higiene','completed'],['night','Movilidad','skipped']]
      entries.forEach(([block,title,status],index)=>{
        const sourceId=`visual-today-definition-${index}`
        put('dailyRoutineTemplateItems',{...stamp(sourceId,at),templateId:routineTemplate.id,block,order:(index+1)*10,title,description:null,applicability:'always',targetTime:null,latestTime:null,timingDays:null})
        put('dailyRoutineTasks',{...stamp(`visual-today-task-${index}`,at),dailyRoutineId:current.id,date:'2026-09-03',sourceTemplateItemId:sourceId,block,order:(index+1)*10,kind:'routine',title,description:null,applicability:'always',status,completedAt:status==='completed'?at:null,statusChangedAt:at,targetTime:null,latestTime:null,timingApplies:true})
      })
      put('workShifts',{...stamp('visual-current-shift',at),date:'2026-09-03',isWorking:true,startTime:'09:00',endTime:'17:00',status:'pending',statusChangedAt:at,notes:null})
    }
    const routineDates = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']
    if (routineTemplate && stateIndex === '25') {
      // Synthetic reusable definition only inside this test's fresh origin.
      tx.objectStore('dailyRoutineTemplateItems').clear()
      const entries = [
        ['morning','Higiene','07:00','5 min'],['morning','Movilidad','07:10','10 min'],['morning','Lectura','07:30','15 min'],
        ['development','Trabajo profundo','09:00','90 min'],['development','Planificación','12:00','15 min'],['development','Comida','13:00','60 min'],
        ['night','Higiene','22:00','10 min'],['night','Lectura','22:15','20 min'],
      ]
      entries.forEach(([block,title,targetTime,description], index) => put('dailyRoutineTemplateItems', {
        ...stamp(`visual-settings-task-${index}`, '2026-09-03T05:00:00.000Z'),templateId:routineTemplate.id,block,title,targetTime,description,
        order:10*(index+1),applicability:'always',latestTime:null,timingDays:null,
      }))
    }
    if (stateIndex === '26') put('appMeta', { key:'v21:lastBackupExport', updatedAt:'2024-09-03T16:24:00.000Z', value:JSON.stringify({ exportedAt:'2024-09-03T16:24:00.000Z',fileName:'visual-backup.json',totalRecords:759 }) })
    if (routineTemplate) {
      routineDates.forEach((date, dayIndex) => {
        const routineId = `visual-routine-${date}`
        const at = `${date}T05:00:00.000Z`
        put('dailyRoutines', {
          ...stamp(routineId, at), date, templateId: routineTemplate.id, startedAt: at,
        })
        ;['Higiene', 'Movilidad', 'Preparar día', 'Cierre'].forEach((title, taskIndex) => {
          const status = (dayIndex + taskIndex) % 7 === 0 ? 'skipped' : 'completed'
          put('dailyRoutineTasks', {
            ...stamp(`visual-task-${date}-${taskIndex}`, at), dailyRoutineId: routineId, date,
            sourceTemplateItemId: null, block: taskIndex < 2 ? 'morning' : 'night',
            order: (taskIndex + 1) * 10, kind: 'routine', title, description: null,
            applicability: 'always', status, completedAt: status === 'completed' ? at : null,
            statusChangedAt: at, targetTime: null, latestTime: null, timingApplies: true,
          })
        })
      })
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Golden visual fixture transaction aborted'))
    })
    database.close()
  }, goldenIndex)
}

/**
 * The catalog seed intentionally restores built-in definitions on application
 * boot. Golden 04 represents the approved routine catalogue without the
 * unrelated Recovery template, so remove that QA-only row after boot and let
 * the Training view reread its current store. This never runs against a
 * production context or the user's database.
 */
export async function hideRecoveryForGolden04(page: Page) {
  await page.evaluate(async () => {
    const request = indexedDB.open('fenix-db')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const tx = database.transaction('workoutTemplates', 'readwrite')
    tx.objectStore('workoutTemplates').delete('workout-recovery-weekly')
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Golden 04 recovery cleanup aborted'))
    })
    database.close()
  })
}

/** Aligns only the synthetic G04 catalogue summaries with the approved state. */
export async function alignRoutineCatalogForGolden04(page: Page) {
  await page.evaluate(async () => {
    const request = indexedDB.open('fenix-db')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const tx = database.transaction(['workoutTemplates', 'workoutTemplateExercises', 'exercises'], 'readwrite')
    const all = <T,>(store: string) => new Promise<T[]>((resolve, reject) => {
      const operation = tx.objectStore(store).getAll()
      operation.onerror = () => reject(operation.error)
      operation.onsuccess = () => resolve(operation.result as T[])
    })
    const templates = await all<Record<string, unknown> & { id: string; name: string; version: number }>('workoutTemplates')
    const configs = await all<Record<string, unknown> & { id: string; workoutTemplateId: string; exerciseId: string; deletedAt: string | null; order: number; version: number }>('workoutTemplateExercises')
    const exercises = await all<{ id: string; deletedAt: string | null }>('exercises')
    const availableExerciseIds = exercises.filter(item => item.deletedAt === null).map(item => item.id)
    const targets: Record<string, { minutes: number; exercises: number }> = {
      'Upper A': { minutes: 55, exercises: 6 },
      'Lower A': { minutes: 60, exercises: 6 },
      'Upper B': { minutes: 55, exercises: 6 },
      'Lower B': { minutes: 60, exercises: 6 },
      'Movilidad diaria': { minutes: 10, exercises: 8 },
    }
    const at = '2026-09-03T05:00:00.000Z'
    for (const template of templates) {
      const target = targets[template.name]
      if (!target) continue
      tx.objectStore('workoutTemplates').put({ ...template, estimatedDurationMinutes: target.minutes, updatedAt: at, version: template.version + 1 })
      const rows = configs.filter(item => item.workoutTemplateId === template.id && item.deletedAt === null).sort((a, b) => a.order - b.order)
      rows.slice(target.exercises).forEach(row => tx.objectStore('workoutTemplateExercises').put({ ...row, deletedAt: at, updatedAt: at, version: row.version + 1 }))
      const used = new Set(rows.slice(0, target.exercises).map(row => row.exerciseId))
      const prototype = rows[0]
      for (let index = rows.length; prototype && index < target.exercises; index += 1) {
        const exerciseId = availableExerciseIds.find(id => !used.has(id))
        if (!exerciseId) break
        used.add(exerciseId)
        tx.objectStore('workoutTemplateExercises').put({
          ...prototype,
          id: `visual-g04-${template.id}-${index + 1}`,
          exerciseId,
          order: (index + 1) * 10,
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
          version: 1,
        })
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Golden 04 catalogue alignment aborted'))
    })
    database.close()
  })
}

export async function readStore<T = Record<string, unknown>>(page: Page, storeName: string): Promise<T[]> {
  return page.evaluate(async (name) => {
    const request = indexedDB.open('fenix-db')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      const tx = db.transaction(name, 'readonly')
      const store = tx.objectStore(name)
      const values = await new Promise<unknown[]>((resolve, reject) => {
        const all = store.getAll()
        all.onerror = () => reject(all.error)
        all.onsuccess = () => resolve(all.result)
      })
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
      })
      return values as T[]
    } finally {
      db.close()
    }
  }, storeName)
}

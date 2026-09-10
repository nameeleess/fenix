import assert from 'node:assert/strict'
import fs from 'node:fs'

const files={
 app:fs.readFileSync('src/App.tsx','utf8'),
 navigation:fs.readFileSync('src/components/AppNavigation.tsx','utf8'),
 today:fs.readFileSync('src/features/today/TodayPage.tsx','utf8'),
 training:fs.readFileSync('src/features/training/TrainingPage.tsx','utf8'),
 nutrition:fs.readFileSync('src/features/nutrition/NutritionPage.tsx','utf8'),
 library:fs.readFileSync('src/features/nutrition/NutritionLibrary.tsx','utf8'),
 progress:fs.readFileSync('src/features/progress/ProgressPage.tsx','utf8'),
 settings:fs.readFileSync('src/features/settings/SettingsPage.tsx','utf8'),
}
const contract=[
 ['01_HOY_Principal','today',['today-dashboard-grid']],['02_HOY_Dia_0','today',['Iniciar día']],
 ['03_TRAINING_Hoy','training',["label: 'Hoy'"]],['04_TRAINING_Rutinas','training',["label: 'Rutinas'"]],['05_TRAINING_Ejercicios','training',["label: 'Ejercicios'"]],['06_TRAINING_Historial','training',["label: 'Historial'"]],
 ['07_TRAINING_Sesion_en_curso','training',['TRAINING · EN CURSO']],['08_TRAINING_Detalle_rutina','training',['training-routine-detail-v21']],['09_TRAINING_Detalle_ejercicio','training',['training-exercise-detail-v21']],['10_TRAINING_Crear_Editar_rutina','training',['Crear rutina','Editar rutina']],['11_TRAINING_Crear_Editar_ejercicio','training',['Crear ejercicio','Editar ejercicio']],
 ['12_NUTRITION_Hoy','nutrition',["label: 'Hoy'"]],['13_NUTRITION_Semana','nutrition',["label: 'Semana'"]],['14_NUTRITION_Recetas','nutrition',["label: 'Recetas'"]],['15_NUTRITION_Compra','nutrition',["label: 'Compra'"]],['16_NUTRITION_Detalle_receta','library',['RecipeDetail']],['17_NUTRITION_Detalle_comida','nutrition',['nutrition-vnext-meal-detail-v21']],['18_NUTRITION_Crear_Editar_receta','library',['Crear receta']],
 ['19_PROGRESO_Resumen','progress',["label: 'Resumen'"]],['20_PROGRESO_Peso','progress',["label: 'Peso'"]],['21_PROGRESO_Rendimiento','progress',["label: 'Rendimiento'"]],['22_PROGRESO_Adherencia','progress',["label: 'Adherencia'"]],['23_PROGRESO_Cuerpo_Medidas','progress',["eyebrow=\"CUERPO\""]],
 ['24_AJUSTES_Principal','settings',["home: 'Ajustes'"]],['25_AJUSTES_Rutina_diaria','settings',['Rutina diaria']],['26_AJUSTES_Datos_Backup_Restore','settings',['Datos y backup','restoreFenixBackup']],
]
assert.equal(contract.length,26)
for(const [golden,key,tokens] of contract){for(const token of tokens)assert.ok(files[key].includes(token),`${golden}: missing ${token}`)}
for(const module of ['today','training','nutrition','progress'])assert.ok(files[module].includes('AppHeader'),`${module} missing AppHeader`)
assert.ok(files.app.includes('AppNavigation'), 'App must mount the shared primary navigation owner')
for(const nav of ['Hoy','Training','Nutrition','Progreso'])assert.ok(files.navigation.includes(nav),`primary nav ${nav}`)
assert.ok(!/settings[^\n]*navItems/i.test(files.app),'Settings must not become a fifth main tab')

console.log('FÉNIX v2.1 Golden reachability source gate: PASS (26/26 contract surfaces represented)')

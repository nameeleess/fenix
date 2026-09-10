import type { Page } from '@playwright/test'
import type { Recipe, NutritionGoal } from '../../../src/types/nutrition'
import type { WorkoutTemplate } from '../../../src/types/training'

export async function populateGoldenNutrition(page: Page, state?: string) {
  if (!['01','12','13','14','15','16','17','18'].includes(state ?? '')) return
  await page.evaluate(async (goldenState) => {
    const request=indexedDB.open('fenix-db')
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
    const tx=db.transaction(['workoutTemplates','plannedWorkoutSessions','recipes','ingredients','recipeIngredients','dailyMeals','nutritionGoals','shoppingItems'],'readwrite')
    const all=<T,>(name:string)=>new Promise<T[]>((resolve,reject)=>{const op=tx.objectStore(name).getAll();op.onsuccess=()=>resolve(op.result);op.onerror=()=>reject(op.error)})
    const now='2026-09-03T05:00:00.000Z'
    const stamp=(id:string)=>({id,createdAt:now,updatedAt:now,deletedAt:null,version:1})
    const template=(await all<WorkoutTemplate>('workoutTemplates')).find(item=>item.name==='Upper B'&&item.deletedAt===null)
    if(!template) throw new Error('Canonical Nutrition requires Upper B identity')
    const plannedId='visual-nutrition-upper-b'
    tx.objectStore('plannedWorkoutSessions').put({...stamp(plannedId),workoutTemplateId:template.id,templateName:template.name,
      originalScheduledDate:'2026-09-03',scheduledDate:'2026-09-03',status:'pending',executionSessionId:null,
      isFormalStrength:true,isExtra:false,estimatedDurationMinutes:55,rescheduleCount:0,resolvedAt:null,notes:null})
    const recipes=await all<Recipe>('recipes')
    recipes.filter(item=>item.isFavorite).forEach(item=>tx.objectStore('recipes').put({...item,isFavorite:false}))
    const definitions=[
      {id:'visual-recipe-oats-banana',name:'Avena + plátano + miel',role:'preworkout',category:'preworkout',type:'breakfast',kcal:560,protein:20,carbs:74,fat:12,volume:'compact'},
      {id:'visual-recipe-rice-whey-banana',name:'Crema de arroz + whey + plátano',role:'postworkout',category:'shake',type:'dish',kcal:560,protein:38,carbs:68,fat:8,volume:'voluminous'},
      {id:'visual-recipe-chicken-rice',name:'Arroz + pollo + verduras',role:'main_meal',category:'main_meal',type:'dish',kcal:820,protein:52,carbs:95,fat:20,volume:'voluminous'},
      {id:'visual-recipe-yogurt-berries',name:'Yogur griego + frutos del bosque',role:'snack',category:'bedtime',type:'snack',kcal:330,protein:20,carbs:30,fat:6,volume:'compact'},
      {id:'visual-recipe-salmon-potato',name:'Salmón + batata + ensalada',role:'dinner',category:'main_meal',type:'dish',kcal:580,protein:42,carbs:45,fat:18,volume:'voluminous'},
    ]
    if(goldenState==='14'){
      definitions[0].name='Tortitas de avena y claras'
      definitions[2].name='Arroz salteado con pollo y sofrito'
      definitions[3].name='Yogur griego + frutos rojos'
      definitions[4].name='Salmón + patata + ensalada'
    }
    const oldMeals=await all<{id:string;date:string}>('dailyMeals')
    oldMeals.filter(item=>item.date==='2026-09-03').forEach(item=>tx.objectStore('dailyMeals').delete(item.id))
    for (const [index,item] of definitions.entries()) {
      tx.objectStore('recipes').put({...stamp(item.id),name:item.name,category:item.category,recipeType:item.type,compatibleRoles:[item.role],volumeClass:item.volume,basePortion:1,nutritionDataQuality:'estimated',
        estimatedCalories:item.kcal,estimatedProtein:item.protein,estimatedCarbs:item.carbs,estimatedFat:item.fat,isFavorite:true,
        instructions:item.role==='postworkout'?'Mezcla la harina de arroz con la bebida en un cazo.\nCocina a fuego medio, removiendo hasta que espese.\nRetira del fuego, añade el whey y mezcla bien.\nSirve con el plátano en rodajas y espolvorea canela.':null,
        notes:item.role==='postworkout'?'Receta rápida, digestiva y perfecta para la recuperación post-entreno. Aporta carbohidratos de fácil asimilación y proteína de alta calidad.':null})
      const completed=index===0
      const goldenConsumed=goldenState==='12'&&completed
        ? {calories:1180,protein:86,carbs:132,fat:38}
        : {calories:item.kcal,protein:item.protein,carbs:item.carbs,fat:item.fat}
      tx.objectStore('dailyMeals').put({...stamp(`visual-nutrition-meal-${index}`),date:'2026-09-03',role:item.role,order:index+1,status:completed?'completed':'pending',
        trainingSessionId:index<2?plannedId:null,recipeId:item.id,name:item.name,isImprovised:false,portionMultiplier:1,
        plannedQuantity:1,plannedUnit:'ración',plannedCalories:item.kcal,plannedProtein:item.protein,plannedCarbs:item.carbs,plannedFat:item.fat,plannedDataQuality:'estimated',
        confirmedQuantity:completed?1:null,confirmedUnit:completed?'ración':null,confirmedCalories:completed?goldenConsumed.calories:null,confirmedProtein:completed?goldenConsumed.protein:null,
        confirmedCarbs:completed?goldenConsumed.carbs:null,confirmedFat:completed?goldenConsumed.fat:null,confirmedDataQuality:completed?'estimated':'unknown',confirmedAt:completed?now:null,
        skippedAt:null,notes:null,sourceRecipeVersion:1,planningSource:'manual'})
    }
    tx.objectStore('ingredients').put({...stamp('visual-ing-cinnamon'),name:'Canela',category:'pantry',defaultUnit:null,notes:null,nutritionDataQuality:'unknown'})
    const ingredients=[['ing-rice-cream',60,'g'],['ing-whey',30,'g'],['ing-banana',120,'g'],['ing-milk',200,'ml'],['visual-ing-cinnamon',null,null]]
    ingredients.forEach(([ingredientId,quantity,unit],index)=>tx.objectStore('recipeIngredients').put({...stamp(`visual-rice-ingredient-${index}`),recipeId:'visual-recipe-rice-whey-banana',ingredientId,order:index+1,quantity,quantityMax:null,unit,preparationState:null,notes:null}))
    const goals=await all<NutritionGoal>('nutritionGoals')
    const goal=goals.find(item=>item.deletedAt===null&&item.endsOn===null)
    if(goal) tx.objectStore('nutritionGoals').put({...goal,targetCalories:2850,targetProtein:160,targetCarbs:360,targetFat:80})
    if (goldenState === '15') {
      const catalog=await all<{id:string;name:string;deletedAt:string|null}>('ingredients')
      const wanted=['Pollo','Salmón','Arroz','Avena','Patata','Yogur griego','Plátanos','Espinacas','Aguacate','Tomate','Aceite de oliva','Miel','Pan integral','Almendras','Canela','Café','Sal','Pimienta','Pimentón','Orégano','Vinagre']
      const existing=await all<{id:string}>('shoppingItems')
      existing.forEach(item=>tx.objectStore('shoppingItems').delete(item.id))
      wanted.forEach((name,index)=>{
        let ingredient=catalog.find(item=>item.deletedAt===null&&item.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))
        if(!ingredient){
        const category=name==='Pollo'||name==='Salmón'?'protein':name==='Yogur griego'?'dairy':name==='Plátanos'||name==='Espinacas'||name==='Aguacate'||name==='Tomate'?'fruit_vegetable':'pantry'
          ingredient={...stamp(`visual-shopping-ingredient-${index}`),name,category,defaultUnit:null,notes:null,nutritionDataQuality:'unknown'}
          tx.objectStore('ingredients').put(ingredient)
        }
        const quantities:Record<string,[number,string]>={Pollo:[900,'g'],Salmón:[2,'filetes'],Arroz:[1.5,'kg'],Avena:[500,'g'],Patata:[1,'kg'],'Yogur griego':[6,'unidades'],Plátanos:[10,'unidades'],Espinacas:[200,'g'],Aguacate:[2,'unidades'],Tomate:[4,'unidades']}
        const [quantity,unit]=quantities[name]??[1,'unidad']
        tx.objectStore('shoppingItems').put({...stamp(`visual-shopping-${index}`),ingredientId:ingredient.id,quantity,quantityMax:null,unit,checked:index>=18,addedAt:now})
      })
    }
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})
    db.close()
  }, state)
}

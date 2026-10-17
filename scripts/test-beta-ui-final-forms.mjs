import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createRequire} from 'node:module'
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true})
try {
 for(const [phase,port] of [['after',4179]]) {
  const context=await browser.newContext({viewport:{width:390,height:844}})
  const page=await context.newPage()
  await page.goto(`http://127.0.0.1:${port}`)
  await page.getByRole('heading',{name:'HOME',exact:true}).waitFor()
  await page.getByRole('button',{name:'Training',exact:true}).click()
  await page.getByRole('button',{name:'Rutinas',exact:true}).click()
  await page.getByRole('button',{name:'Crear rutina',exact:true}).click()
  await page.getByLabel('Nombre',{exact:true}).fill('QA formulario móvil')
  await page.getByLabel('Descripción',{exact:true}).fill('Rutina sintética creada desde los controles visibles.')
  await page.getByRole('button',{name:'Añadir ejercicio',exact:true}).click()
  await page.getByRole('button',{name:'Añadir ejercicio',exact:true}).click()
  await page.locator('.training-definition-row').nth(1).getByRole('button',{name:'Subir',exact:true}).click()
  await page.locator('.training-definition-row').nth(1).getByRole('button',{name:'Quitar de rutina',exact:true}).click()
  await page.getByRole('button',{name:'Añadir ejercicio',exact:true}).click()
  for(const width of [320,375,390,430,768,1280]) {
   await page.setViewportSize({width,height:width>=768?960:844})
   await page.screenshot({path:`../../outputs/ot05/${phase}/routine-filled-${width}.png`,fullPage:true})
   if(phase==='after') {
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    assert.equal(await page.locator('.training-definition-numbers input').evaluateAll(nodes=>nodes.every(el=>parseFloat(getComputedStyle(el).fontSize)>=16)),true)
    await page.getByRole('button',{name:'Guardar rutina',exact:true}).scrollIntoViewIfNeeded()
    const button=await page.getByRole('button',{name:'Guardar rutina',exact:true}).boundingBox()
    const nav=await page.locator('.fenix-navigation').boundingBox()
    assert.ok(button.y+button.height<=nav.y,'Save action must be reachable above bottom nav')
   }
  }
  await page.getByRole('button',{name:'Guardar rutina',exact:true}).click()
  const card=page.locator('.training-routine-card').filter({has:page.getByRole('heading',{name:'QA formulario móvil',exact:true})})
  await card.waitFor()
  await card.getByRole('button',{name:'Editar rutina',exact:true}).click()
  await page.getByLabel('Nombre',{exact:true}).fill('QA formulario editado')
  await page.getByRole('button',{name:'Guardar rutina',exact:true}).click()
  const edited=page.locator('.training-routine-card').filter({has:page.getByRole('heading',{name:'QA formulario editado',exact:true})})
  await edited.getByRole('button',{name:'Planificar sesión',exact:true}).click()
  await page.getByRole('button',{name:'Confirmar planificación',exact:true}).click()
  await page.getByRole('button',{name:'Hoy',exact:true}).click()
  await page.locator('.training-session-hero').getByRole('heading',{name:'QA formulario editado',exact:true}).waitFor()
  console.log('PASS',phase,'UI create/edit/order/remove/plan routine; filled form screenshots at six widths')
  await context.close()
 }
 await fs.writeFile('../../outputs/ot05-form-result.txt','PASS: after real UI routine operations. After: six widths, no horizontal overflow, numeric fields >=16px, Save reachable above bottom navigation.\n')
} finally {await browser.close()}


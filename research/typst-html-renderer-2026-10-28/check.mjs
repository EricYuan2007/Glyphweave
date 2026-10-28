/* global URL, document */
import {chromium,firefox,webkit} from '@playwright/test';
import fs from 'node:fs/promises';
const root=new URL('./',import.meta.url);const results=[];
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch();
 for(const width of [1100,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
  await page.goto(new URL('gallery.html',root).href);await page.evaluate(()=>document.fonts.ready);
  const data=await page.locator('[data-gw-accessible-math]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,svg:n.querySelectorAll('.gw-layout-ink svg,.gw-layout-ink math,.gw-layout-ink canvas').length}}));
  if(data.length!==50||errors.length||data.some(d=>d.svg||d.width<=0||d.height<=0))throw new Error('Native formula rendering failed');
  if(width===1100)for(const i of [8,30,36,40])await page.locator('[data-gw-math]').nth(i).screenshot({path:new URL(`${name}-${i+1}.png`,root).pathname});
  results.push({name,width,errors,data});await page.close();
 }
 await browser.close();
}
await fs.writeFile(new URL('browser.json',root),JSON.stringify(results,null,2));console.log(results.map(r=>({name:r.name,width:r.width,count:r.data.length,errors:r.errors})));

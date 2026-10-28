/* global URL, document */
import fs from 'node:fs/promises';import {chromium} from '@playwright/test';
const root=new URL('./',import.meta.url);const native=await fs.readFile(new URL('gallery.html',root),'utf8');let ref=await fs.readFile(new URL('reference.html',root),'utf8');ref=ref.replace('</head>',native.match(/<style>body[\s\S]*?<\/style>/)[0]+'</head>');await fs.writeFile(new URL('reference-styled.html',root),ref);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1000},deviceScaleFactor:2});await p.goto(new URL('reference-styled.html',root).href);for(const i of [8,30,36])await p.locator('[data-gw-math]').nth(i).screenshot({path:new URL(`ref-${i+1}.png`,root).pathname});
await p.goto(new URL('gallery.html',root).href);await p.evaluate(()=>document.fonts.ready);for(const i of [8,30,36])await p.locator('[data-gw-math]').nth(i).screenshot({path:new URL(`html-${i+1}.png`,root).pathname});await b.close();

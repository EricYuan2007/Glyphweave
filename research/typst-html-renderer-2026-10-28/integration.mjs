/* global URL */
import {buildAll,defaultConfig} from '../../packages/core/dist/index.js';

import fs from 'node:fs/promises';import path from 'node:path';
const root=new URL('./site/',import.meta.url).pathname;
const post=path.join(root,'content/typst-posts/formulas');await fs.mkdir(post,{recursive:true});
await fs.copyFile(new URL('fixture/specimens.typ',import.meta.url),path.join(post,'index.typ'));
await fs.writeFile(path.join(post,'post.yaml'),'title: Formulas\nslug: formulas\ndescription: Native renderer verification\ndate: "2026-10-28"\nstatus: published\nvisibility: public\ntags: [Math]\npdf: false\n');
const cfg=defaultConfig();cfg.math.strategy='html-frame';cfg.math.html.binary=path.resolve('crates/typst-html/target/release/glyphweave-typst-html');
const first=await buildAll(root,cfg);const second=await buildAll(root,cfg);
console.log(JSON.stringify({first:first.cache,second:second.cache,math:first.built[0].manifest.capture.math,assets:first.built[0].manifest.assets},null,2));
await fs.writeFile(new URL('integration.json',import.meta.url),JSON.stringify({first:first.cache,second:second.cache,manifest:first.built[0].manifest},null,2));

const {exportGlyphweaveAssets}=await import('../../packages/astro/dist/index.js');
await exportGlyphweaveAssets(root,'public/glyphweave');
const published=await fs.readFile(path.join(root,'.glyphweave/content-index.json'),'utf8');
const original=await fs.readFile(path.join(post,'index.typ'),'utf8');
await fs.writeFile(path.join(post,'index.typ'),'$ cancel(x) $');
let rejected=false;
try{await buildAll(root,cfg)}catch(error){rejected=true;console.log('Unsupported geometry rejected:',error.message)}finally{await fs.writeFile(path.join(post,'index.typ'),original)}
if(!rejected)throw new Error('Unsupported geometry was silently accepted');
if(await fs.readFile(path.join(root,'.glyphweave/content-index.json'),'utf8')!==published)throw new Error('Failed native build changed published index');
console.log('Resource export and failed-build rollback passed');

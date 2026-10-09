import { build, transform } from 'esbuild';
import { mkdir, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import {generateDemoThumbnails} from './generate-demo-thumbnails.mjs';

/** Build only public entry points and assets; source modules stay in the repo.
 * @param {object} options Optional isolated source/output roots for build tests.
 * @returns {Promise<object>} Browser dependency metadata for verification.
 */
export async function buildSite({source=resolve('dist'),output=resolve('dist')}={}) {
  await generateDemoThumbnails(source);
  for(const name of ['client','server'])await rm(join(output,name),{recursive:true,force:true});
  const client=join(output,'client');
  await mkdir(client,{recursive:true});
  await cp(join(source,'index.html'),join(client,'index.html'));
  await cp(join(source,'locales'),join(client,'locales'),{recursive:true});
  await cp(join(source,'assets'),join(client,'assets'),{
    recursive:true,
    // Original JPEGs are build inputs; previews are already inlined.
    filter:path=>!['coffee-demo.jpg','ai-demo.jpg'].includes(basename(path)),
  });
  const browser=await build({entryPoints:{app:join(source,'app.mjs'),theme:join(source,'theme.js')},outdir:client,
    outExtension:{'.js':'.mjs'},bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',
    legalComments:'inline',metafile:true});
  // Theme runs before rendering and keeps its established classic-script URL.
  await cp(join(client,'theme.mjs'),join(client,'theme.js'));
  await rm(join(client,'theme.mjs'));
  const css=await transform(await readFile(join(source,'style.css'),'utf8'),{loader:'css',minify:true,legalComments:'inline'});
  await writeFile(join(client,'style.css'),css.code);
  await build({entryPoints:['server/worker.mjs'],outfile:join(output,'server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
  return browser.metafile;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await buildSite();

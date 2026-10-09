import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {buildSite} from '../scripts/build-site.mjs';

const execute=promisify(execFile);

test('standalone checkout builds only the public client without a hosting manifest',async()=>{
  const root=await mkdtemp(join(tmpdir(),'ovos-standalone-'));
  try{
    for(const name of ['scripts','package.json'])await cp(name,join(root,name),{recursive:true});
    await cp('dist',join(root,'dist'),{recursive:true,filter:path=>!['dist/client','dist/server'].includes(path)});
    await symlink(resolve('node_modules'),join(root,'node_modules'),'dir');
    await assert.rejects(readFile(join(root,'.openai/hosting.json')),{code:'ENOENT'});
    await execute(process.execPath,['scripts/build-site.mjs'],{cwd:root,timeout:30000});
    for(const file of ['client/index.html','client/app.mjs','client/theme.js','client/style.css']){
      assert.ok((await readFile(join(root,'dist',file))).length>0,file+' is built');
    }
    assert.ok(!(await readdir(join(root,'dist'))).includes('.openai'),'build emits no platform metadata');
    await assert.rejects(readFile(join(root,'dist/server/index.js')),{code:'ENOENT'});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('published output contains bundled entries and intended assets, never incidental source files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'ovos-build-'));
  try{
    const source=join(root,'source'),output=join(root,'output');
    await cp('dist',source,{recursive:true,filter:path=>!['dist/client','dist/server'].includes(path)});
    await writeFile(join(source,'private-debug.txt'),'PRIVATE_SENTINEL');
    await writeFile(join(source,'unused.mjs'),'throw Error("UNUSED_SENTINEL");');
    await writeFile(join(source,'demo-thumbnails.mjs'),'throw Error("STALE_GENERATED_FILE");');
    const original=await readFile('dist/demo-thumbnails.mjs','utf8');
    const meta=await buildSite({source,output});
    assert.equal(await readFile('dist/demo-thumbnails.mjs','utf8'),original,'isolated builds do not rewrite the real source');
    const client=join(output,'client');
    assert.deepEqual((await readdir(client)).sort(),['.nojekyll','CNAME','app.mjs','assets','index.html','locales','style.css','theme.js']);
    const app=await readFile(join(client,'app.mjs'),'utf8');
    assert.ok(!app.includes('PRIVATE_SENTINEL')&&!app.includes('UNUSED_SENTINEL'));
    assert.ok(!app.includes('STALE_GENERATED_FILE'));
    assert.ok(Object.values(meta.outputs).every(value=>value.imports.length===0));
    const modules=Object.keys(meta.inputs).map(path=>resolve(path).split('?')[0]);
    assert.equal(new Set(modules).size,modules.length,'shared modules are bundled once');
    for(const name of ['coffee-demo.jpg','ai-demo.jpg'])assert.ok(!(await readdir(join(client,'assets'))).includes(name));
    for(const name of ['fr-fr','de-de','kab-dz'])assert.ok(JSON.parse(await readFile(join(client,'locales',name+'.json'),'utf8')));
    assert.match(app,/data:image\/jpeg;base64/);
    const html=await readFile(join(client,'index.html'),'utf8');
    for(const file of ['app.mjs','theme.js','style.css']){assert.ok(html.includes('./'+file));assert.ok((await readFile(join(client,file))).length>0);}
    assert.equal(await readFile(join(client,'CNAME'),'utf8'),'start.openvoiceos.org\n');
    assert.match(html,/<link rel="canonical" href="https:\/\/start\.openvoiceos\.org\/">/);
    assert.match(html,/<meta property="og:url" content="https:\/\/start\.openvoiceos\.org\/">/);
    assert.doesNotMatch(html+app,/(?:start|installer)\.openvoiceos\.pt/,'published assets cannot send users to the retired domains');
    const policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    assert.ok(policy,'static hosting receives a CSP without relying on API response headers');
    assert.match(policy,/(?:^|; )connect-src 'self' https:\/\/start-api\.smartgic\.io(?:;|$)/);
    assert.match(policy,/(?:^|; )script-src 'self'(?:;|$)/);
    assert.match(policy,/(?:^|; )base-uri 'none'(?:;|$)/);
    assert.doesNotMatch(policy,/unsafe-eval|frame-ancestors/);
    assert.match(html,/<meta name="referrer" content="no-referrer">/);
    assert.ok(!app.includes('oai-authenticated-user-id')&&!app.includes('RELAY_ADMIN_KEY'));
    assert.ok(!app.includes('goldyfruit.chatgpt.site'));
    assert.ok(app.includes('https://installer.openvoiceos.org'),'published commands use the branded install origin');
    assert.ok(app.includes('https://start-api.smartgic.io/api/install'),'published browser tracking retains the API origin');
    await assert.rejects(readFile(join(output,'server/index.js')),{code:'ENOENT'});
  }finally{await rm(root,{recursive:true,force:true});}
});

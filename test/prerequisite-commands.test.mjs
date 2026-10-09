import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PACKAGE_SYSTEMS,DNF_CURL_CONFLICT_COMMAND} from '../dist/prerequisites.mjs';

/** Run only stub package managers: no network, sudo elevation or package changes.
 * @param {string} shell Tested shell. @param {string} command Displayed command.
 * @param {string} failOn Failing operation. @param {boolean} sudoAvailable Available sudo.
 * @returns {object} Exit status and exact received command arguments.
 */
function run(shell,command,failOn='',sudoAvailable=true){
 const dir=mkdtempSync(join(tmpdir(),'ovos-prereq-')),log=join(dir,'calls');
 try{
  if(sudoAvailable)writeFileSync(join(dir,'sudo'),'#!/bin/sh\nexec "$@"\n',{mode:0o700});
  for(const manager of ['apt','dnf','pacman','zypper'])writeFileSync(join(dir,manager),`#!/bin/sh
printf '%s' '${manager}' >> "$CALLS"
printf '<%s>' "$@" >> "$CALLS"
printf '\\n' >> "$CALLS"
if [ '${manager}:'"$1" = "$FAIL_ON" ]; then exit 42; fi
`,{mode:0o700});
  const args=[...(shell.endsWith('/bash')?['--noprofile','--norc']:[]),'-c',command];
  const result=spawnSync(shell,args,{encoding:'utf8',env:{PATH:dir,CALLS:log,FAIL_ON:failOn},timeout:5000});
  assert.equal(result.error,undefined);return {...result,calls:existsSync(log)?readFileSync(log,'utf8').trim().split('\n'):[]};
 }finally{rmSync(dir,{recursive:true,force:true});}
}

const expected={debian:['apt<update>','apt<install><curl><git><sudo><bash>'],fedora:['dnf<install><curl><git><sudo><bash>'],arch:['pacman<-Syu><--needed><curl><git><sudo><bash>'],suse:['zypper<refresh>','zypper<install><curl><git><sudo><bash>']};
const shells=['/bin/sh','/bin/bash',...(process.env.DASH_BIN?[process.env.DASH_BIN]:[])];
for(const shell of shells){
 test(shell+': installed-curl recovery requests only remaining tools and preserves failures',()=>{
  const result=run(shell,DNF_CURL_CONFLICT_COMMAND);assert.equal(result.status,0);assert.deepEqual(result.calls,['dnf<install><git><sudo><bash>']);
  assert.equal(run(shell,DNF_CURL_CONFLICT_COMMAND,'dnf:install').status,42);
  const missing=run(shell,DNF_CURL_CONFLICT_COMMAND,'',false);assert.notEqual(missing.status,0);assert.deepEqual(missing.calls,[]);
 });
 test(`${shell}: preparation commands preserve exact named packages and interactive package-manager prompts`,()=>{
  for(const [family,item] of Object.entries(PACKAGE_SYSTEMS)){
   const result=run(shell,item.command);assert.equal(result.status,0,family);assert.deepEqual(result.calls,expected[family]);
   assert.doesNotMatch(item.command,/--allowerasing|--noconfirm|--force|--allow-unauthenticated|\s-y\b|\/usr\/bin/);
  }
 });
 test(`${shell}: failed refresh stops installation and package-manager failures remain failures`,()=>{
  for(const [family,operation] of [['debian','apt:update'],['suse','zypper:refresh']]){
   const result=run(shell,PACKAGE_SYSTEMS[family].command,operation);assert.equal(result.status,42);assert.deepEqual(result.calls,[expected[family][0]]);
  }
  for(const [family,operation] of [['debian','apt:install'],['fedora','dnf:install'],['arch','pacman:-Syu'],['suse','zypper:install']])assert.equal(run(shell,PACKAGE_SYSTEMS[family].command,operation).status,42);
 });
 test(`${shell}: missing sudo never runs any package manager or reports success`,()=>{
  for(const item of Object.values(PACKAGE_SYSTEMS)){const result=run(shell,item.command,'',false);assert.notEqual(result.status,0);assert.deepEqual(result.calls,[]);}
 });
}

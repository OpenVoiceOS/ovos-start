import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync,readdirSync,symlinkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

import {DEFAULTS} from '../dist/scenario.mjs';
import {buildShortCommand,buildSetupScript,issueSetup,INSTALL_LINK_ORIGIN} from '../dist/short-setup.mjs';
import {isPreviewContext,liveWizardUrl} from '../dist/preview.mjs';

// Reviewed real HTTP response bodies keep this suite runnable in a standalone checkout.
const responses=JSON.parse(readFileSync(new URL('./fixtures/relay-launch.json',import.meta.url),'utf8'));
const RELAY_LAUNCHER_URL=responses.launcher;
const LAUNCH_ERRORS=responses.messages;
const launchError=(locale,unavailable)=>responses.errors[locale][unavailable?1:0];
if(process.env.OVOS_RELAY_ROOT){
 const relay=resolve(process.env.OVOS_RELAY_ROOT);
 const source=await import(pathToFileURL(join(relay,'server/launch.mjs')));
 const errors=await import(pathToFileURL(join(relay,'server/launch-errors.mjs')));
 assert.equal(source.LAUNCHER_URL,responses.launcher);
 assert.equal(source.bootstrap(responses.code,responses.writeToken),responses.bootstrap);
 assert.deepEqual(errors.LAUNCH_ERRORS,responses.messages);
 for(const locale of Object.keys(responses.errors))for(const unavailable of [false,true]){
  assert.equal(errors.launchError(locale,unavailable),launchError(locale,unavailable));
 }
}

const now=1800000000,setup=issueSetup({...DEFAULTS,device:'computer',channel:'testing'},now),token='A'.repeat(22),writeToken='b'.repeat(64);
const launchUrl=`${INSTALL_LINK_ORIGIN}/s/${token}`;
assert.equal(setup.code,responses.code);assert.equal(writeToken,responses.writeToken);
const actualBootstrap=Buffer.from(responses.bootstrap);
const shells=[{name:'sh',path:'/bin/sh'},{name:'bash',path:'/bin/bash'}];
if(process.env.DASH_BIN)shells.push({name:'dash',path:process.env.DASH_BIN});

// The helper grants the pipeline its own controlling terminal; the installer's
// stdin must come from /dev/tty, not curl's script stream. No real installer runs.
const ptyHelper=String.raw`
import errno, os, pty, select, signal, sys, time
pid, master = pty.fork()
if pid == 0:
    os.execvpe(sys.argv[1], [sys.argv[1], '-c', sys.argv[2]], os.environ)
output = bytearray()
status = None
sent = False
try:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        readable, _, _ = select.select([master], [], [], 0.05)
        if readable:
            try:
                chunk = os.read(master, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                chunk = b''
            output.extend(chunk)
            if not sent and b'OVOS_TEST_LAUNCHER_READY' in output:
                os.write(master, b'interactive reply\n')
                sent = True
        ended, candidate = os.waitpid(pid, os.WNOHANG)
        if ended:
            status = candidate
            break
    if status is None:
        raise RuntimeError('PTY launcher timed out')
    sys.stdout.buffer.write(output)
    result = os.waitstatus_to_exitcode(status)
    sys.exit(result if result >= 0 else 128-result)
finally:
    if status is None:
        os.killpg(pid, signal.SIGTERM)
        os.waitpid(pid, 0)
    os.close(master)
`;

/** Isolate both curl requests, scripts and terminal markers; never access the network. @param {object} shell @returns {object} */
function fixture(shell){
 const dir=mkdtempSync(join(tmpdir(),'ovos-pipe-')),bin=join(dir,'bin'),marker=join(dir,'executed'),args=join(dir,'arguments'),log=join(dir,'curl.log');
 // mkdir through the fs module keeps setup independent of either tested shell.
 mkdirSync(bin);symlinkSync(shell.path,join(bin,'sh'));
 const outer=join(dir,'outer.sh'),inner=join(dir,'inner.sh');
 writeFileSync(join(bin,'curl'),`#!/bin/sh
set -eu
if [ "$#" -eq 8 ] && [ "$1" = -qfsS ] && [ "$2" = --proto ] && [ "$3" = =https ] && [ "$4" = --connect-timeout ] && [ "$5" = 15 ] && [ "$6" = -m ] && [ "$7" = 120 ] && [ "$8" = "$EXPECTED_PIN" ]; then
  printf '%s\\n' inner >> "$CURL_LOG"
  cat "$INNER_BODY"
  result=$INNER_EXIT
elif [ "$#" -ge 3 ] && [ "$2" = -m120 ] && [ "$3" = "$EXPECTED_OUTER" ]; then
  printf '%s\\n' outer >> "$CURL_LOG"
  if [ "$#" -eq 3 ] && [ "$1" = -qfsS ]; then
    cat "$OUTER_BODY"
  else
    printf '%s\\n' 'Unexpected outer curl arguments' >&2; exit 99
  fi
  result=$OUTER_EXIT
elif [ "$#" -eq 10 ] && [ "$1" = -qfsS ] && [ "$2" = --proto ] && [ "$3" = =https ] && [ "$4" = --connect-timeout ] && [ "$5" = 15 ] && [ "$6" = -m ] && [ "$7" = 120 ] && [ "$8" = "$EXPECTED_OUTER" ] && [ "$9" = -o ]; then
  printf '%s\\n' outer >> "$CURL_LOG"
  cat "$OUTER_BODY" > "\${10}"
  result=$OUTER_EXIT
else
  printf '%s\\n' 'Unexpected curl request: network is disabled in this test' >&2; exit 99
fi
if [ "$result" -ne 0 ]; then printf '%s\\n' 'curl: simulated download failure' >&2; fi
exit "$result"
`,{mode:0o700});
 const launcher='#!/bin/sh\nprintf "%s\\n" "$@" > "$ARGUMENTS"\n[ -t 0 ] || exit 90\nprintf "OVOS_TEST_LAUNCHER_READY\\n"\nIFS= read -r answer || exit 91\nprintf "%s" "$answer" > "$MARKER"\nexit "$LAUNCH_EXIT"\n';
 return {dir,marker,args,
  calls(){return existsSync(log)?readFileSync(log,'utf8').trim().split('\n'):[];},
  run(content,{outerExit=0,innerExit=0,innerBody=launcher,launchExit=0,artifact=setup,capability=token,download=false,pty=false}={}){
   for(const path of [marker,args,log])rmSync(path,{force:true});
   writeFileSync(outer,content);writeFileSync(inner,innerBody);
   const env={...process.env,PATH:bin+':'+process.env.PATH,TMPDIR:dir,OUTER_BODY:outer,INNER_BODY:inner,OUTER_EXIT:String(outerExit),INNER_EXIT:String(innerExit),LAUNCH_EXIT:String(launchExit),CURL_LOG:log,MARKER:marker,ARGUMENTS:args,EXPECTED_PIN:RELAY_LAUNCHER_URL,EXPECTED_OUTER:launchUrl};
   const command=download?buildSetupScript(artifact,now,capability):buildShortCommand(artifact,now,capability);
   const options={input:'hello\n',encoding:'utf8',env,timeout:15000,maxBuffer:1024*1024};
   const result=pty?spawnSync(process.env.PYTHON||'python3',['-c',ptyHelper,shell.path,command],options):spawnSync(shell.path,['-c',command],{...options,detached:true});
   assert.equal(result.error,undefined,result.error?.message);
   assert.equal(result.signal,null,'shell must exit normally');
   assert.notEqual(result.status,99,'curl arguments no longer match the reviewed contract');
   return result;
  },
  close(){rmSync(dir,{recursive:true,force:true});}
 };
}

test('tracked command is the short bounded pipe; downloaded scripts retain full-download guards',()=>{
 const command=buildShortCommand(setup,now,token);
 assert.equal(command,`curl -qfsS -m120 ${launchUrl} | sh`);
 assert.ok(command.length<90,'public hostname keeps the command short');
 assert.doesNotMatch(command,/mktemp|sh -c|printf|--track/);
 assert.ok(!command.includes(writeToken));assert.ok(!command.includes(setup.code));
 const script=buildSetupScript(setup,now,token);
 assert.match(script,/^#!\/bin\/sh\n/);assert.match(script,/mktemp -d/);
 assert.match(script,/trap 'rm -rf/);assert.match(script,/sh -n/);
 assert.doesNotMatch(script,/\|\s*sh/);
 for(const capability of [null,undefined,'','bad','A'.repeat(21),'A'.repeat(22)+'\n','$(id)']){
  assert.throws(()=>buildShortCommand(setup,now,capability));
  assert.throws(()=>buildSetupScript(setup,now,capability));
 }
});

for(const shell of shells){
 test(`${shell.name}: every byte prefix of the actual relay bootstrap performs no installer work`,()=>{
  const f=fixture(shell);try{
   assert.equal(actualBootstrap.subarray(0,2).toString(),'(\n');assert.equal(actualBootstrap.at(-1),41);
   for(let length=0;length<actualBootstrap.length;length++){
    const result=f.run(actualBootstrap.subarray(0,length));
    assert.deepEqual(f.calls(),['outer'],`inner download started at byte ${length}`);
    assert.equal(existsSync(f.marker),false,`launcher ran at byte ${length}`);
    assert.equal(existsSync(f.args),false,`launcher accepted arguments at byte ${length}`);
    if(length)assert.notEqual(result.status,0,`incomplete body returned success at byte ${length}`);
    else assert.equal(result.status,0,'an empty POSIX pipeline is a no-op');
   }
  }finally{f.close();}
 });

 test(`${shell.name}: empty failed outer transfers are a no-op, not proof of installation`,()=>{
  const f=fixture(shell);try{
   for(const outerExit of [0,6,22,28,35,60]){
    const result=f.run('',{outerExit});
    assert.equal(result.status,0,'POSIX returns the final empty shell status');
    assert.deepEqual(f.calls(),['outer']);assert.equal(existsSync(f.marker),false);assert.equal(existsSync(f.args),false);
    if(outerExit)assert.match(result.stderr,/simulated download failure/);
   }
  }finally{f.close();}
 });

 test(`${shell.name}: actual localized relay errors remain readable and unsuccessful`,()=>{
  const f=fixture(shell);try{
   for(const [locale,messages] of Object.entries(LAUNCH_ERRORS))for(const unavailable of [false,true]){
    const result=f.run(launchError(locale,unavailable));
    assert.equal(result.status,1);assert.equal(result.stderr,messages[unavailable?1:0]+'\n');assert.equal(result.stdout,'');
    assert.deepEqual(f.calls(),['outer']);assert.equal(existsSync(f.marker),false);
   }
  }finally{f.close();}
 });

 test(`${shell.name}: failed or empty pinned-launcher downloads never execute`,()=>{
  const f=fixture(shell);try{
   for(const innerExit of [22,28,60]){
    const result=f.run(actualBootstrap,{innerExit});
    assert.equal(result.status,1);assert.match(result.stderr,/Could not download the installer/);
    assert.deepEqual(f.calls(),['outer','inner']);assert.equal(existsSync(f.marker),false);assert.equal(existsSync(f.args),false);
   }
   const empty=f.run(actualBootstrap,{innerBody:''});
   assert.equal(empty.status,1);assert.match(empty.stderr,/installer download was empty/);assert.equal(existsSync(f.args),false);
  }finally{f.close();}
 });

 test(`${shell.name}: a missing controlling terminal is explained before launcher execution`,()=>{
  const f=fixture(shell);try{
   const result=f.run(actualBootstrap);
   assert.equal(result.status,1);assert.match(result.stderr,/Open Terminal/);
   assert.deepEqual(f.calls(),['outer','inner']);assert.equal(existsSync(f.args),false);
  }finally{f.close();}
 });

 test(`${shell.name}: complete bootstrap preserves tty, exact arguments and launcher status`,()=>{
  const f=fixture(shell);try{
   for(const launchExit of [0,7,130]){
    const result=f.run(actualBootstrap,{pty:true,launchExit});
    assert.equal(result.status,launchExit);assert.equal(readFileSync(f.marker,'utf8'),'interactive reply');
    assert.deepEqual(readFileSync(f.args,'utf8').trim().split('\n'),[setup.code,'--track',writeToken]);
    assert.deepEqual(f.calls(),['outer','inner']);
   }
  }finally{f.close();}
 });

 test(`${shell.name}: a complete bootstrap may execute even if outer curl subsequently fails`,()=>{
  const f=fixture(shell);try{
   const result=f.run(actualBootstrap,{outerExit:28,pty:true,launchExit:7});
   assert.equal(result.status,7,'pipeline status is the launcher, not outer curl');
   assert.match(result.stdout,/simulated download failure/);
   assert.equal(readFileSync(f.marker,'utf8'),'interactive reply');assert.deepEqual(f.calls(),['outer','inner']);
  }finally{f.close();}
 });

 test(`${shell.name}: downloads reject failed or incomplete transfers and always remove private files`,()=>{
  const f=fixture(shell);try{
   const cleaned=()=>assert.deepEqual(readdirSync(f.dir).filter(name=>name.startsWith('ovos-start.')),[]);
   for(const outerExit of [6,22,28,35,60]){
    const result=f.run(actualBootstrap,{download:true,outerExit});
    assert.equal(result.status,1);assert.match(result.stderr,/Could not get the installer/);
    assert.deepEqual(f.calls(),['outer']);assert.equal(existsSync(f.args),false);cleaned();
   }
   for(const body of ['',actualBootstrap.subarray(0,1),actualBootstrap.subarray(0,-1),'<html>Unavailable</html>']){
    const result=f.run(body,{download:true});
    assert.equal(result.status,1);assert.match(result.stderr,/download was incomplete/);
    assert.deepEqual(f.calls(),['outer']);assert.equal(existsSync(f.args),false);cleaned();
   }
   for(const status of [0,7,130,143]){
    const result=f.run(`(\nread reply\nprintf "%s" "$reply"\nexit ${status}\n)`,{download:true});
    assert.equal(result.status,status);assert.equal(result.stdout,'hello');assert.equal(result.stderr,'');cleaned();
   }
  }finally{f.close();}
 });
}

test('localhost, loopback, file and explicit simulation are distinct from a live wizard',()=>{
 for(const hostname of ['localhost','review.localhost','127.0.0.1','127.1.2.3','[::1]'])assert.equal(isPreviewContext({hostname,protocol:'http:'}),true);
 assert.equal(isPreviewContext({hostname:'',protocol:'file:'}),true);
 assert.equal(isPreviewContext({hostname:'preview.example',protocol:'https:'},'simulated'),true);
 assert.equal(isPreviewContext({hostname:'start.openvoiceos.pt',protocol:'https:'}),false);
 const url=new URL(liveWizardUrl({...setup,launchToken:token}));assert.equal(url.hash,'#setup='+setup.code);assert.ok(!url.href.includes(token));
});

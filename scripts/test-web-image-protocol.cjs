const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root='../Ianto/';
function area(seed={}){const data={...seed};return {data,get:async key=>key==null?{...data}:typeof key==='string'?{[key]:data[key]}:{},set:async value=>Object.assign(data,value),remove:async key=>{delete data[key];}};}
async function test(){
 const local=area({chatgptWebAutomationTab:{tabId:3,conversationKey:'same'},geminiWebAutomationTab:{tabId:2,conversationKey:'same'}}),session=area();
 const tabs=new Map([[1,{id:1,url:'http://localhost:3000/web/taotu.html',windowId:9,active:false}],[4,{id:4,url:'http://localhost:3000/web/zhutu.html',windowId:9,active:false}],[2,{id:2,url:'https://gemini.google.com/app',active:false}],[3,{id:3,url:'https://chatgpt.com/',active:false}]]);
 const messages=[],handlers=[],removedHandlers=[];let workerBuild='2026-09-08.4',nextTabId=10;
 const chrome={storage:{local,session},runtime:{getManifest:()=>({version:'2.6.9'}),onMessage:{addListener:handler=>handlers.push(handler)},lastError:null},tabs:{get:async id=>{if(!tabs.has(id))throw new Error('No tab');return tabs.get(id);},create:async data=>{const tab={id:nextTabId++,url:data.url,windowId:9,active:!!data.active,status:'complete'};tabs.set(tab.id,tab);return tab;},update:async(id,data)=>Object.assign(tabs.get(id),data),remove:async id=>{tabs.delete(id);removedHandlers.forEach(handler=>handler(id));},group:async()=>1,sendMessage:(id,msg,callback)=>{messages.push({id,msg});callback(msg.action.endsWith('WorkerPing')?{ready:true,protocolVersion:2,workerBuild}:{accepted:true});},onUpdated:{addListener(){},removeListener(){}},onRemoved:{addListener:handler=>removedHandlers.push(handler)}},tabGroups:{update:async()=>{}},windows:{update:async()=>{}}};
 const source=fs.readFileSync(root+'background.js','utf8');const ctx=vm.createContext({chrome,console,Map,Date,setTimeout,clearTimeout});
 vm.runInContext(source.slice(source.indexOf('const WEB_IMAGE_PROTOCOL =')),ctx);vm.runInContext('geminiWebDelay=async()=>{}',ctx);
 const dispatch=(provider,jobId,restoreEditor,originTabId=1)=>ctx.geminiWebDispatchJob({provider,jobId,protocolVersion:2,bridgeBuild:'2026-09-08.4',conversationKey:'same',prompt:'test',images:[],restoreEditor},originTabId);
 await dispatch('chatgpt','gpt-test',false);
 const run=messages.find(entry=>entry.msg.action==='runChatGPTWebImageJob');assert.equal(run.id,3);assert.equal(run.msg.provider,'chatgpt');assert.equal(run.msg.originTabId,1);
 assert(!messages.some(entry=>entry.msg.action==='runGeminiWebImageJob'));
 await ctx.geminiWebActivateForJob({provider:'chatgpt',jobId:'gpt-test',originTabId:1},{tab:tabs.get(3)});
 await assert.rejects(()=>ctx.geminiWebActivateForJob({provider:'gemini',jobId:'gpt-test',originTabId:1},{tab:tabs.get(3)}),/ACTIVATE_CONTEXT/);
 await assert.rejects(()=>dispatch('chatgpt','second',false,4),/PROVIDER_BUSY/);
 // Service worker suspension must not erase task ownership.
 vm.runInContext('geminiWebActiveJobs.clear()',ctx);
 await ctx.geminiWebActivateForJob({provider:'chatgpt',jobId:'gpt-test',originTabId:1},{tab:tabs.get(3)});
 await ctx.geminiWebStoreResult('gpt-test',{success:true});assert.equal(tabs.get(3).active,true);assert.equal(Object.keys(session.data).length,0);
 await dispatch('chatgpt','closed-tab',false);
 await chrome.tabs.remove(3);await new Promise(resolve=>setTimeout(resolve,0));await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(local.data['geminiWebResult_closed-tab'].error,/PROVIDER_TAB_CLOSED/);
 await dispatch('chatgpt','reopened-tab',false);
 const reopened=messages.find(entry=>entry.msg.jobId==='reopened-tab');assert(reopened.id!==3&&tabs.has(reopened.id));
 await ctx.geminiWebStoreResult('reopened-tab',{success:true});
 await dispatch('chatgpt','old-active',false);const oldActive=messages.find(entry=>entry.msg.jobId==='old-active');
 await dispatch('chatgpt','same-editor-takeover',false);const takeover=messages.find(entry=>entry.msg.jobId==='same-editor-takeover');
 assert.notEqual(takeover.id,oldActive.id);assert(!session.data['webImageJob_old-active']);assert(session.data['webImageJob_same-editor-takeover']);
 await ctx.geminiWebStoreResult('same-editor-takeover',{success:true});
 await dispatch('gemini','gm-test',true);assert(messages.some(entry=>entry.msg.action==='runGeminiWebImageJob'&&entry.id===2));await ctx.geminiWebStoreResult('gm-test',{success:true});assert.equal(tabs.get(1).active,true);
 workerBuild='old';await assert.rejects(()=>dispatch('chatgpt','old-worker'),/WORKER_VERSION/);
 await assert.rejects(()=>ctx.geminiWebDispatchJob({provider:'chatgpt',jobId:'old-client'},1),/CLIENT_VERSION/);
 console.log('PASS exact routing, closed-tab recovery, same-editor takeover, cross-editor busy isolation, restore editor, version checks');
 // Client-side actual payload, no DOM automation or network calls.
 const listeners=new Map(),requests=[];let compatible=true;
 let holdWeb=false;
 const document={readyState:'loading',documentElement:{},getElementById:()=>null,addEventListener:(key,fn)=>listeners.set(key,fn),dispatchEvent(event){requests.push(event);if(event.type==='REQUEST_IANTO_GEMINI_WEB_PING')listeners.get('RESPONSE_IANTO_GEMINI_WEB_PING')({detail:{requestId:event.detail.requestId,success:true,version:'2.6.9',protocolVersion:compatible?2:null,bridgeBuild:compatible?'2026-09-08.4':null,backgroundBuild:compatible?'2026-09-08.4':null,providers:['gemini','chatgpt']}});else if(event.type==='REQUEST_GEMINI_WEB_IMAGE'&&!holdWeb)listeners.get('RESPONSE_GEMINI_WEB_IMAGE')({detail:{requestId:event.detail.requestId,success:true,imageDataUrl:'data:image/png;base64,eA=='}});}};
 const client=vm.createContext({document,console,CustomEvent:function(type,options){this.type=type;this.detail=options.detail},setTimeout,clearTimeout,MutationObserver:class{observe(){}},crypto:{randomUUID:()=>String(Math.random())}});
 vm.runInContext(fs.readFileSync('public/ianto-gemini-web.js','utf8'),client);
 await client.IantoChatGPTWeb.generate({prompt:'红黑配色比例3:4，产品vertical composition，aspect ratio 16:9',aspectRatio:'1:1',images:[{dataUrl:'data:image/png;base64,eA=='}]});
 const sent=requests.find(entry=>entry.type==='REQUEST_GEMINI_WEB_IMAGE').detail;
 assert.equal(sent.provider,'chatgpt');assert.equal(sent.protocolVersion,2);assert(sent.prompt.startsWith('OUTPUT ASPECT RATIO'));assert(sent.prompt.includes('exactly 1:1'));assert(sent.prompt.includes('红黑配色比例3:4'));assert(sent.prompt.includes('vertical composition'));assert(!sent.prompt.includes('16:9'));assert(sent.prompt.endsWith('$imagegen'));
 compatible=false;const before=requests.filter(entry=>entry.type==='REQUEST_GEMINI_WEB_IMAGE').length;
 await assert.rejects(()=>client.IantoChatGPTWeb.generate({prompt:'test'}),/VERSION_MISMATCH/);
 assert.equal(requests.filter(entry=>entry.type==='REQUEST_GEMINI_WEB_IMAGE').length,before);
 compatible=true;holdWeb=true;const controller=new AbortController();
 const abandoned=client.IantoChatGPTWeb.generate({prompt:'takeover',images:[{dataUrl:'data:image/png;base64,eA=='}],signal:controller.signal});
 await new Promise(resolve=>setTimeout(resolve,0));controller.abort();await assert.rejects(abandoned,error=>error.name==='AbortError');
 assert(requests.some(entry=>entry.type==='CANCEL_GEMINI_WEB_IMAGE'),'takeover must cancel the abandoned provider job');
 for(const worker of ['content_gemini_image_worker.js','content_chatgpt_image_worker.js']){
  const workerSource=fs.readFileSync(root+'content_scripts/'+worker,'utf8');
  const runJob=workerSource.slice(workerSource.indexOf('async function runJob'),workerSource.indexOf('async function imageToDataUrl',workerSource.indexOf('async function runJob')));
  assert(!runJob.includes('activateForJob'),worker+' must leave foreground activation to the background dispatcher');
  assert(workerSource.includes('webImageJobHeartbeat'),worker+' must renew its provider lease');
 }
 console.log('PASS client preflight, cancellation takeover, ChatGPT final prompt, conservative ratio cleaning, incompatible request blocked before upload');
}
test().catch(error=>{console.error(error);process.exitCode=1;});

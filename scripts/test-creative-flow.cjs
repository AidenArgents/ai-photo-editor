const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const read=file=>fs.readFileSync(file,'utf8');
function functions(file,names){
 const result=[];
 for(const match of read(file).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  const ast=ts.createSourceFile('page.js',match[1],99,true,ts.ScriptKind.JS);
  for(const n of ast.statements)if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))result.push(match[1].slice(n.getStart(ast),n.end));
 }
 return result.join('\n');
}
function runtime(mode){
 const elements=new Map(),values=new Map(),calls=[],images=[];
 const node=id=>{
  if(!elements.has(id)){
   const item={id,value:'',checked:false,disabled:false,style:{},classList:{add(){},remove(){},toggle(){}},textContent:'',tagName:'INPUT',addEventListener(){}};
   Object.defineProperty(item,'innerHTML',{get(){return this.html||''},set(html){this.html=html;for(const match of html.matchAll(/<textarea[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g))node(match[1]).value=match[2];}});
   elements.set(id,item);
  }
  return elements.get(id);
 };
 const document={getElementById:node,addEventListener(){},querySelector(){return null}};
 const sandbox={console,Date,Map,Set,URL,JSON,AbortController,CustomEvent:function(){},document,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},PROMPT_MODE:mode,
  prodImgData:'data:image/png;base64,cHJvZHVjdA==',refImgData:null,CUR_PROMPTS:{},KB:{风格:[{e:'photoreal',z:'真实'}]},SLOTS:[],concepts:[],prompts:[],images:[],promptLangs:[],recStyles:[],activeStyle:'',vcPlanA:[],vcPlanB:[],vcSelected:new Set(),vcTaskSelected:new Set(['task-1']),parsedTasks:[{task_id:'task-1',name:'任务1',concept:'当前产品要求',aspect_ratio:'1:1'}],
  gMarket:()=>node('iMkt2').value,gLang:()=>node('iMkt2').value==='PH'?'Filipino':'Spanish',gModel:()=>node('iMkt2').value==='PH'?'Filipino model':'Mexican model',
  renderStyleRec(){},clearStep3(){sandbox.prompts=[]},clearStep4(){sandbox.images=[]},scrollToBlock(){},renderVCPlan(){},vcUpdateSelBar(){},ckApi(){},renderIG(){},
  renderPrompts(){sandbox.prompts.forEach((p,i)=>{node('enP'+i).value=p.enFull;node('zhP'+i).value=p.zhFull;});},
  getActivePrompt:i=>node((mode==='fba'?'zhP':'enP')+i).value,
  syncPromptEdits(){sandbox.prompts.forEach((item,i)=>item.zhFull=node('zhP'+i).value);},updatePromptReadyState(){},
  normalizePerTaskCount:value=>Number(value)||1,
  normalizeProductImages:(array,first)=>array?.length?array:first?[first]:[],
  normalizeTaskVariants:(tasks,count,candidates)=>candidates.map(c=>({...c,task_id:tasks[c.task_index-1].task_id,concept:c.design_plan})),
  normalizeImageAspectRatio:value=>value,resolveAspectRatio:value=>value||'1:1',
  isOpenAiImageModel:model=>model.startsWith('gpt-image'),
 };
 sandbox.window=sandbox;sandbox.dispatchEvent=()=>{};
 const context=vm.createContext(sandbox);
 vm.runInContext(read('public/prompt-settings.js'),context);
 vm.runInContext(read('public/creative-core.js'),context);
 const core=sandbox.PhotoCreative;
 core.upgradeDefaults(mode,sandbox.CUR_PROMPTS);
 sandbox.PhotoCreative={...core,mount:(_mode,_settings,read)=>core.createFlow(read)};
 for(const [id,value]of Object.entries({pSku:'OLD-SPU',iMkt2:'MX',iInfo:'旧商品',iAR:'1:1',iStyle:'Minimalist',creativePlatform:mode==='fba'?'amazon':'shopee',creativeCategory:'general',aKey:'TEST-NOT-A-REAL-KEY',txtMdl:'text-test',aMdl:'chatgpt-web',cntA:'2',cntB:'2'}))node(id).value=value;
 node('useA').checked=true;node('useB').checked=true;
 function sample(schema,ctx,key=''){
  if(schema.type==='object')return Object.fromEntries(Object.entries(schema.properties).map(([key,value])=>[key,sample(value,ctx,key)]));
  if(schema.type==='array')return Array.from({length:schema.minItems??1},(_,i)=>{const item=sample(schema.items,ctx);if(item?.task_index!=null){item.task_index=1;item.variant_index=i+1;}return item;});
  if(schema.type==='integer')return 1;
  return ctx.marketCode+' '+ctx.spu+' '+key;
 }
 sandbox.GeminiTextApi={generateContent:async(key,model,body)=>{
  calls.push({model,body});if(sandbox.hold)await sandbox.hold;
  const ctx=JSON.parse(body.contents[0].parts.at(-1).text).taskContext;
  return {candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(sample(body.generationConfig.responseJsonSchema,ctx))}]}}]};
 }};
 sandbox.IantoChatGPTWeb={generate:async options=>{images.push({provider:'chatgpt',options});return 'data:image/png;base64,ZG9uZQ==';}};
 sandbox.IantoGeminiWeb={generate:async options=>{images.push({provider:'gemini',options});return 'data:image/png;base64,ZG9uZQ==';}};
 sandbox.vcSelectAll=()=>{sandbox.vcPlanA.forEach((_,i)=>sandbox.vcSelected.add('a-'+i));sandbox.vcPlanB.forEach((_,i)=>sandbox.vcSelected.add('b-'+i));};
 vm.runInContext(read('public/creative-page.js'),context);
 return {sandbox,context,core,node,calls,images,values};
}
async function suite(file){
 const test=runtime('taotu'),{sandbox:s,context,node,calls,images}=test;
 vm.runInContext(functions(file,['genConcepts','genPrompts','startGen','retry','renderCC','saveConcepts','okAll']),context);
 await s.genConcepts();s.okAll();await s.genPrompts();await s.startGen();
 assert.equal(images.length,9,'first task completes');
 assert.equal(images[0].provider,'chatgpt');
 assert(images[0].options.prompt.includes('OLD-SPU'));
 s.images[4]={status:'error',error:'simulated web automation failure'};
 await s.startGen();
 assert.equal(images.length,10,'one-click continuation regenerates only the missing image');
 assert.equal(s.images.filter(item=>item.status==='done').length,9,'successful images remain untouched');
 // Critical regression: previous task FINISHED. Now change product + country, no mid-task interruption.
 node('pSku').value='NEW-SPU';node('iInfo').value='新商品';node('iMkt2').value='PH';s.prodImgData='data:image/png;base64,bmV3';
 assert.throws(()=>s.PhotoCreativePage.flow.requireScheme(),/不一致/);
 await s.genConcepts();
 assert(s.concepts.every(item=>item.concept.includes('PH NEW-SPU')),'old DOM must not overwrite new plan');
 assert(node('ccE0').value.includes('PH NEW-SPU'));
 node('ccE0').value+=' user edit';s.okAll();assert(s.concepts[0].concept.endsWith('user edit'),'explicit confirmation preserves edits');
 await s.genPrompts();await s.startGen();
 assert.equal(images.length,19);
 assert(images[10].options.prompt.includes('PH NEW-SPU'));
 assert(!images[10].options.prompt.includes('OLD-SPU'));
 assert.notEqual(images[0].options.conversationKey,images[10].options.conversationKey);
 const latest=calls.at(-1).body;
 assert(latest.contents[0].parts.some(part=>part.inlineData?.data==='bmV3'),'original product image participates in prompt generation');
 assert(latest.systemInstruction.parts[0].text.includes('Philippine'));
 assert(!latest.systemInstruction.parts[0].text.includes('Contemporary Mexican'));
 assert.equal(latest.generationConfig.responseJsonSchema.minItems,9);
 node('ccE0').value+=' changed after prompt';await s.startGen();assert.equal(images.length,19,'changed confirmed plan cannot submit stale prompts');
 assert(!JSON.stringify(test.core).includes('TEST-NOT-A-REAL-KEY'));
 // Pending requests cannot overwrite a subsequent context.
 let release;s.hold=new Promise(resolve=>release=resolve);
 const pending=s.genConcepts();await Promise.resolve();await Promise.resolve();
 node('iMkt2').value='BR';release();await pending;
 assert(s.concepts.every(item=>item.concept.includes('PH NEW-SPU')));
 console.log('PASS',file,'completed MX → new SPU / PH → new prompts / ChatGPT; late response ignored');
}
async function variants(mode){
 const {sandbox:s,context,node,calls}=runtime(mode);
 vm.runInContext(functions('public/'+mode+'.html',['genConcepts','genPrompts','genPromptsFromVC']),context);
 await s.genConcepts();assert.equal(s.vcPlanA.length,2);
 if(mode!=='fba'){assert.equal(s.vcPlanB.length,2);assert(JSON.parse(calls[1].body.contents[0].parts.at(-1).text).input.sharedDna);s.vcSelectAll();await s.genPrompts();assert.equal(s.prompts.length,4);assert.equal(s.SLOTS.length,4);}
 else {assert.equal(s.vcPlanA[0].task_id,'task-1');assert.equal(calls[0].body.generationConfig.responseJsonSchema.properties.variants.minItems,2);}
 console.log('PASS',mode,'schema, counts and page-specific workflow');
}
async function webTakeover(){
 const {sandbox:s,context,node,images}=runtime('taotu');
 vm.runInContext(functions('public/web/taotu.html',['genConcepts','genPrompts','startGen','renderCC','saveConcepts','okAll']),context);
 await s.genConcepts();s.okAll();await s.genPrompts();
 let startedResolve;const started=new Promise(resolve=>startedResolve=resolve);
 s.IantoChatGPTWeb={generate:options=>{images.push({provider:'chatgpt',options});startedResolve();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const error=new Error('taken over');error.name='AbortError';reject(error);},{once:true}));}};
 const oldRun=s.startGen();await started;
 node('aMdl').value='gemini-web';const newRun=s.startGen();
 await newRun;await oldRun;
 assert.equal(images.filter(item=>item.provider==='chatgpt').length,1,'old provider receives only its interrupted task');
 assert.equal(images.filter(item=>item.provider==='gemini').length,9,'new provider continues the existing prompt batch');
 assert.equal(s.images.filter(item=>item.status==='done').length,9,'takeover finishes all missing images without rebuilding steps 1-3');
 console.log('PASS active Web batch can be taken over by another provider without rebuilding prompts');
}
async function completedBatchRerun(){
 const {sandbox:s,context,node,images}=runtime('taotu');
 vm.runInContext(functions('public/web/taotu.html',['genConcepts','genPrompts','startGen','renderCC','saveConcepts','okAll']),context);
 await s.genConcepts();s.okAll();await s.genPrompts();await s.startGen();
 assert.equal(images.length,9,'initial batch completes');
 assert.equal(node('gBtn').disabled,false,'completed batch must remain restartable');
 assert.match(node('gBtn').textContent,/重新生成全部图片/);
 node('aMdl').value='gemini-web';await s.startGen();
 assert.equal(images.length,18,'changing the image provider can rerun step 4 without rebuilding steps 1-3');
 assert(images.slice(9).every(item=>item.provider==='gemini'),'rerun must use the newly selected provider');
 console.log('PASS completed image batch can rerun with a newly selected provider');
}
async function fbaBatch(){
 const {sandbox:s,context,node,calls,images}=runtime('fba');
 vm.runInContext(functions('public/fba.html',['genConcepts','generatePromptsWithMedia','startGen']),context);
 await s.genConcepts();
 s.prompts=s.vcPlanA.map((item,i)=>({id:i+1,task_id:item.task_id,task_name:'task',variant_index:i+1,d:item.concept,aspect_ratio:'1:1',prodImgs:['data:image/png;base64,YQ=='],zhFull:'',prompt_status:'pending'}));
 s.PhotoCreativePage.bindFbaPreparation();s.renderPrompts();
 await s.generatePromptsWithMedia();assert(s.prompts.every(item=>item.prompt_status==='ready'));
 await s.startGen();assert.equal(images.length,2);assert(images[0].options.images.some(item=>item.dataUrl.endsWith('YQ==')));
 node('creativeDna').value=JSON.stringify({palette:'new'});await s.startGen();assert.equal(images.length,2,'FBA DNA change invalidates stale prompt');
 await s.generatePromptsWithMedia();await s.startGen();assert.equal(images.length,4);
 s.PhotoCreativePage.markFbaManual(0,'user instruction');node('zhP0').value='user instruction';await s.startGen();assert.equal(images.length,5,'manual prompt invalidates and regenerates only its own image');
 let release;s.hold=new Promise(resolve=>release=resolve);const count=calls.length;
 const pending=s.generatePromptsWithMedia();await Promise.resolve();await Promise.resolve();
 s.prompts[0].prodImgs=['data:image/png;base64,Yg=='];
 assert.throws(()=>s.PhotoCreativePage.requireScheme(),/运行/,'preparation cannot replace batch while awaiting');
 release();await pending;s.hold=null;
 assert.equal(calls.length,count+1,'stale batch stops after first request');assert.equal(s.prompts[0].prompt_status,'error');
 await s.startGen();assert.equal(images.length,5,'stale output cannot submit');
 console.log('PASS FBA image identity, DNA invalidation, manual prompts, stale batch stops and cannot overwrite new task');
}
function settings(){
 const {sandbox:s,core,values}=runtime('taotu'),api=s.AiPhotoPromptSettings;
 values.set('ecom_studio_prompts',JSON.stringify({concept:'my strategy',recognize:'custom color classifier'}));
 const loaded=api.load('taotu',s.CUR_PROMPTS);
 assert.equal(loaded.prompts.concept,'my strategy');assert.equal(loaded.prompts.recognize,'custom color classifier');assert.equal(loaded.archivedRecognition,'');
 assert(values.has(api.getStorageKey('taotu')+'.backup.'+core.revision));
 api.reset('taotu');assert.equal(api.load('taotu',s.CUR_PROMPTS).prompts.concept,s.CUR_PROMPTS.concept,'reset must not remigrate legacy');
 api.save('taotu',{...s.CUR_PROMPTS,prompt:'customized'},null);assert.equal(api.load('taotu',s.CUR_PROMPTS).prompts.prompt,'customized');
 assert.throws(()=>core.validate({variants:[]},core.schemeSchema('zhutu',2)),/缺少/);
 assert.throws(()=>core.validate([{}],core.array(core.object(['en','zh']),2)),/数量不符/);
 const coreSource=read('public/creative-core.js'),pageSource=read('public/creative-page.js');
 assert(!coreSource.includes('白色平顶塑料盖'),'global product rules must not contain a product-specific repair');
 assert(!pageSource.includes('dark contact shadows'),'response schema must not hide visual styling rules');
 assert(coreSource.includes('不要套用主图固定占比'),'scene prompts must remain independent from main-image prompts');
 console.log('PASS settings migration / backup / isolation / reset / schema validation');
}
function fbaSettings(){
 for(const file of ['public/fba.html','public/web/fba.html']){
  const {sandbox:s,context,node}=runtime('fba');
  const absent=node;
  // FBA keeps its historical sp_recognize element for CSV extraction; product fidelity has a distinct field.
  s.document.getElementById=id=>id==='sp_extract'?null:absent(id);
  s.PhotoCreative={...s.PhotoCreative,readAdvanced:()=>({recognize:'product fidelity'}),refreshChoices(){}};
  s.alert=()=>{};s.closeSettings=()=>{};
  for(const key of ['recognize','concept','prompt','imggen','aesthetic'])node('sp_'+key).value=key==='recognize'?'CSV extraction':'custom '+key;
  node('sp_kb').value='{}';
  vm.runInContext(functions(file,['savePromptSettings']),context);s.savePromptSettings();
  assert.equal(s.CUR_PROMPTS.extract,'CSV extraction');assert.equal(s.CUR_PROMPTS.recognize,'product fidelity');
 }
 console.log('PASS FBA settings save keeps extraction and product-fidelity fields separate');
}
(async()=>{settings();fbaSettings();await suite('public/taotu.html');await suite('public/web/taotu.html');for(const mode of ['zhutu','changjing','fba'])await variants(mode);await webTakeover();await completedBatchRerun();await fbaBatch();})().catch(error=>{console.error(error);process.exitCode=1;});

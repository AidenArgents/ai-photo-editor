const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const text=fs.readFileSync('server.ts','utf8'),ast=ts.createSourceFile('server.ts',text,99,true,ts.ScriptKind.TS);
const names=new Set(['OPENAI_IMAGE_SELECTIONS','bufferToGenerativePart','getPublicErrorMessage','getRequestApiKey','getRequestOpenAiApiKey','getOpenAiImageSize','getImageAsBase64','editImageWithOpenAi']);
const chunks=[];let handler;
for(const node of ast.statements){
 if(ts.isFunctionDeclaration(node)&&names.has(node.name?.text)||ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>names.has(d.name.getText(ast))))chunks.push(node.getText(ast));
 if(ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.arguments[0]?.getText(ast)==='"/api/edit-image"')handler=node.expression.arguments.at(-1).getText(ast);
}
assert(handler);
const calls=[],http=[];
const sandbox={console,Buffer,Uint8Array,Blob,FormData,AbortSignal,GoogleGenAI:class{constructor(){this.models={generateContent:async req=>{calls.push(req);return{candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'b3V0'}}]}}]};}}}},fetch:async(url,request)=>{http.push({url,request});return{ok:true,text:async()=>JSON.stringify({data:[{b64_json:'b3V0'}]})}}};
vm.runInNewContext(ts.transpileModule(chunks.join('\n')+'\nglobalThis.handler='+handler,{compilerOptions:{target:99,module:1}}).outputText,sandbox);
const makeFile=(name,bytes,type)=>({originalname:name,buffer:Buffer.from(bytes),size:Buffer.byteLength(bytes),mimetype:type});
async function run(model,mergeMode,aspectRatio){
 const files={images:[makeFile('product.jpg','original-A','image/jpeg'),makeFile('angle.png','original-B','image/png')],secondaryImage:[makeFile('reference.webp','reference-C','image/webp')]};
 const req={headers:{'x-gemini-api-key':'TEST-SECRET','x-openai-api-key':'TEST-SECRET'},body:{model,mergeMode,aspectRatio,prompt:' keep original color; replace only background '},files};
 let output;const res={status(){return this},json(value){output=value;return value}};
 await sandbox.handler(req,res);assert(!output.error,output.error);assert.equal(output.imageUrl,'data:image/png;base64,b3V0');
 assert.equal(output.request.prompt,req.body.prompt.trim());assert.equal(output.request.images.length,3);assert(!JSON.stringify(output).includes('TEST-SECRET'));assert(!JSON.stringify(output.request).includes('b3JpZ2luYWwtQQ=='));
 if(model.startsWith('gpt-image')){
  const {request,url}=http.at(-1),form=request.body;assert.equal(url,'https://api.openai.com/v1/images/edits');assert.equal(form.get('prompt'),req.body.prompt.trim());assert.equal(form.get('model'),model.slice(0,model.lastIndexOf(':')));assert.equal(form.get('input_fidelity'),null);assert.equal(form.get('size'),'1152x1536');
  const imageFiles=form.getAll('image[]');assert.equal(imageFiles.length,3);assert.equal(await imageFiles[0].text(),'original-A');assert.equal(await imageFiles[2].text(),'reference-C');
 }else{
  const call=calls.at(-1),parts=call.contents[0].parts;assert.equal(parts.length,4);assert.equal(parts[0].inlineData.data,Buffer.from('original-A').toString('base64'));assert.equal(parts[2].inlineData.mimeType,'image/webp');assert.equal(parts[3].text,req.body.prompt.trim());
  if(aspectRatio==='auto'||aspectRatio==='prompt')assert.equal(call.config,undefined);else assert.equal(call.config.imageConfig.aspectRatio,aspectRatio);
 }
}
function editorSettings(){
 const values=new Map(),module={exports:{}};
 const src=ts.transpileModule(fs.readFileSync('components/editor/promptSettings.ts','utf8'),{compilerOptions:{target:99,module:1}}).outputText;
 vm.runInNewContext(src,{exports:module.exports,module,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
 const api=module.exports,key=api.EDITOR_PROMPT_STORAGE_KEY;
 values.set(key,JSON.stringify({fusionTemplates:{replace_product:'my custom rule',combine:'请参考第二张图的光影氛围与美学色调，将产品主图置于其中，协调整体光照与环境反射。'}}));
 const result=api.loadEditorPromptSettings();assert.equal(result.fusionTemplates.replace_product,'my custom rule');assert(!result.fusionTemplates.combine.includes('第二张'));assert(values.has(key+'.backup.'+api.EDITOR_DEFAULTS_REVISION));
 assert.equal(api.compileEditorPrompt('{prompt} / {mode}','literal {mode}','custom',2,true),'literal {mode} / custom','user placeholders must not be re-expanded');
 api.saveEditorPromptSettings(result);assert.equal(api.loadEditorPromptSettings().fusionTemplates.replace_product,'my custom rule');
}
(async()=>{editorSettings();for(const mode of ['custom','combine','replace_background','replace_product','replace_person','add_logo'])await run('gemini-3.1-flash-image',mode,'3:4');await run('gemini-3.1-flash-image','custom','prompt');await run('gemini-3.1-flash-image','combine','auto');for(const model of ['gpt-image-2:high','gpt-image-2.5-sunburst:max','gpt-image-2.5-flare:xhigh'])await run(model,'combine','3:4');assert.equal(calls.length,8,'exactly one Gemini call per image, no describe/regenerate intermediate');console.log('PASS direct-image API originals/roles/order/MIME, exact prompts, native aspect parameters, all GPT image model routing and first-page settings migration');})().catch(error=>{console.error(error);process.exitCode=1});

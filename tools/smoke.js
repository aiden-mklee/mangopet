// Load the built pages in a phone-sized browser, fail on any page error, save screenshots to .out/
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'.out');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch();let bad=0;
 for(const [name,dev] of [['index',devices['iPhone 13']],['lab',{viewport:{width:1280,height:900}}]]){
  const ctx=await b.newContext(dev);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(ROOT,'docs',name+'.html'));await p.waitForTimeout(1200);
  const c=await p.$('#lcd');const bb=await c.boundingBox();for(let i=0;i<6;i++){await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(200)}
  await p.waitForTimeout(800);await p.screenshot({path:path.join(OUT,name+'.png')});
  console.log(name.padEnd(6),errs.length?'ERRORS '+JSON.stringify(errs):'ok');bad+=errs.length;await ctx.close()}
 await b.close();process.exit(bad?1:0)})();

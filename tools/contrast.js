// Every d-pad cursor cell on the HTML screens (decorating, settings, big book), with and without the d-pad shown:
// its text must stand out from its fill. Catches the light-tint-over-inverted-cell bug (text vanished). Run from the repo root.
const {chromium}=require('playwright');const fs=require('fs');
let bad=0;(async()=>{const b=await chromium.launch();const html=fs.readFileSync('docs/app.html','utf8');const i=html.lastIndexOf('})();');
 const body=html.slice(0,i)+'window.__dp={get g(){return g},get ui(){return ui},introSkip,openDeco,closeDeco,flip,openZoom,closeZoom,padItems,padShow};'+html.slice(i);
 const p=await b.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});p.on('pageerror',e=>console.log('ERR',e.message));
 await p.route('**/app.html',r=>r.fulfill({contentType:'text/html',body}));await p.route('**/*.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await p.goto('file:///x/app.html');await p.waitForTimeout(500);await p.evaluate(()=>__dp.introSkip());await p.waitForTimeout(800);
 for(let k=0;k<10;k++){if(await p.evaluate(()=>__dp.g.phase==='alive'))break;await p.click('#lcd',{force:true});await p.waitForTimeout(600)}
 // own a few things so worn/picked (inverted) cells exist
 await p.evaluate(()=>{const g=__dp.g;g.charms=g.charms||[];});
 const check=async(label)=>{await p.waitForTimeout(150);return p.evaluate(label=>{
   const rgb=s=>{const m=s.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1}};
   const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
   const bgOf=el=>{let layers=[];for(let e=el;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c.a>0)layers.push(c);if(c.a>=1)break}
     let out={r:255,g:255,b:255};for(const c of layers.reverse())out={r:out.r*(1-c.a)+c.r*c.a,g:out.g*(1-c.a)+c.g*c.a,b:out.b*(1-c.a)+c.b*c.a};return out};
   const bad=[];const its=__dp.padItems();
   for(const mode of ['tap','pad']){document.body.classList.toggle('padvis',mode==='pad');
    for(const el of its){document.querySelectorAll('.padfocus').forEach(x=>x.classList.remove('padfocus'));el.classList.add('padfocus');
     const t=el.querySelector('b')||el;const fg=rgb(getComputedStyle(t).color),bg=bgOf(el);const L1=lum(fg),L2=lum(bg),cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
     if(cr<2.5&&(el.textContent.trim()))bad.push(`${mode} "${el.textContent.trim().slice(0,14)}" ${cr.toFixed(2)}${el.getAttribute('aria-pressed')==='true'?' pressed':''}`)}}
   document.querySelectorAll('.padfocus').forEach(x=>x.classList.remove('padfocus'));document.body.classList.remove('padvis');__dp.padShow();
   return label+': '+its.length+' items'+(bad.length?'\n   BAD '+bad.join('\n   BAD '):' ok')},label)};
 await p.evaluate(()=>__dp.openDeco('home'));{const r=await check('deco home');if(r.includes('BAD'))bad++;console.log(r)}
 const tabs=await p.evaluate(()=>[...document.querySelectorAll('.dhome button')].map(b=>[...b.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'="'+a.value+'"').join('')));
 for(const t of tabs){await p.evaluate(t=>{__dp.openDeco('home');document.querySelector('.dhome button['+t.replace('"','="').replace('=="','="')+']')?.click()},t);
   await p.evaluate(t=>{const sel='.dhome button['+t+']';const el=document.querySelector(sel);if(el)el.click()},t);console.log(await check('deco '+t))}
 await p.evaluate(()=>__dp.closeDeco());
 await p.evaluate(()=>__dp.flip(true));{const r=await check('settings');if(r.includes('BAD'))bad++;console.log(r)}
 const sb=await p.evaluate(()=>__dp.padItems().length);
 for(let k=0;k<sb;k++){await p.evaluate(k=>{__dp.flip(false);__dp.flip(true);__dp.padItems()[k].click()},k);console.log(await check('settings #'+k+' '+await p.evaluate(k=>{__dp.flip(false);__dp.flip(true);const t=__dp.padItems()[k].textContent.trim().slice(0,10);__dp.padItems()[k].click();return t},k)))}
 await p.evaluate(()=>__dp.flip(false));
 for(const z of ['dex','finds','album']){await p.evaluate(z=>__dp.openZoom(z),z);{const r=await check('zoom '+z);if(r.includes('BAD'))bad++;console.log(r)}await p.evaluate(()=>__dp.closeZoom())}
 await b.close();process.exit(bad?1:0)})();

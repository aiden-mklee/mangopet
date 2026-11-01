// Overlap check: open one thing (an LCD menu, a game, settings, 꾸미기, the big book, …), press another (꾸미기, 설정,
// the keyring, an icon, 선택, 취소) and make sure only one thing is open afterwards. Run after UI changes:
//   node tools/combos.js
const {chromium}=require('playwright');const fs=require('fs');
const OPENERS={
 bookMenu:async p=>{await p.evaluate(()=>__dp.act('dex'))},
 arcadeMenu:async p=>{await p.evaluate(()=>{__dp.g.played={run:1,catch:1,shoot:1,brick:1,simon:1};__dp.act('play')})},
 game:async p=>{await p.evaluate(()=>__dp.startGame('run'))},
 settings:async p=>{await p.click('#flipBtn')},
 deco:async p=>{await p.click('#decoBtn')},
 decoEng:async p=>{await p.click('#decoBtn');await p.click('[data-go="eng"]')},
 bookZoom:async p=>{await p.evaluate(()=>__dp.openZoom('dex'))},
 statsView:async p=>{await p.evaluate(()=>__dp.act('stats'))},
 dexLCD:async p=>{await p.evaluate(()=>{__dp.act('dex')});await p.click('#bA',{force:true})},
 gradAsk:async p=>{await p.evaluate(()=>{__dp.ui.gradAsk=true;__dp.renderCtx()})},
 talk:async p=>{await p.evaluate(()=>__dp.talk('🌱 테스트','한 줄',true))},
};
const ACTIONS={
 decoBtn:p=>p.click('#decoBtn',{force:true}),
 setBtn:p=>p.click('#flipBtn',{force:true}),
 keyring:p=>p.click('#keyring .ring',{force:true}),
 iconMeal:async p=>{const r=await (await p.$('#lcd')).boundingBox();await p.mouse.click(r.x+r.width*.12,r.y+r.height*.06)},
 iconBook:async p=>{const r=await (await p.$('#lcd')).boundingBox();await p.mouse.click(r.x+r.width*.88,r.y+r.height*.94)},
 select:p=>p.click('#bA',{force:true}),
 cancel:p=>p.click('#bB',{force:true}),
};
(async()=>{const b=await chromium.launch();const html=fs.readFileSync('docs/app.html','utf8');const i=html.lastIndexOf('})();');
 const body=html.slice(0,i)+'window.__dp={get g(){return g},get ui(){return ui},introSkip,act,startGame,openZoom,renderCtx,talk};'+html.slice(i);
 const bad=[];let n=0;
 for(const [on,open] of Object.entries(OPENERS))for(const [an,act] of Object.entries(ACTIONS)){
  const p=await b.newPage({viewport:{width:393,height:852}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.clock.install({time:new Date('2026-11-02T13:00:00')});
  await p.route('**/app.html',r=>r.fulfill({contentType:'text/html',body}));await p.route('**/*.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await p.goto('file:///x/app.html');await p.clock.runFor(500);await p.evaluate(()=>__dp.introSkip());await p.clock.runFor(800);
  for(let k=0;k<10;k++){if(await p.evaluate(()=>__dp.g.phase==='alive'))break;await p.click('#lcd',{force:true});await p.clock.runFor(600)}
  for(let k=0;k<8;k++){if(await p.evaluate(()=>document.getElementById('talkBox').hidden))break;await p.click('#bB',{force:true});await p.clock.runFor(120)}
  await p.evaluate(()=>{const G=__dp.g;G.stage='adult';G.species='sun_cat';G.dex.sun_cat={seen:true,grad:1};G.intro='done'});
  try{await open(p);await p.clock.runFor(300);await act(p);await p.clock.runFor(400)}catch(e){errs.push('step: '+e.message.split('\n')[0])}
  const s=await p.evaluate(()=>{const vis=id=>{const e=document.getElementById(id);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'};
    return {menu:vis('menuPanel'),deco:!!__dp.ui.deco,zoom:vis('zoom'),set:!!__dp.ui.flipped,game:!!__dp.ui.game,view:__dp.ui.view,talk:vis('talkBox')}});
  const opens=['menu','deco','zoom','set','game'].filter(k=>s[k]);n++;
  if(opens.length>1||errs.length){bad.push(`${on} → ${an}: ${opens.join('+')}${errs.length?' ERR '+errs.join(';'):''} ${JSON.stringify(s)}`);await p.screenshot({path:`.out/tmp/combo_${on}_${an}.png`})}
  await p.close()}
 console.log('checked',n);console.log(bad.join('\n')||'no overlaps');await b.close()})();

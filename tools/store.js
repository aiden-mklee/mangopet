// Store screenshots: play six scenes in the phone build, then frame each under a headline.
//   python3 tools/build.py && node tools/store.js   → assets/store/1-egg.png … 6-notif.png (1290 × 2796, iPhone 6.7")
// Scenes are set up through a hook injected into a temporary copy of docs/index.html.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),RAW=path.join(ROOT,'.out','store'),OUT=path.join(ROOT,'assets','store'),TMP=path.join(ROOT,'docs','_store.html');
fs.mkdirSync(RAW,{recursive:true});fs.mkdirSync(OUT,{recursive:true});
const page=fs.readFileSync(path.join(ROOT,'docs','index.html'),'utf8');
fs.writeFileSync(TMP,page.replace('/* ---------- boot ---------- */','window.__dp={get g(){return g},E,ui,advance,act,newPet,hatch,GAMES,openZoom,drawCharms,banner};\n/* ---------- boot ---------- */'));
const FACE=page.match(/@font-face\{font-family:'Galmuri11'[^\n]*\n/)[0];
// grow a pet to an adult in the morning, with three charms on the keyring
const GROW=`const D=window.__dp,g=D.g;g.speed=0;D.newPet('relaxed');D.advance(6);if(g.phase==='egg')D.hatch();
  for(let i=0;i<400&&!(g.stage==='adult'&&D.E.localHour(g)===10);i++){D.advance(30);Object.assign(g,{hunger:4,happy:4,poops:0,sick:false,tummy:false,starveMin:0,sickMin:0,lights:true})}
  g.charms=['mango','star','heart','sun'];g.equip=['mango','star','heart'];D.drawCharms();D.ui.anim=null;D.ui.view='main';g.lights=true;g.sleeping=false;`;
const SCENES=[
  {name:'1-egg',head:'알을 톡톡,\n내 펫을 깨워요',bg:'#f6c64e',ink:'#463414',save:{skin:'classic',bg:'beige',intro:'case'},wait:900,
    js:`const D=window.__dp;D.g.speed=0;document.querySelector('[data-intronext=life]').click();document.querySelector('[data-intronext=egg]').click();D.g.cracks=2;`},
  {name:'2-meal',head:'하루 10초면\n충분해요',bg:'#f2b3bf',ink:'#5a2433',save:{skin:'berry',bg:'peach'},wait:500,js:GROW+`g.species='sun_cat';g.hunger=1;D.act('meal');`},
  {name:'3-dex',head:'24종 + 반짝이,\n도감을 채워요',bg:'#a6dccb',ink:'#1f4a3d',save:{skin:'mint',bg:'mint'},wait:700,
    js:GROW+`['sun_cat','moon_bear','chub_frog','wild_rabbit','sun_penguin','moon_chick','chub_cat','sun_bear','moon_rabbit','chub_penguin','sun_frog'].forEach((k,i)=>g.dex[k]={seen:true,grad:i%3?1:0,best:i%3?(i%2?2:1):0});D.openZoom('dex','chub_frog');`},
  {name:'4-deco',head:'키링 21종,\n나만의 기기로',bg:'#cfe0ea',ink:'#24384a',save:{skin:'banana',bg:'sky'},wait:700,js:GROW+`g.species='moon_bear';D.openZoom('charm');`},
  {name:'5-run',head:'미니게임 4종,\n기록에 도전!',bg:'#dcd5ea',ink:'#352a50',save:{skin:'classic',bg:'lilac'},wait:120,
    js:GROW+`g.species='wild_cat';const G=D.GAMES.run.start({id:'run',wins:0,until:0});G.dist=4*128;G.t0-=9000;G.next=1e15;G.obs.push({x:30,w:3,h:3,y:28});G.jumpAt=performance.now()-300;D.ui.game=G;`},
  {name:'6-notif',head:'필요할 때만\n살짝 알려 줘요',bg:'#3a3d44',ink:'#f3eee6',save:{skin:'smoke',bg:'night'},wait:500,banner:true,
    js:GROW+`g.species='chub_penguin';g.hunger=0;g.poops=1;D.banner('🍙 배고파 · 💩 똥 쌌어');`},
];
(async()=>{const b=await chromium.launch();let bad=0;
 for(const S of SCENES){
  const ctx=await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await ctx.addInitScript(s=>{if(!sessionStorage.x){sessionStorage.x=1;localStorage.setItem('mangopet-beta-v1',JSON.stringify({intro:'done',phase:'select',t:600,speed:1,btnStyle:'flat',...s}))}},S.save);
  const p=await ctx.newPage();p.on('pageerror',e=>{bad++;console.log(S.name,'ERROR',e.message)});
  await p.goto('file://'+TMP);await p.waitForTimeout(1200);
  await p.addStyleTag({content:'.betanote{visibility:hidden!important}'+(S.banner?'':'.notif{display:none!important}')});
  await p.evaluate(new Function(S.js));await p.waitForTimeout(S.wait);
  const raw=path.join(RAW,S.name+'.png');await p.screenshot({path:raw});
  // frame: headline in the game font, the screen below in a phone outline
  await p.close();const f=await ctx.newPage();
  await f.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${FACE}
    html,body{margin:0;width:430px;height:932px;overflow:hidden;background:${S.bg}}
    h1{margin:0;padding:64px 28px 0;font:28px/1.45 'Galmuri11',sans-serif;color:${S.ink};text-align:center;white-space:pre-line;-webkit-font-smoothing:none}
    .shot{position:absolute;left:50%;bottom:-60px;transform:translateX(-50%);width:340px;border-radius:36px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.28);border:8px solid #111}
    .shot img{display:block;width:100%}</style></head><body><h1>${S.head}</h1><div class="shot"><img src="data:image/png;base64,${fs.readFileSync(raw).toString('base64')}"></div></body></html>`);
  await f.waitForTimeout(300);await f.screenshot({path:path.join(OUT,S.name+'.png')});await ctx.close();console.log('wrote assets/store/'+S.name+'.png')}
 fs.unlinkSync(TMP);await b.close();process.exit(bad?1:0)})();

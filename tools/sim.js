const {chromium}=require('playwright');const RUNS=+process.env.RUNS||10,NMODE=process.env.NM||'normal';const fs=require('fs'),path=require('path');const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'.out');fs.mkdirSync(OUT,{recursive:true});
let html=fs.readFileSync(path.join(ROOT,'.out/artifact.html'),'utf8').replace('/* ---------- boot ---------- */','window.__dp={get g(){return g},ui,advance,act,petTap,needList,newPet,hatch};\n/* ---------- boot ---------- */');
fs.writeFileSync(path.join(OUT,'sim.html'),'<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>');
const personas={
 office:[[8,0],[12,30],[18,30],[22,0]],
 office_bed2130:[[8,0],[12,30],[18,30],[21,15]],
 busy:[[8,0],[21,15]],
 light3:[[8,30],[13,0],[21,0]],
 snacker:[[8,0],[12,30],[18,30],[21,15]],
 petter:[[8,0],[12,30],[18,30],[21,15]],
 nightowl:[[13,0],[19,0],[20,45]],
 neglect:[[9,0]],
};
(async()=>{const b=await chromium.launch();const out=[];
 for(const mode of (process.env.MODES||'relaxed').split(','))for(const [pname,checks] of Object.entries(personas))for(let run=0;run<RUNS;run++){
  const p=await b.newPage();await p.goto('file://'+path.join(OUT,'sim.html'));await p.waitForTimeout(200);
  const r=await p.evaluate(([mode,checks,SNACK,NM,PET])=>{const D=window.__dp;D.g.speed=0;D.g.notifMode=NM;D.g.t=7*60;D.newPet(mode);D.advance(6);if(D.g.phase==='egg')D.hatch();
   const stats={checks:0,actions:0,maxActions:0,poopsSeen:[],hungrySeen:0,sickSeen:0,tummySeen:0,lightsMiss:0,sleepAtCheck:0};
   const now=()=>D.g.t;
   for(let day=0;day<8&&D.g.phase==='alive'||day===0;day++){
     for(const [h,m] of checks){
       const target=(Math.floor(now()/1440))*1440+h*60+m; let tt=target; if(tt<=now())tt+=1440;
       D.advance(tt-now()); if(D.g.phase!=='alive')break;
       const g=D.g;stats.checks++;let a=0;
       stats.poopsSeen.push(g.poops);if(g.hunger===0)stats.hungrySeen++;if(g.sick)stats.sickSeen++;if(g.tummy)stats.tummySeen++;
       if(g.sleeping){stats.sleepAtCheck++;if(g.lights&&h>=21){D.ui.anim=null;D.act('light');a++}continue}
       const doo=k=>{D.ui.anim=null;D.ui.game=null;D.act(k);a++};
       if(g.poops)doo('clean');
       if(g.tummy){for(let i=0;i<3;i++){D.ui.anim=null;D.petTap();}a++}
       while(g.sick&&a<12)doo('med');
       let f=0;if(SNACK){doo('snack')}while(g.hunger<4&&f<4){doo('meal');f++}
       if(PET){D.ui.anim=null;g.lastPet=-999;D.petTap();a++}
       if(g.happy<=2&&!PET){g.happy=Math.min(4,g.happy+1);g.weight=Math.max(1,g.weight-1);g.plays=(g.plays||0)+1;a+=2}
       if(g.happy<=2){D.ui.anim=null;D.petTap();a++}
       stats.actions+=a;stats.maxActions=Math.max(stats.maxActions,a);
       if(h>=21&&g.sleeping&&g.lights){doo('light')}
     }
     if(D.g.phase!=='alive')break;
   }
   const g=D.g;const days=Math.max(1,Math.ceil(g.t/1440));
   const sent=g.log.filter(l=>!l.held).length,held=g.log.filter(l=>l.held).length;
   const kinds={};g.log.forEach(l=>{const k=l.text.split(' ')[0]+(l.held?'(held)':'');kinds[k]=(kinds[k]||0)+1});
   return {phase:g.phase,stage:g.stage,species:g.species,con:g.con,careMiss:g.careMiss,days,sentPerDay:+(sent/days).toFixed(1),heldPerDay:+(held/days).toFixed(1),kinds,
     actionsPerCheck:+(stats.actions/Math.max(1,stats.checks-stats.sleepAtCheck)).toFixed(1),maxActions:stats.maxActions,avgPoops:+(stats.poopsSeen.reduce((a,b)=>a+b,0)/stats.poopsSeen.length).toFixed(1),
     hungryAtCheck:stats.hungrySeen,sickAtCheck:stats.sickSeen,tummyAtCheck:stats.tummySeen,morning:g.morning,night:g.night,weight:g.weight,snacks:g.snacks}},[mode,checks,pname==='snacker',NMODE,pname==='petter']);
  out.push({mode,pname,...r});await p.close();}
 fs.writeFileSync(path.join(OUT,'sim.json'),JSON.stringify(out,null,1));await b.close();
 const grp={};out.forEach(o=>{const k=o.mode+'/'+o.pname;(grp[k]=grp[k]||[]).push(o)});
 for(const [k,v] of Object.entries(grp)){const avg=f=>(v.reduce((a,o)=>a+o[f],0)/v.length).toFixed(1);
  const lc={};v.forEach(o=>{const l=o.phase==='alive'||o.phase==='graduated'?(o.species||'-').split('_')[0]:o.phase;lc[l]=(lc[l]||0)+1});console.log(k.padEnd(22),JSON.stringify(lc),'| miss',avg('careMiss'),'| notif/day',avg('sentPerDay'),'held',avg('heldPerDay'),'| act/check',avg('actionsPerCheck'),'max',Math.max(...v.map(o=>o.maxActions)),'| poops@check',avg('avgPoops'),'| hungry@check',avg('hungryAtCheck'),'sick@check',avg('sickAtCheck'))}
 const kinds={};out.filter(o=>o.pname==='office').forEach(o=>Object.entries(o.kinds).forEach(([k,n])=>kinds[k]=(kinds[k]||0)+n));console.log('office notif kinds (12 runs total):',kinds);
})();

// Golden tests for src/engine.js.
//
//   node tools/golden.js           check the engine against tests/golden.json
//   node tools/golden.js --update  rewrite tests/golden.json after an intended rule change
//
// Each case is plain data: a seed, a mode, a list of actions at given minutes, and checkpoints.
// The expected snapshots are what any port of the engine (Swift, Kotlin) must reproduce exactly.
const fs=require('fs'),path=require('path');
const E=require('../src/engine.js');
const FILE=path.join(__dirname,'..','tests','golden.json');

// visits at fixed times; at each visit the player does what the pet needs (deterministic, like tools/sim.js)
const visits=(times,days=8)=>[...Array(days)].flatMap((_,d)=>times.map(([h,m])=>[d*1440+h*60+m,'care']));
const OFFICE=[[8,0],[12,30],[18,30],[21,15]];
const CASES=[
  {name:'office-relaxed',seed:1,mode:'relaxed',script:visits(OFFICE)},
  {name:'office-classic',seed:7,mode:'classic',script:visits(OFFICE)},
  {name:'twice-a-day',seed:21,mode:'relaxed',script:visits([[8,0],[21,15]])},
  {name:'neglect-relaxed',seed:42,mode:'relaxed',script:[]},
  {name:'neglect-classic',seed:3,mode:'classic',script:[]},
  {name:'snacker',seed:99,mode:'relaxed',script:[...visits(OFFICE),...visits([[15,0],[16,0]]).map(([t])=>[t,'snack']),...visits([[16,1]]).map(([t])=>[t,'play:4'])]},
  // a night worker on the 'night' rhythm (asleep 9:00-19:00), visiting at their own morning, noon, evening, bedtime
  {name:'night-worker',seed:11,mode:'relaxed',life:'night',script:visits([[19,0],[23,30],[5,30],[8,30]]).map(([t,a])=>[t-7*60,a])},
  {name:'early-graduation',seed:5,mode:'relaxed',script:[...visits(OFFICE,4),[3*1440+9*60,'graduate']]},
];
const CHECKPOINTS=[60,6*60,1440,2*1440,3*1440+60,5*1440,7*1440+60];
const KEYS=['phase','stage','species','con','hunger','happy','weight','poops','sick','tummy','sleeping','lights','careMiss','morning','night','checks','acc','seed'];

function care(g,ev){
  if(g.lights&&g.sleeping&&E.isNight(g)){E.toggleLight(g);E.visit(g);return}
  if(g.sleeping)return;
  if(!g.lights)E.toggleLight(g);
  E.visit(g);
  while((g.sick||g.tummy)&&E.med(g)!=='no');
  if(g.poops)E.clean(g);
  while(g.hunger<4&&E.meal(g)==='ok');
  if(g.happy<3)E.pet(g);
  if(g.happy<3)E.playDone(g,3);
  if(E.localHour(g)>=19)E.toggleLight(g);  // an evening visit puts the pet to bed early
}
function act(g,a,ev){
  if(g.phase!=='alive')return;
  const [name,arg]=a.split(':');
  if(name==='care')return care(g,ev);
  if(name==='graduate'){E.graduate(g,E.fullTerm(g),ev);return}
  if(!g.lights||g.sleeping)return;
  E.visit(g);
  if(name==='snack')E.snack(g);else if(name==='play')E.playDone(g,+arg);
}
function runCase(c){
  const g=E.fresh(c.seed);g.t=7*60;if(c.life)g.life=c.life;E.newPet(g,c.mode);
  const ev=[],out=[],script=c.script.map(([at,a])=>[at+7*60,a]).sort((x,y)=>x[0]-y[0]);let si=0;
  const end=8*1440;
  for(let m=1;m<=end;m++){
    E.step(g,ev,{autoHatch:true});
    while(si<script.length&&script[si][0]<=g.t){act(g,script[si][1],ev);si++}
    if(CHECKPOINTS.includes(m)){const snap={};KEYS.forEach(k=>snap[k]=g[k]??null);out.push({minute:m,state:snap})}
  }
  const notices=ev.filter(e=>e.type==="notice").map(e=>[e.t,e.icon?e.icon+" "+e.text:e.text,e.sent?'sent':e.held]);
  return {checkpoints:out,notices,dex:g.dex,hist:g.hist};
}
// forecasting must agree with simply letting time pass
function forecastCase(){
  // two days of office care, then the app closes after the 18:30 visit
  const g=E.fresh(11);g.t=7*60;E.newPet(g,'relaxed');const ev=[];
  for(let m=0;m<2*1440+11*60+30;m++){E.step(g,ev,{autoHatch:true});const into=g.t%1440;if(OFFICE.some(([h,mm])=>h*60+mm===into))care(g,ev)}
  const f=E.forecast(g,2*1440);
  const real=[],c=JSON.parse(JSON.stringify(g));E.advance(c,2*1440,real,{autoHatch:true});
  const sent=real.filter(e=>e.type==='notice'&&e.sent).map(e=>({t:e.t,text:e.icon?`${e.icon} ${e.text}`:e.text,kind:e.kind,who:e.who}));
  return {forecast:f,matchesRealRun:JSON.stringify(f)===JSON.stringify(sent)};
}

const result={engine:'mangopet',cases:CASES.map(c=>({...c,expect:runCase(c)})),forecast:forecastCase()};
if(process.argv.includes('--update')){fs.mkdirSync(path.dirname(FILE),{recursive:true});fs.writeFileSync(FILE,JSON.stringify(result,null,1)+'\n');console.log('wrote',path.relative(process.cwd(),FILE));process.exit(0)}
const want=JSON.parse(fs.readFileSync(FILE,'utf8'));let bad=0;
for(const c of result.cases){const w=want.cases.find(x=>x.name===c.name);
  const ok=w&&JSON.stringify(w.expect)===JSON.stringify(c.expect);if(!ok)bad++;
  const last=c.expect.checkpoints.at(-1).state;console.log((ok?'ok  ':'FAIL')+' '+c.name.padEnd(18)+` → ${last.phase} ${last.species||''} · notices ${c.expect.notices.length}`)}
const fok=result.forecast.matchesRealRun&&JSON.stringify(want.forecast)===JSON.stringify(result.forecast);if(!fok)bad++;
console.log((fok?'ok  ':'FAIL')+' forecast           → '+result.forecast.forecast.length+' notifications ahead, same as a real run: '+result.forecast.matchesRealRun);
process.exit(bad?1:0);

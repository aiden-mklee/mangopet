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

// visits at fixed wall-clock times; at each visit the player does what the pet needs (deterministic, like tools/sim.js).
// A run starts at 7:00 and runCase counts script times from there, so the clock time is turned into minutes since the
// start here (it used to be left as is, which put every visit 7 hours late: the office visits fell at 15:00, 19:30,
// 1:30 and 4:15, and the snacker's 15:00/16:00 treats at 22:00/23:00, when the pet sleeps and they were skipped)
const START=7*60;
const visits=(times,days=8)=>[...Array(days)].flatMap((_,d)=>times.map(([h,m])=>[d*1440+h*60+m-START,'care']));
const OFFICE=[[8,0],[12,30],[18,30],[21,15]];
const CASES=[
  {name:'office-relaxed',seed:1,mode:'relaxed',script:visits(OFFICE)},
  {name:'office-classic',seed:7,mode:'classic',script:visits(OFFICE)},
  {name:'twice-a-day',seed:21,mode:'relaxed',script:visits([[8,0],[21,15]])},
  {name:'neglect-relaxed',seed:42,mode:'relaxed',script:[]},
  {name:'neglect-classic',seed:3,mode:'classic',script:[]},
  {name:'snacker',seed:99,mode:'relaxed',script:[...visits(OFFICE),...visits([[15,0],[16,0]]).map(([t])=>[t,'snack']),...visits([[16,1]]).map(([t])=>[t,'play:4'])]},
  // a night worker on the 'night' rhythm (asleep 9:00-19:00), visiting at their own morning, noon, evening, bedtime
  {name:'night-worker',seed:11,mode:'relaxed',life:'night',script:visits([[19,0],[23,30],[5,30],[8,30]])},
  // an early riser: wakes the pet at 6:30 by turning the light on (no 8:00 wake-up call); the 19:00 visit puts it to bed early
  {name:'early-riser',seed:17,mode:'relaxed',script:[...visits([[6,30]]).map(([t])=>[t,'light']),...visits([[6,31],[12,30],[19,0]])]},
  // a late sleeper: never turns the light on in the morning, so the pet gets up alone at noon (leans moon)
  {name:'late-sleeper',seed:23,mode:'relaxed',script:visits([[13,0],[18,30],[21,40]])},
  // a careful player who checks just before each digest: the 12:30 slot still sends a lunch hello
  {name:'attentive',seed:9,mode:'relaxed',script:visits([[8,5],[12,20],[18,25],[21,0]])},
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
  if(name==='light'){E.toggleLight(g);E.visit(g);return}
  if(!g.lights||g.sleeping)return;
  E.visit(g);
  if(name==='snack')E.snack(g);else if(name==='play')E.playDone(g,+arg);
}
function runCase(c){
  const g=E.fresh(c.seed);g.t=START;if(c.life)g.life=c.life;E.newPet(g,c.mode);
  const ev=[],out=[],script=c.script.map(([at,a])=>[at+START,a]).sort((x,y)=>x[0]-y[0]);let si=0;
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

// long absences: the reminders on days 3, 7, 14 and 30 after the app closes, once the forecast runs dry
function comebackCase(){
  const g=E.fresh(31);g.t=7*60;E.newPet(g,'relaxed');E.advance(g,10,[],{autoHatch:true});
  const ahead=E.forecast(g,7*1440);return {ahead:ahead.length,comeback:E.comeBack(g,ahead)};
}
const result={engine:'mangopet',cases:CASES.map(c=>({...c,expect:runCase(c)})),forecast:forecastCase(),comeback:comebackCase()};
if(process.argv.includes('--update')){fs.mkdirSync(path.dirname(FILE),{recursive:true});fs.writeFileSync(FILE,JSON.stringify(result,null,1)+'\n');console.log('wrote',path.relative(process.cwd(),FILE));process.exit(0)}
const want=JSON.parse(fs.readFileSync(FILE,'utf8'));let bad=0;
for(const c of result.cases){const w=want.cases.find(x=>x.name===c.name);
  const ok=w&&JSON.stringify(w.expect)===JSON.stringify(c.expect);if(!ok)bad++;
  const last=c.expect.checkpoints.at(-1).state;console.log((ok?'ok  ':'FAIL')+' '+c.name.padEnd(18)+` → ${last.phase} ${last.species||''} · notices ${c.expect.notices.length}`)}
const fok=result.forecast.matchesRealRun&&JSON.stringify(want.forecast)===JSON.stringify(result.forecast);if(!fok)bad++;
console.log((fok?'ok  ':'FAIL')+' forecast           → '+result.forecast.forecast.length+' notifications ahead, same as a real run: '+result.forecast.matchesRealRun);
const cok=JSON.stringify(want.comeback)===JSON.stringify(result.comeback);if(!cok)bad++;
console.log((cok?'ok  ':'FAIL')+' comeback           → '+result.comeback.comeback.length+' reminders after '+result.comeback.ahead+' forecast notices');
process.exit(bad?1:0);

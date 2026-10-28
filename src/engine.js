/* MangoPet rules engine.
 *
 * Pure game rules: no DOM, no wall clock, no Math.random. Everything that happens to a pet is a
 * function of the saved state `g` and the minutes that pass, so the same save always plays out the
 * same way. That is what lets the app schedule notifications ahead of time (`forecast`) and what a
 * Swift or Kotlin port has to match (tools/golden.js checks it).
 *
 * Functions take the state first and an `ev` array to push events into:
 *   {type:'notice', t, icon, text, kind, sent, held}  a notification decision (sent ones go to the screen)
 *   {type:'hatchReady'}                               the egg is ready; the screen plays the hatch, then calls hatch()
 *   {type:'evolve', stage}                            the pet changed stage
 *   {type:'charm', id}                                a keyring charm was unlocked
 *   {type:'graduate', full} {type:'die'} {type:'away'}
 */
(function(root){
'use strict';

/* ---------- data ---------- */
const CON={tough:{ko:'튼튼',en:'TOUGH',d:'병에 거의 안 걸려요'},poopy:{ko:'쾌변',en:'POOPY',d:'똥을 자주 싸요'},blocked:{ko:'변비',en:'BLOCKED',d:'가끔 배가 아파요. 펫을 3번 쓰다듬어 주세요'},
  frail:{ko:'허약',en:'FRAIL',d:'자주 아프고 약도 2번 먹어야 나아요'},greedy:{ko:'먹보',en:'GREEDY',d:'배가 빨리 고파요'},sleepy:{ko:'잠꾸러기',en:'SLEEPY',d:'오후 2시에 1시간 낮잠을 자요'}};
// rx/ry/cy shape the adult body when it is drawn; the rules only use the names
const LINES={
 sun:{ko:'해',pre:'햇',rx:7.5,ry:7,cy:13},
 moon:{ko:'달',pre:'달',rx:7,ry:7.5,cy:12.5},
 chub:{ko:'통통',pre:'통',rx:9.5,ry:6,cy:14},
 wild:{ko:'야생',pre:'들',rx:7.5,ry:7,cy:13},
};
const ANIMALS={chick:{ko:'병아리',nm:'삐약'},cat:{ko:'고양이',nm:'냥'},rabbit:{ko:'토끼',nm:'토'},frog:{ko:'개구리',nm:'개굴'},penguin:{ko:'펭귄',nm:'펭'},bear:{ko:'곰',nm:'곰'}};
const ANIMAL_OF={tough:'bear',poopy:'chick',blocked:'frog',frail:'rabbit',greedy:'penguin',sleepy:'cat'};
const SP={star:{ko:'반짝이',line:'희귀'}};const DEX=[];
for(const l in LINES)for(const a in ANIMALS){SP[l+'_'+a]={ko:LINES[l].pre+ANIMALS[a].nm,line:`${LINES[l].ko} 계열 · ${ANIMALS[a].ko}`};DEX.push(l+'_'+a)}
DEX.push('star');
const STAGE_KO={baby:'아기',child:'꼬마',teen:'청소년'};
// heirloom patterns, drawn into the body by the screen
const PATTERNS=['줄무늬','이마 별','이마 하트','볼 터치','왕점'];
const NOTIF={few:{ko:'적게',d:'아침·밤 하루 2번',cap:2,slots:[[8,0],[21,30]]},normal:{ko:'보통',d:'하루 4번 묶어서',cap:4,slots:[[8,0],[12,30],[18,30],[21,30]]},live:{ko:'제때',d:'필요할 때마다 (최대 8개)',cap:8,slots:[]}};
const DAY=1440,ADULT_AT=3*DAY,FULL_TERM=7*DAY;

/* ---------- random ---------- */
// mulberry32 on g.seed: the sequence lives in the save, so a copy of the save replays identically
function rand(g){let t=(g.seed=(g.seed+0x6D2B79F5)>>>0);t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
const pick=(g,list)=>list[Math.floor(rand(g)*list.length)];

/* ---------- time and growth ---------- */
const hourOf=t=>Math.floor(t/60)%24;
// Daily rhythm, in the pet's own clock. The player picks a rhythm (LIFE); every timed rule
// (sleep, notification slots, quiet hours, naps, morning/evening visits) reads the shifted clock,
// so night owls and night workers get the same game. Default: asleep 22:00-8:00.
const LIFE={day:{ko:'기본',d:'밤 10시~아침 8시에 자요',shift:0},owl:{ko:'올빼미',d:'새벽 1시~오전 11시에 자요',shift:3},
  night:{ko:'밤 근무',d:'오전 9시~저녁 7시에 자요',shift:11}};
const lt=g=>g.t-((LIFE[g.life]||LIFE.day).shift)*60;
const localHour=g=>hourOf(lt(g));
const isNight=g=>{const h=localHour(g);return h>=22||h<8};
// from 19:00 the player may put the pet to bed early by turning the light off, and wake it again until 22:00
const EARLY_BED=19,EARLY_WAKE=6;
const earlyBed=g=>g.stage!=='baby'&&!g.lights&&localHour(g)>=EARLY_BED;
// awake in the evening: the screen shows a drowsy face now and then
const drowsy=g=>g.phase==='alive'&&!g.sleeping&&g.stage!=='baby'&&localHour(g)>=EARLY_BED&&!isNight(g);
// a new rhythm waits until it agrees with the old one about whether the pet is asleep, so it never flips mid-day
function setLife(g,id){if(!LIFE[id])return;g.lifeNext=id;applyLife(g)}
function applyLife(g){if(!g.lifeNext)return;const old=g.life,was=isNight(g);g.life=g.lifeNext;
  if(g.phase==='alive'&&isNight(g)!==was){g.life=old;return}g.lifeNext=null}
const stageFor=a=>a<60?'baby':a<DAY?'child':a<ADULT_AT?'teen':a<FULL_TERM?'adult':'grad';
const hungerInt=g=>({baby:12,child:60,teen:75,adult:90}[g.stage])*(g.con==='greedy'?.7:1);
const happyInt=g=>({baby:22,child:110,teen:130,adult:150}[g.stage]);
const baseW=g=>({baby:5,child:10,teen:20,adult:30}[g.stage]);
const overweight=g=>g.weight>baseW(g)+15;
function poopDelay(g){const b=g.stage==='baby'?15:120;const m={poopy:.5,blocked:2.5}[g.con]||1;return Math.max(5,Math.round(b*m*(.8+rand(g)*.4)))}
// graduating on day 7 counts as the full term, whether the player or the clock does it
const fullTerm=g=>g.ageMin>=FULL_TERM-DAY;
// saves from before early graduation only ever graduated at day 7
const gradStars=d=>d.best||(d.grad?2:0);
const nm=g=>NOTIF[g.notifMode]||NOTIF.normal;

/* ---------- state ---------- */
function fresh(seed){return{notifMode:'normal',life:'day',t:8*60,speed:60,phase:'select',mode:'relaxed',skin:'classic',adFree:false,showCon:false,
  notifDay:0,notifCount:0,log:[],dex:{},hist:[],seed:seed>>>0,savedAt:0}}

function newPet(g,mode){
  Object.assign(g,{phase:'egg',mode,eggLeft:5,cracks:0,ageMin:0,stage:'egg',species:null,con:null,hunger:1,happy:3,weight:5,poops:0,
    sick:false,doses:0,tummy:false,tummyMin:0,rub:0,lights:true,lightMin:0,wakeDark:false,upEarly:false,sleeping:false,napUntil:0,hungerT:0,happyT:0,poopT:-1,poopQ:0,
    careMiss:0,callStart:null,missed:false,starveMin:0,sickMin:0,morning:0,night:0,snacks:0,meals:0,awayUntil:0,revived:false,lastPet:-999,born:g.t,plays:0,pets:0,checks:0});
  const H=g.pendingHeir;g.pendingHeir=null;g.gen=H?H.gen:1;g.parentName=H?H.from:null;
  g.acc=H&&rand(g)<.6?H.acc:rand(g)<.1?pick(g,PATTERNS):null;g.accOff=false;
}
function unlockCharm(g,id,ev){g.charms=g.charms||[];if(g.charms.includes(id))return;g.charms.push(id);g.equip=g.equip||[];if(g.equip.length<3)g.equip.push(id);ev.push({type:'charm',id})}
function hatch(g,ev){if((g.gen||1)>=2)unlockCharm(g,'tag',ev);g.phase='alive';g.stage='baby';g.con=pick(g,Object.keys(CON));notify(g,'🐣','알이 깨어났어요!','life',ev)}
function crack(g){g.cracks=(g.cracks||0)+1;return g.cracks}
function evolve(g,st,ev){
  g.stage=st;g.weight=Math.max(g.weight,baseW(g));
  if(st==='adult'){g.species=decideAdult(g);g.dex[g.species]=Object.assign({seen:true},g.dex[g.species]);if(/_cat$/.test(g.species))unlockCharm(g,'cat',ev);
    const lc={sun:'sun',moon:'moon',chub:'donut',wild:'bolt',star:'gem'}[g.species.split('_')[0]];if(lc)unlockCharm(g,lc,ev);
    if(Object.values(g.dex).filter(d=>d.seen).length>=5)unlockCharm(g,'heart',ev);notify(g,'✨',`${SP[g.species].ko}(으)로 자랐어요! 이제 졸업할 수 있어요`,'life',ev)}
  else notify(g,'✨','모습이 바뀌었어요!','need',ev);
  ev.push({type:'evolve',stage:st});
}
// how you cared only tilts the odds; every line can still show up
function lineOdds(g){
  // shares, not totals: the line follows what the player does most, whatever they do overall
  const c=(g.checks||0)+1,food=(g.meals||0)+g.snacks+1,w={
    sun:1+1.5*g.morning/c,
    moon:1+1.5*g.night/c,
    chub:.5+4.5*g.snacks/food+(g.weight>baseW(g)+8?.8:0),
    wild:.3+.5*g.careMiss};
  const sum=Object.values(w).reduce((a,b)=>a+b,0);for(const k in w)w[k]/=sum;return w;
}
function decideAdult(g){
  if(g.mode==='classic'&&g.careMiss===0&&rand(g)<.3)return 'star';
  const w=lineOdds(g);let r=rand(g),line='sun';for(const k in w){if((r-=w[k])<0){line=k;break}}
  return line+'_'+ANIMAL_OF[g.con];
}
function record(g,result){g.hist.unshift({sp:g.species||g.stage,mode:g.mode,result,days:Math.floor(g.ageMin/DAY)})}
function graduate(g,full,ev){unlockCharm(g,'star',ev);if(full||fullTerm(g))unlockCharm(g,'crown',ev);g.phase='graduated';g.lastAcc=g.acc||pick(g,PATTERNS);g.heirBox=[...new Set([...(g.heirBox||[]),g.lastAcc])];
  const d=g.dex[g.species]||{};d.seen=true;d.grad=(d.grad||0)+1;d.best=Math.max(gradStars(d),full?2:1);if(g.mode==='classic')d.classic=true;g.dex[g.species]=d;
  record(g,full?'졸업 ★★':'졸업 ★');notify(g,'🎓',`${SP[g.species].ko}이(가) 졸업했어요! 도감에 ${full?'★★':'★'}`,'life',ev);ev.push({type:'graduate',full})}
function die(g,ev){g.phase='dead';record(g,'무지개다리');notify(g,'🪦','…','life',ev);ev.push({type:'die'})}
function runAway(g,ev){g.phase='away';g.awayUntil=g.t+180;notify(g,'✉️','집을 나갔어요… 편지가 남아 있어요','life',ev);ev.push({type:'away'})}
function makeSick(g,ev){g.sick=true;g.doses=g.con==='frail'?2:1;notify(g,'🤒','몸이 뜨거워…',g.mode==='classic'?'urgent':'need',ev)}
function addPoop(g,ev){if(!g.poops)g.poopSince=g.t;if(g.poops<4)g.poops++;if(g.poops>=2)notify(g,'💩',`똥이 ${g.poops}개 쌓였어요`,'need',ev)}
function queuePoop(g){if(g.poopT<0)g.poopT=poopDelay(g);else g.poopQ=(g.poopQ||0)+1}
function doPoop(g,ev){if(g.con==='blocked'&&rand(g)<.5){g.tummy=true;g.tummyMin=0;g.rub=0;notify(g,'😣','배가 아파… 쓰다듬어 줘','need',ev)}else addPoop(g,ev)}
function needList(g){
  if(g.phase!=='alive')return [];const L=[];
  if(g.sleeping){if(isNight(g)&&g.lights)L.push({mini:'light',t:'💡 졸려… 불 꺼 줘',a:'불 끄기'});return L}
  if(g.lights&&g.stage!=='baby'&&localHour(g)===21)L.push({mini:'light',t:'🥱 슬슬 졸려',a:'불 끄기'});
  if(g.wakeDark)L.push({mini:'light',t:'☀️ 일어났어! 불 켜 줘',a:'불 켜기'});
  if(g.sick)L.push({mini:'sick',t:'🤒 몸이 아파',a:'약'+(g.doses>1?` ${g.doses}번`:'')});
  if(g.tummy)L.push({mini:'tummy',t:'😣 배가 아파',a:'펫을 3번 쓰다듬기 (또는 약)'});
  if(g.hunger===0)L.push({mini:'hungry',t:'🍙 배고파',a:'밥'});
  if(g.happy===0)L.push({mini:'bored',t:'🥱 심심해',a:'놀이 · 간식 · 쓰다듬기'});
  if(g.poops)L.push({mini:null,t:g.poops>1?`💩 똥 ${g.poops}개 치워 줘`:'💩 똥 쌌어',a:'청소'});
  return L;
}
function needsCall(g){
  if(g.sleeping)return isNight(g)&&g.lights;
  return g.hunger===0||g.happy===0||g.sick||g.tummy;
}

/* ---------- notifications ---------- */
// everyday needs go out through the digest slots unless the player chose 'live'; life events go out at once
function notify(g,icon,text,kind,ev){
  if(kind==='need'&&g.notifMode!=='live')return;
  const h=localHour(g);const quiet=h>=22||h<8;let held=null;
  if(quiet)held='조용한 시간';else if(g.notifCount>=nm(g).cap&&kind!=='urgent')held='하루 한도';
  if(held==='조용한 시간'&&kind==='life'){(g.news=g.news||[]).push(`${icon} ${text}`);return}
  if(!held)g.notifCount++;
  g.log.unshift({t:g.t,text:icon?`${icon} ${text}`:text,held});g.log.length=Math.min(g.log.length,60);
  // who: the pet's own name once it is grown, used as the notification title
  ev.push({type:'notice',t:g.t,icon,text,kind,sent:!held,held,who:g.phase==='alive'&&g.stage==='adult'&&SP[g.species]?SP[g.species].ko:null});
}

/* ---------- one minute ---------- */
// opts.autoHatch: hatch as soon as the egg is ready (for forecasts and tests, where nothing plays the animation)
function step(g,ev,opts={}){
  g.t++;
  applyLife(g);
  const h=localHour(g),m=g.t%60,day=Math.floor(lt(g)/DAY);
  if(g.notifDay!==day){g.notifDay=day;g.notifCount=0}
  if(g.phase==='egg'){g.cracks=Math.min(5,(g.cracks||0)+1);if(g.cracks>=5){if(opts.autoHatch)hatch(g,ev);else ev.push({type:'hatchReady'})}return}
  if(g.phase!=='alive')return;
  g.ageMin++;
  const st=stageFor(g.ageMin);
  if(st==='grad'){graduate(g,true,ev);return}
  if(st!==g.stage)evolve(g,st,ev);
  if(g.con==='sleepy'&&h===14&&m===0&&g.stage!=='baby')g.napUntil=g.t+60;
  if(g.upEarly&&!isNight(g))g.upEarly=false;
  const night=g.stage!=='baby'&&isNight(g)&&!g.upEarly,was=g.sleeping;
  g.sleeping=night||g.napUntil>g.t||earlyBed(g);
  // the bedtime call comes half an hour before the pet drops off on its own
  if(!g.sleeping&&g.lights&&g.stage!=='baby'&&h===21&&m===30)notify(g,'🥱','졸려… 불 꺼 주면 잘게','need',ev);
  // Morning: the pet wakes in the dark and waits for the light, so there is always a reason to look on the way to work.
  // Left in the dark until noon, it gets up on its own and leans a little towards the night (moon) line.
  if(!g.sleeping&&was){g.lightMin=0;
    if(was&&h===8&&m===0&&g.stage!=='baby'){
      if(!g.lights)g.wakeDark=true;
      else if(nm(g).slots.length)(g.news=g.news||[]).push('☀️ 좋은 아침!');
      if(!nm(g).slots.length)notify(g,'☀️',g.lights?'좋은 아침!':'일어났어! 불 켜 줘','need',ev)}
    else g.lights=true}
  if(g.wakeDark&&h===12&&m===0){g.wakeDark=false;g.lights=true;g.night++}
  if(g.sleeping&&night&&g.lights){g.lightMin++;if(g.lightMin===120)g.careMiss++}
  if(nm(g).slots.some(([dh,dm])=>dh===h&&dm===m)){const L=[...(g.news||[]),...needList(g).map(n=>n.t)];g.news=[];if(L.length)notify(g,'',L.join(' · '),'digest',ev)}
  const rx=g.mode==='relaxed'?1.5:1;
  if(!g.sleeping){
    if(++g.hungerT>=hungerInt(g)*rx){g.hungerT=-Math.floor(rand(g)*hungerInt(g)*.25);if(g.hunger>0&&--g.hunger===0)notify(g,'🍙','꼬르륵… 배고파','need',ev)}
    if(++g.happyT>=happyInt(g)*rx*(g.sick?.5:1)){g.happyT=-Math.floor(rand(g)*happyInt(g)*.25);if(g.happy>0&&--g.happy===0)notify(g,'🥱','심심해… 놀아줘','need',ev)}
    if(g.poopT>0&&--g.poopT===0){g.poopT=-1;doPoop(g,ev);if(g.poopQ>0){g.poopQ--;g.poopT=Math.max(10,Math.round(poopDelay(g)/2))}}
    if(g.tummy&&++g.tummyMin>=180&&!g.sick){g.tummy=false;makeSick(g,ev)}
  }
  if(m===0&&!g.sick&&g.stage!=='baby'){
    const mult=({tough:.3,frail:2}[g.con]||1)*(g.mode==='relaxed'?.6:1);
    let ch=g.poops&&g.t-(g.poopSince||0)>=120?g.poops*.04*mult:0;if(overweight(g))ch+=.05*mult;
    if(rand(g)<ch)makeSick(g,ev);
  }
  if(!g.sleeping&&needsCall(g)){if(g.callStart==null){g.callStart=g.t;g.missed=false}else if(!g.missed&&g.t-g.callStart>=(g.mode==='classic'?120:180)){g.careMiss++;g.missed=true}}else if(!g.sleeping)g.callStart=null;
  if(!g.sleeping){g.starveMin=g.hunger===0?g.starveMin+1:0;g.sickMin=g.sick?g.sickMin+1:0}
  const lim=g.mode==='classic'?{s:12*60,k:10*60}:{s:18*60,k:18*60};
  if(g.starveMin>=lim.s||g.sickMin>=lim.k){g.mode==='classic'?die(g,ev):runAway(g,ev)}
}
function advance(g,min,ev,opts){for(let i=0;i<min;i++)step(g,ev,opts)}

/* ---------- actions ---------- */
// each returns what happened so the screen can pick the animation; none of them read the clock
// one visit = one count, however many buttons it takes
function visit(g){if(g.t-(g.lastVisit??-999)<45)return;g.lastVisit=g.t;g.checks=(g.checks||0)+1;const h=localHour(g);if(h>=5&&h<12)g.morning++;else if(h>=20||h<5)g.night++}
function meal(g){if(g.hunger>=4)return 'full';g.meals=(g.meals||0)+1;g.hunger=Math.min(4,g.hunger+2);g.weight++;queuePoop(g);return 'ok'}
function snack(g,ev=[]){g.happy=Math.min(4,g.happy+1);g.weight+=2;g.snacks++;queuePoop(g);if((g.allSnacks=(g.allSnacks||0)+1)>=30)unlockCharm(g,'cookie',ev);return 'ok'}
function toggleLight(g){g.lights=!g.lights;if(g.lights)g.wakeDark=false;
  if(g.phase==='alive'&&g.stage!=='baby'&&!isNight(g)&&g.napUntil<=g.t)g.sleeping=earlyBed(g);
  // early risers: from 6:00 the light wakes the pet up before its 8:00 alarm (off again puts it back to sleep)
  if(g.phase==='alive'&&g.stage!=='baby'&&isNight(g)&&localHour(g)>=EARLY_WAKE){g.upEarly=g.lights;g.sleeping=!g.lights}
  return g.lights}
function med(g){if(!g.sick&&!g.tummy)return 'no';
  if(g.tummy){g.tummy=false;g.rub=0;g.poops=Math.min(4,g.poops+1);return 'tummy'}
  if(--g.doses<=0){g.sick=false;g.sickMin=0;return 'cured'}return 'dose'}
function clean(g,ev=[]){const n=g.poops;g.poops=0;if(n&&(g.allCleans=(g.allCleans||0)+1)>=50)unlockCharm(g,'poop',ev);return n}
function pet(g){
  if(g.tummy){if(++g.rub>=3){g.tummy=false;g.rub=0;g.poops=Math.min(4,g.poops+1);return 'plop'}return 'rub'}
  if(g.t-g.lastPet>=60){g.happy=Math.min(4,g.happy+1);g.lastPet=g.t;g.pets=(g.pets||0)+1;return 'happy'}
  return 'ok'}
function playDone(g,wins){g.plays=(g.plays||0)+1;g.happy=Math.min(4,g.happy+(wins>=3?2:1));g.weight=Math.max(baseW(g)-3,g.weight-1)}
function revive(g){g.phase='alive';g.revived=true;g.hunger=2;g.happy=2;g.sick=false;g.tummy=false;g.starveMin=g.sickMin=0;g.hist.shift()}
function callBack(g){g.phase='alive';g.hunger=Math.max(1,g.hunger);g.happy=1;g.starveMin=g.sickMin=0;g.sick=false}
function restart(g){record(g,'다시 키움');g.phase='select'}
function heirChoice(g,keep){g.pendingHeir=keep?{from:SP[g.species].ko,acc:g.lastAcc,gen:(g.gen||1)+1}:null;g.phase='select'}

/* ---------- forecast ---------- */
// what happens if nobody opens the app: the notifications that would go out, in order (for scheduling ahead)
function forecast(g,minutes){
  const c=JSON.parse(JSON.stringify(g)),ev=[];
  for(let i=0;i<minutes&&(c.phase==='alive'||c.phase==='egg');i++)step(c,ev,{autoHatch:true});
  return ev.filter(e=>e.type==='notice'&&e.sent).map(e=>({t:e.t,text:e.icon?`${e.icon} ${e.text}`:e.text,kind:e.kind,who:e.who}));
}
// Long absences: after the forecast runs dry (the pet ran away, or nobody opened the app for a week),
// a few gentle reminders go out on days 3, 7, 14 and 30 after the app was closed, at the evening slot.
// They are local notifications too, so no server is needed. Nothing goes out if a forecast notice is near.
const COMEBACK=[[3,'🥺 요즘 안 와서 심심해…'],[7,'✉️ 일주일째 기다리고 있어'],[14,'🥚 아직 여기 있어. 한 번만 들러 줘'],[30,'💛 오랜만이야! 다시 같이 놀자']];
function comeBack(g,ahead){
  const last=ahead.length?ahead[ahead.length-1].t:g.t,shift=(LIFE[g.life]||LIFE.day).shift*60,out=[];
  for(const [d,text] of COMEBACK){
    let t=Math.floor((g.t+d*DAY-shift)/DAY)*DAY+18*60+30+shift;   // that day's 18:30 on the pet's clock
    if(t<=last+DAY)continue;
    out.push({t,text,kind:'comeback',who:null})}
  return out;
}

const E={CON,LINES,ANIMALS,ANIMAL_OF,SP,DEX,STAGE_KO,PATTERNS,NOTIF,DAY,ADULT_AT,FULL_TERM,
  LIFE,setLife,localHour,drowsy,rand,hourOf,isNight,stageFor,hungerInt,happyInt,baseW,overweight,poopDelay,fullTerm,gradStars,nm,
  fresh,newPet,unlockCharm,hatch,crack,evolve,lineOdds,decideAdult,record,graduate,die,runAway,makeSick,addPoop,queuePoop,doPoop,needList,needsCall,
  notify,step,advance,visit,comeBack,meal,snack,toggleLight,med,clean,pet,playDone,revive,callBack,restart,heirChoice,forecast};
if(typeof module!=='undefined'&&module.exports)module.exports=E;else root.MangoEngine=E;
})(typeof globalThis!=='undefined'?globalThis:this);

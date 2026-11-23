const $=id=>document.getElementById(id);
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],LETTER=[0,0,1,1,2,3,3,4,4,5,5,6];
const LOW=60,HIGH=83;
const isBlack=m=>[1,3,6,8,10].includes(m%12);
function parse(s){let ev=[],t=0;const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 for(const raw of s.split(/[,\n]+/)){const p=raw.trim();if(!p)continue;
  if(/^r/i.test(p)){const d=parseFloat(p.split(':')[1]||1);if(!(d>0))throw p;t+=d;continue}
  const m=p.match(/^([A-Ga-g])([#b]?)(\d)(?::(\d*\.?\d+))?$/);if(!m)throw 'Cannot read "'+p+'"';
  let n=base[m[1].toUpperCase()]+(m[2]=='#'?1:m[2]=='b'?-1:0)+(+m[3]+1)*12,d=parseFloat(m[4]||1);
  if(n<LOW||n>HIGH)throw p+' is outside C4 to B5';
  ev.push({midi:n,start:t,dur:d});t+=d}
 if(!ev.length)throw 'No notes found';return ev}
const songs={
 'Twinkle Twinkle Little Star':{bpm:100,s:'C4,C4,G4,G4,A4,A4,G4:2,F4,F4,E4,E4,D4,D4,C4:2,G4,G4,F4,F4,E4,E4,D4:2,G4,G4,F4,F4,E4,E4,D4:2,C4,C4,G4,G4,A4,A4,G4:2,F4,F4,E4,E4,D4,D4,C4:2'},
 'Ode to Joy':{bpm:108,s:'E4,E4,F4,G4,G4,F4,E4,D4,C4,C4,D4,E4,E4:1.5,D4:.5,D4:2,E4,E4,F4,G4,G4,F4,E4,D4,C4,C4,D4,E4,D4:1.5,C4:.5,C4:2'},
 'Für Elise (intro)':{bpm:120,s:'E5:.5,D#5:.5,E5:.5,D#5:.5,E5:.5,B4:.5,D5:.5,C5:.5,A4:1.5,R:.5,C4:.5,E4:.5,A4:.5,B4:1.5,R:.5,E4:.5,G#4:.5,B4:.5,C5:1.5,R:.5,E4:.5,E5:.5,D#5:.5,E5:.5,D#5:.5,E5:.5,B4:.5,D5:.5,C5:.5,A4:1.5'}};
for(const k in songs)songs[k].ev=parse(songs[k].s);
let cur,evs=[],bpm=100,t=-2,playing=false,learn=true,sheetMode=false,hits=0,wrong=0,miss=0,streak=0,best=0,end=0,last=0;
const sel=$('song');function fillSel(){sel.innerHTML=Object.keys(songs).map(k=>`<option>${k}</option>`).join('')}fillSel();
function load(name){cur=name;const s=songs[name];bpm=s.bpm;evs=s.ev.map(e=>({...e,hit:false,missed:false,bad:false}));end=Math.max(...evs.map(e=>e.start+e.dur));$('l2').value=Math.min(Math.ceil(end/4),Math.max(2,+$('l2').value));resetRun()}
function resetRun(){t=-2;hits=wrong=miss=streak=0;evs.forEach(e=>{e.hit=e.missed=e.bad=false});playing=false;$('play').textContent='Play';$('msg').textContent='';stats()}
function stats(){const n=hits+wrong+miss;$('acc').textContent=(n?Math.round(hits/n*100):100)+'%';$('streak').textContent=streak;$('best').textContent=best}

/* ---------- keyboard DOM ---------- */
const kb=$('kb'),keyEl={};
const whites=[];for(let m=LOW;m<=HIGH;m++)if(!isBlack(m))whites.push(m);
whites.forEach(m=>{const d=document.createElement('div');d.className='w';d.textContent=NAMES[m%12]+(Math.floor(m/12)-1);d.dataset.m=m;kb.appendChild(d);keyEl[m]=d});
for(let m=LOW;m<=HIGH;m++)if(isBlack(m)){const wi=whites.indexOf(m-1)+1,d=document.createElement('div');d.className='b';d.style.left=`calc(${wi/whites.length*100}% - 2.1%)`;d.textContent=NAMES[m%12];d.dataset.m=m;kb.appendChild(d);keyEl[m]=d}
$('names').onchange=e=>kb.classList.toggle('hide',!e.target.checked);
function flash(m,c){const el=keyEl[m];if(!el)return;el.classList.add(c);clearTimeout(el['t'+c]);el['t'+c]=setTimeout(()=>el.classList.remove(c),260)}

/* ---------- audio ---------- */
let ctx,master;const voices={};
function initAudio(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.7;const c=ctx.createDynamicsCompressor();master.connect(c);c.connect(ctx.destination)}if(ctx.state!='running')ctx.resume()}
function noteOn(m){initAudio();noteOff(m,true);const f=440*2**((m-69)/12),g=ctx.createGain(),n=ctx.currentTime,os=[];
 [[1,1],[2,.45],[3,.22],[4,.1],[5,.05]].forEach(([h,a])=>{const o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';o.frequency.value=f*h;og.gain.value=a;o.connect(og);og.connect(g);o.start(n);os.push(o)});
 g.gain.setValueAtTime(0,n);g.gain.linearRampToValueAtTime(.3,n+.006);g.gain.exponentialRampToValueAtTime(.09,n+.5);g.gain.exponentialRampToValueAtTime(.001,n+4);
 g.connect(master);voices[m]={g,os}}
function noteOff(m,quick){const v=voices[m];if(!v)return;const n=ctx.currentTime;v.g.gain.cancelScheduledValues(n);v.g.gain.setValueAtTime(Math.max(v.g.gain.value,.001),n);v.g.gain.exponentialRampToValueAtTime(.001,n+(quick?.03:.35));v.os.forEach(o=>o.stop(n+.4));delete voices[m]}

/* ---------- input & scoring ---------- */
function press(m,silent){if(m<LOW||m>HIGH)return;if(!silent)noteOn(m);keyEl[m].classList.add('down');score(m)}
function release(m){keyEl[m]&&keyEl[m].classList.remove('down');noteOff(m)}
function score(m){if(!playing)return;let ev;
 if(learn){ev=evs.filter(e=>!e.hit&&e.midi===m&&e.start<=t+.5).sort((a,b)=>a.start-b.start)[0]}
 else{ev=evs.filter(e=>!e.hit&&!e.missed&&e.midi===m&&Math.abs(e.start-t)<=.45).sort((a,b)=>Math.abs(a.start-t)-Math.abs(b.start-t))[0]}
 if(ev){ev.hit=true;hits++;streak++;best=Math.max(best,streak);flash(m,'ok')}
 else{wrong++;streak=0;flash(m,'bad');const near=evs.find(e=>!e.hit&&e.start<=t+.5&&e.start>=t-.45);if(near)near.bad=true}
 stats()}
const KM={a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72,o:73,l:74,p:75,';':76,"'":77};
const held=new Set();
addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;const m=KM[e.key.toLowerCase()];if(m&&!e.repeat&&!e.metaKey&&!e.ctrlKey){held.add(m);press(m)}else if(e.code=='Space'){e.preventDefault();togglePlay()}});
addEventListener('keyup',e=>{const m=KM[e.key.toLowerCase()];if(m&&held.has(m)){held.delete(m);release(m)}});
let ptr={};
kb.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-m]');if(!el)return;e.preventDefault();kb.setPointerCapture?.(e.pointerId);const m=+el.dataset.m;ptr[e.pointerId]=m;press(m)});
kb.addEventListener('pointermove',e=>{if(ptr[e.pointerId]==null)return;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-m]');if(el&&+el.dataset.m!==ptr[e.pointerId]){release(ptr[e.pointerId]);ptr[e.pointerId]=+el.dataset.m;press(ptr[e.pointerId])}});
const up=e=>{if(ptr[e.pointerId]!=null){release(ptr[e.pointerId]);delete ptr[e.pointerId]}};
kb.addEventListener('pointerup',up);kb.addEventListener('pointercancel',up);

/* MIDI */
if(navigator.requestMIDIAccess){navigator.requestMIDIAccess().then(a=>{const hook=()=>{let n=0;a.inputs.forEach(i=>{n++;i.onmidimessage=e=>{const [s,m,v]=e.data,c=s&0xf0;if(c==0x90&&v>0)press(m);else if(c==0x80||(c==0x90&&v==0))release(m)}});$('midiSt').textContent=n?`MIDI: ${n} device${n>1?'s':''} ✓`:'MIDI: no device found'};hook();a.onstatechange=hook}).catch(()=>$('midiSt').textContent='MIDI: blocked')}else $('midiSt').textContent='MIDI: unsupported';

/* Mic pitch */
let an,buf,micStream,lastM=-1,stable=0,fired=-1,prevR=0;
function syncIn(on){$('inMic').classList.toggle('on',on);$('inScreen').classList.toggle('on',!on);$('micbar').classList.toggle('show',on)}
function setIn(on){const c=$('mic');c.checked=on;c.onchange({target:c})}
$('inScreen').onclick=()=>setIn(false);$('inMic').onclick=()=>setIn(true);
$('mic').onchange=async e=>{const on=e.target.checked;syncIn(on);
 if(!on){micStream&&micStream.getTracks().forEach(t=>t.stop());an=null;$('det').textContent='None';$('lvl').style.width='0';$('micTxt').textContent='Microphone off';return}
 try{$('micTxt').textContent='Allow microphone access to continue…';initAudio();micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  const s=ctx.createMediaStreamSource(micStream);an=ctx.createAnalyser();an.fftSize=2048;s.connect(an);buf=new Float32Array(an.fftSize);fired=-1;
  $('micTxt').textContent='Listening. Play a note on your piano.'}
 catch(x){e.target.checked=false;syncIn(false);alert('Microphone unavailable: '+x.message)}};
function detect(){if(!an)return;an.getFloatTimeDomainData(buf);let r=0;for(const v of buf)r+=v*v;r=Math.sqrt(r/buf.length);
 $('lvl').style.width=Math.min(100,r*600)+'%';
 const onset=r>prevR*1.5&&r>.03;
 if(r<.012){lastM=-1;stable=0;fired=-1;prevR=r;$('det').textContent='None';return}
 if(onset&&fired>=0){fired=-1;stable=0}
 prevR=r;
 const sr=ctx.sampleRate,mn=Math.floor(sr/1100),mx=Math.floor(sr/230),c=[];let e0=0,best=0;
 for(let i=0;i<buf.length-mx;i+=2)e0+=buf[i]*buf[i];
 for(let l=mn;l<=mx;l++){let v=0;for(let i=0;i<buf.length-mx;i+=2)v+=buf[i]*buf[i+l];c[l]=v;if(v>best)best=v}
 if(best<.45*e0)return;
 let bl=-1;for(let l=mn+1;l<mx;l++)if(c[l]>=.85*best&&c[l]>=c[l-1]&&c[l]>=c[l+1]){bl=l;break}
 if(bl<0)return;
 const f=sr/bl,m=Math.round(69+12*Math.log2(f/440));
 if(m<LOW||m>HIGH)return;
 $('det').textContent=NAMES[m%12]+(Math.floor(m/12)-1);
 if(m===lastM)stable++;else{stable=0;lastM=m}
 if(stable==3&&fired!==m){fired=m;press(m,true);setTimeout(()=>release(m),200)}}

/* ---------- main loop ---------- */
function bounds(){const a=Math.max(1,+$('l1').value||1),b=Math.max(a,+$('l2').value||a);return[(a-1)*4,b*4]}
function update(dt){if(!playing)return;const bps=bpm*($('tempo').value/100)/60;let nt=t+dt*bps;
 if(learn){const w=evs.filter(e=>!e.hit&&e.start<=nt+1e-6);if(w.length)nt=Math.max(t,Math.min(...w.map(e=>e.start)))}
 t=nt;
 if(!learn)evs.forEach(e=>{if(!e.hit&&!e.missed&&t>e.start+.45){e.missed=true;miss++;streak=0;stats()}});
 if($('loop').checked){const[a,b]=bounds();if(t>=b){t=a-1;evs.forEach(e=>{if(e.start>=a&&e.start<b){e.hit=e.missed=e.bad=false}})}}
 else if(t>end+1){playing=false;$('play').textContent='Play';const n=hits+wrong+miss;$('msg').textContent='Finished. Accuracy '+(n?Math.round(hits/n*100):100)+'% · best streak '+best}}
const cv=$('roll'),g=cv.getContext('2d');let W,H;
const cs=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function size(){const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;W=r.width;H=r.height;cv.width=W*d;cv.height=H*d;g.setTransform(d,0,0,d,0,0)}
addEventListener('resize',size);
function keyX(m){if(!isBlack(m)){const i=whites.indexOf(m),w=W/whites.length;return[i*w+2,w-4]}const i=whites.indexOf(m-1)+1,w=W/whites.length*.6;return[i*W/whites.length-w/2,w]}
function drawRoll(){g.clearRect(0,0,W,H);const bg=cs('--card'),ok=cs('--ok'),bad=cs('--bad'),tile=cs('--tile'),bd=cs('--bd');
 g.fillStyle=bg;g.fillRect(0,0,W,H);const ww=W/whites.length;g.strokeStyle=bd;g.lineWidth=1;g.globalAlpha=.6;
 for(let i=1;i<whites.length;i++){g.beginPath();g.moveTo(i*ww,0);g.lineTo(i*ww,H);g.stroke()}g.globalAlpha=1;
 const hy=H-6,ppb=H/6;
 if($('loop').checked){const[a,b]=bounds();g.fillStyle='#ec489914';const y1=hy-(b-t)*ppb,y2=hy-(a-t)*ppb;g.fillRect(0,y1,W,y2-y1)}
 for(const e of evs){const top=hy-(e.start+e.dur-t)*ppb,h=e.dur*ppb-3;if(top>H||top+h<0)continue;const[x,w]=keyX(e.midi);
  g.fillStyle=e.hit?ok:e.bad||e.missed?bad:tile;g.globalAlpha=e.missed&&!e.hit?.55:1;g.beginPath();g.roundRect(x,top,w,Math.max(h,8),6);g.fill();g.globalAlpha=1;
  if(h>16){g.fillStyle='#fff';g.font='600 11px system-ui';g.textAlign='center';g.fillText(NAMES[e.midi%12],x+w/2,top+h-5)}}
 g.fillStyle=cs('--pink');g.fillRect(0,hy,W,3)}
/* sheet SVG */
function drawSheet(){const yb=150,ink=cs('--ink'),ok=cs('--ok'),bad=cs('--bad'),pk=cs('--pink'),px=64;let s='';
 for(let i=0;i<5;i++)s+=`<line x1="10" x2="790" y1="${yb-i*20}" y2="${yb-i*20}" stroke="${ink}" stroke-width="1.2"/>`;
 s+=`<text x="14" y="${yb+16}" font-size="92" fill="${ink}" font-family="'Noto Music','Segoe UI Symbol','Apple Symbols',serif">𝄞</text>`;
 const dpos=m=>{const o=Math.floor(m/12)-1,p=m%12;return o*7+LETTER[p]},ypos=m=>yb-(dpos(m)-30)*10;
 const hx=130;s+=`<line x1="${hx}" x2="${hx}" y1="40" y2="200" stroke="${pk}" stroke-width="3" opacity=".7"/>`;
 for(const e of evs){const x=hx+(e.start-t)*px;if(x<80||x>800)continue;const y=ypos(e.midi),d=dpos(e.midi),c=e.hit?ok:e.bad||e.missed?bad:ink;
  for(let k=28;k>=d;k-=2)s+=`<line x1="${x-16}" x2="${x+16}" y1="${yb-(k-30)*10}" y2="${yb-(k-30)*10}" stroke="${ink}"/>`;
  for(let k=40;k<=d;k+=2)s+=`<line x1="${x-16}" x2="${x+16}" y1="${yb-(k-30)*10}" y2="${yb-(k-30)*10}" stroke="${ink}"/>`;
  const filled=e.dur<2;s+=`<ellipse cx="${x}" cy="${y}" rx="12" ry="9" transform="rotate(-20 ${x} ${y})" fill="${filled?c:'none'}" stroke="${c}" stroke-width="2.5"/>`;
  if(e.dur<4)s+=d>=34?`<line x1="${x-11}" x2="${x-11}" y1="${y}" y2="${y+45}" stroke="${c}" stroke-width="2"/>`:`<line x1="${x+11}" x2="${x+11}" y1="${y}" y2="${y-45}" stroke="${c}" stroke-width="2"/>`;
  if(e.dur<.99)s+=d>=34?`<path d="M${x-11} ${y+45} q12 -2 10 -12" stroke="${c}" fill="none" stroke-width="2"/>`:`<path d="M${x+11} ${y-45} q12 8 8 20" stroke="${c}" fill="none" stroke-width="2"/>`;
  if(NAMES[e.midi%12].includes('#'))s+=`<text x="${x-34}" y="${y+7}" font-size="22" fill="${c}">♯</text>`}
 $('sheet').innerHTML=s}
function frame(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;update(dt);detect();sheetMode?drawSheet():drawRoll();requestAnimationFrame(frame)}

/* ---------- UI ---------- */
function togglePlay(){initAudio();if(!playing&&t>end+1)resetRun();playing=!playing;$('play').textContent=playing?'Pause':'Play';$('play').classList.add('pri');$('msg').textContent=''}
$('play').onclick=togglePlay;$('reset').onclick=resetRun;
sel.onchange=()=>load(sel.value);
$('tempo').oninput=e=>$('tv').textContent=e.target.value+'%';
$('modeView').onclick=()=>{sheetMode=!sheetMode;$('modeView').textContent='View: '+(sheetMode?'Sheet Music':'Piano Roll');$('sheet').style.display=sheetMode?'block':'none';cv.style.display=sheetMode?'none':'block'};
$('modePlay').onclick=()=>{learn=!learn;$('modePlay').textContent='Mode: '+(learn?'Learning':'Practice');resetRun()};

$('custom').onclick=()=>{playing=false;$('play').textContent='Play';$('modal').style.display='flex'};
$('ccancel').onclick=()=>$('modal').style.display='none';
$('cok').onclick=()=>{try{const ev=parse($('cseq').value),n=($('cname').value||'Custom')+' (custom)';songs[n]={bpm:100,s:$('cseq').value,ev};fillSel();sel.value=n;load(n);$('cerr').textContent='';$('modal').style.display='none';togglePlay()}catch(x){$('cerr').textContent=String(x)}};
size();load('Twinkle Twinkle Little Star');{const q=new URLSearchParams(location.search).get('song');if(q&&songs[q]){sel.value=q;load(q)}if(location.hash=='#create')$('custom').click()}requestAnimationFrame(frame);

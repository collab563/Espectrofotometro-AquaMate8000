/* =====================================================================
   engine.js — application state + measurement physics
   Formulas follow Chapter 25 "Calculations for Software" of the guide.
   ===================================================================== */

const App = {
  lang: 'en',
  tutorOn: false,
  tutorMode: null,
  screen: 'mainmenu',
  mode: null,
  nav: [],
  sel: 0,
  entry: null,
  menu: null,
  nameEntry: null,
  contrast: 0.45,
  power: true,

  /* --- utility state --- */
  util: {
    printer: 'PC',
    standby: 'v_standby15',
    baselineExp: 0,
    beeper: true,
    lang: 'English',
    date: { y:2026, m:10, d:20, h:14, min:36, pm:true, fmt24:false },
    calculator: null
  },

  /* --- cells on the carousel --- */
  cells: {
    B: {kind:'vial',     sol:'water', conc:0},
    '1':{kind:'square',  sol:'water', conc:0},
    '2':{kind:'square',  sol:'water', conc:0},
    '3':{kind:'vial',    sol:'water', conc:0},
    '4':{kind:'longpath',sol:'water', conc:0},
    '5':{kind:'vial',    sol:'water', conc:0}
  },
  beamCell: 'B',

  /* --- current test --- */
  test: null,
  blankRef: null,
  rgntBlank: null,
  results: [],
  stats: { n:0, sum:0, sum2:0 },

  stored: [],
  smartstart: [],
  locked: [],
  savedData: [],
  cellcorrState: null,
  log: [],
  printout: [],
  busy: false,
  timer: null,
  interval: null
};

/* ---- test templates -------------------------------------------------- */
function newTest(mode, opts){
  opts = opts || {};
  const base = {
    name: '-------',
    saved:false,
    stat: opts.stat !== false,
    positioner: 'auto6',
    nSamples: 1,
    id: 1,
    autoPrint: false,
    autoSave: false,
    dataFile: 'Data',
    cellCorr: 'Off',
    cellCorrConfig: {mode:'Scan', start:400, stop:700, n:1, wavelengths:[546], measurements:{}, completedAt:null},
    delay:'0:00',
    low:0, high:0,
    mode: mode
  };
  switch(mode){
    case 'atc_basic':
      return Object.assign(base, { mode:'Absorbance', lambda:546 });
    case 'atc_adv':
      return Object.assign(base, { mode:'Conc/Std', lambda:546, refCorr:false, refWl:320,
        concStd:'Undefined', factor:'Undefined', units:'mg/L' });
    case 'scan':
      return Object.assign(base, { mode:'Absorbance', start:400, stop:500, interval:1.0,
        scanSpeed:'v_fast', wavelength:415 });
    case 'kinetics':
      return Object.assign(base, { mode:'Absorbance', wavelength:546, refCorr:false,
        intervalTime:'0:01', totalRun:'0:05:00', measBlank:'Once', dispResult:false, units:'mg/L' });
    case 'multi':
      return Object.assign(base, { mode:'Absorbance', units:'mg/L', wls:[] });
    case 'ratio':
      return Object.assign(base, { wl1:260, wl2:280, refCorr:false, refWl:320, factor1:1 });
    case 'diff':
      return Object.assign(base, { wl1:546, wl2:546, refCorr:false, refWl:320, factor1:1, factor2:1 });
    case 'ptnet':
      return Object.assign(base, { wl1:545, wl2:546, wl3:547, refCorr:false, refWl:320, factor:1, units:'C' });
    case 'stdcurve':
      return Object.assign(base, { wavelength:508, units:'mg/L', curveFit:'v_linear',
        standards:[], low:0, high:0 });
    case 'water':
      return Object.assign(base, { methodId: opts.methodId || 'copper', positioner:'manual3',
        lambda:546, A0:0, B:1.0, C:0, D:0, units:'mg/L', reverse:false, rgntBlank:false,
        adj1pt:false, adjFactor:1 });
    case 'pv':
      return Object.assign(base, { pvType: opts.pvType||'wavAccInternal' });
    default: return base;
  }
}

/* ---- spectra --------------------------------------------------------- */
/* normalised band shape of a solution (peaks sum ≈ 1 at their centre) */
function bandShape(sol, nm){
  let a = 0;
  (sol.peaks||[]).forEach(p=>{ a += gauss(nm, p.c, p.h, p.w); });
  return a;
}

/* raw absorbance of whatever sits in cell `c` at wavelength nm */
function cellAbs(c, nm){
  const cell = App.cells[c];
  if (!cell) return 0;
  const sol = SOL_BY_ID[cell.sol] || (METHOD_BY_ID[cell.sol] && fakeSol(cell.sol));
  if (!sol) return 0;
  const isRev = !!sol.reverse;
  const aPer = sol.slopeAbs !== undefined ? sol.slopeAbs : (sol.slope || 0);
  const shape = bandShape(sol, nm);
  const frac = isRev ? Math.max(0, 1 - cell.conc*aPer) : cell.conc*aPer;
  return (sol.base||0) + shape*frac + cellOpticalOffset(c,nm);
}

/* Small, stable holder/cuvette differences make the 8000 correction workflow
   observable in the simulator without pretending to model real hardware. */
function cellOpticalOffset(c,nm){
  if (c==='B') return 0;
  const i = Math.max(1, ['1','2','3','4','5'].indexOf(String(c))+1);
  const x = Number(nm)||500;
  return 0.0011*Math.sin(x*0.013+i*1.7) + 0.00045*Math.cos(x*0.021+i*0.8);
}
function fakeSol(id){
  const m = METHOD_BY_ID[id];
  if (!m) return null;
  const f = function(){
    const m = METHOD_BY_ID[id];
    f.peaks = m.peaks; f.base = m.base; f.reverse = m.reverse;
    f.slopeAbs = 1/Math.abs(m.B);
    return f;
  };
  f(); return f;
}

/* drift/offset of the most recent blank reading (small, wavelength-dependent) */
function blankAt(nm){
  if (!App.blankRef) return 0;
  const s = App.blankRef.seed;
  return App.blankRef.base + 0.00035*Math.abs(Math.sin(nm*0.0173 + s));
}

/* blank-corrected absorbance — what the instrument actually reports */
function measureAbs(c, nm){
  const raw = cellAbs(c, nm);
  const corrected = raw - cellCorrectionAt(c,nm);
  const isWaterTest = App.mode==='water';
  if (!App.blankRef) return corrected;
  if (isWaterTest && App.test && App.test.rgntBlank && App.rgntBlank){
    const blank = App.rgntBlank.absorbance;
    const net=corrected-blank;
    /* Reverse-color methods need the sign retained for their negative slope. */
    return App.test.reverse ? net : Math.max(0,net);
  }
  return Math.max(0, corrected - blankAt(nm));
}

function cellCorrectionAt(c,nm){
  const T=App.test, cfg=T&&T.cellCorrConfig;
  if (!T || T.cellCorr!=='On' || !['auto6','auto3'].includes(T.positioner) || !cfg || !cfg.completedAt) return 0;
  const points=cfg.measurements && cfg.measurements[c];
  if (!points || !points.length) return 0;
  const x=Number(nm);
  if (cfg.mode==='Discrete nms'){
    let best=null, dist=Infinity;
    points.forEach(p=>{ const d=Math.abs(p.nm-x); if(d<dist){dist=d;best=p;} });
    return best && dist<=0.05 ? best.delta : 0;
  }
  const sorted=points.slice().sort((a,b)=>a.nm-b.nm);
  if(x<sorted[0].nm || x>sorted[sorted.length-1].nm) return 0;
  for(let i=1;i<sorted.length;i++){
    if(x<=sorted[i].nm){
      const a=sorted[i-1], b=sorted[i], span=b.nm-a.nm;
      return span ? a.delta+(b.delta-a.delta)*(x-a.nm)/span : a.delta;
    }
  }
  return sorted[sorted.length-1].delta;
}

/* deterministic pseudo-noise so the same measurement repeats sensibly */
function jitter(scale){
  return (Math.random()-0.5)*2*scale;
}

/* ---- conversions ----------------------------------------------------- */
function toT(A){ return Math.pow(10, -A)*100; }
function fromT(T){ return -Math.log10(T/100); }

/* ---- statistics ------------------------------------------------------ */
function pushStat(v){
  if (!App.test || !App.test.stat) return;
  App.stats.n++; App.stats.sum += v; App.stats.sum2 += v*v;
}
function statAvg(){
  return App.stats.n ? App.stats.sum/App.stats.n : 0;
}
function statSD(){
  if (App.stats.n<2) return 0;
  const m = statAvg();
  return Math.sqrt((App.stats.sum2 - App.stats.n*m*m)/(App.stats.n-1));
}
function resetStats(){ App.stats={n:0,sum:0,sum2:0}; }

/* ---- regression (manual §25) ---------------------------------------- */
function linReg(pts){          /* general case, with intercept */
  const n = pts.length;
  let sx=0, sy=0, sxx=0, syy=0, sxy=0;
  pts.forEach(p=>{ sx+=p.x; sy+=p.y; sxx+=p.x*p.x; syy+=p.y*p.y; sxy+=p.x*p.y; });
  const slope = (n*sxy - sx*sy) / (n*sxx - sx*sx);
  const icept = (sy - slope*sx)/n;
  const num = n*sxy - sx*sy, den = Math.sqrt((n*sxx-sx*sx)*(n*syy-sy*sy));
  const r = den ? num/den : 1;
  return {slope, intercept:icept, r};
}
function linReg0(pts){         /* through zero: a1 = SXY/SXX */
  let sxy=0, sxx=0;
  pts.forEach(p=>{ sxy+=p.x*p.y; sxx+=p.x*p.x; });
  return {slope: sxx ? sxy/sxx : 0, intercept:0, r:1};
}

/* ---- formats --------------------------------------------------------- */
function fx(v, d){
  if (v===null||v===undefined||isNaN(v)) return 'Undefined';
  if (Math.abs(v)>=10000) return v.toExponential(2);
  return Number(v).toFixed(d===undefined?3:d);
}
function sign4(v){
  const s = v<0?'-':'+';
  return s + Math.abs(v).toFixed(3);
}

/* ---- clock ----------------------------------------------------------- */
function clockString(){
  const now = new Date();
  const hours = now.getHours(), minutes = now.getMinutes();
  if (App.util.date.fmt24) return String(hours).padStart(2,'0') + ':' + String(minutes).padStart(2,'0');
  const ap = hours >= 12 ? 'pm' : 'am';
  let h = hours % 12; if (h===0) h = 12;
  return h + ':' + String(minutes).padStart(2,'0') + ap;
}
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dateString(){
  const now = new Date();
  return String(now.getDate()).padStart(2,'0') + MON[now.getMonth()] + String(now.getFullYear()).slice(-2);
}

/* ---- logging / printing --------------------------------------------- */
function logEvent(msg){
  App.log.push(clockString().padStart(7)+'  '+msg);
  if (App.log.length>400) App.log.shift();
}
function printLine(s){
  App.printout.push(s);
  if (App.printout.length>200) App.printout.shift();
}
function printResult(){
  const t = App.test;
  printLine('');
  printLine('Test Name:  ' + t.name);
  printLine('Date/Time:  ' + clockString() + '  ' + dateString());
  printLine('Cell:       ' + App.beamCell);
  printLine('Wavelength: ' + (t.lambda||t.wavelength||'--') + 'nm');
  printLine('Result:     ' + lastResultString());
  printLine('-----------------------------------------');
}

/* Browser storage stands in for the instrument's internal/USB directories. */
const SIM_STORAGE_KEY='orion-aquamate8000-state-v1';
function restoreSimulatorState(){
  try{
    const raw=localStorage.getItem(SIM_STORAGE_KEY);
    if(!raw) return;
    const s=JSON.parse(raw);
    if(Array.isArray(s.stored)) App.stored=s.stored;
    if(Array.isArray(s.smartstart)) App.smartstart=s.smartstart;
    if(Array.isArray(s.locked)) App.locked=s.locked;
    if(Array.isArray(s.savedData)) App.savedData=s.savedData;
    if(s.cellcorrState && typeof s.cellcorrState==='object') App.cellcorrState=s.cellcorrState;
    if(s.util && typeof s.util==='object') App.util=Object.assign(App.util,s.util);
  }catch(err){ console.warn('AquaMate saved data could not be restored.',err); }
}
function persistSimulatorState(){
  try{
    const state={stored:App.stored,smartstart:App.smartstart,locked:App.locked,
      savedData:App.savedData,cellcorrState:App.cellcorrState,util:App.util};
    while(true){
      try{localStorage.setItem(SIM_STORAGE_KEY,JSON.stringify(state));break;}
      catch(err){
        if(state.savedData.length){state.savedData.shift();App.savedData=state.savedData;}
        else{console.warn('AquaMate saved data could not be stored.',err);break;}
      }
    }
  }catch(err){ console.warn('AquaMate saved data could not be stored.',err); }
}
function saveResultData(){
  const r=App.results[App.results.length-1], T=App.test;
  if(!r) return null;
  const record={
    id:Date.now(), test:T&&T.name!=='-------'?T.name:(App.mode||'Test'),
    fileName:T&&T.dataFile||'Data',
    mode:App.mode, methodId:T&&T.methodId||null, date:dateString(), time:clockString(),
    cell:App.beamCell, wavelength:T&&(T.lambda||T.wavelength||T.start)||null,
    absorbance:Number.isFinite(r.A)?r.A:null,
    result:r.text||(r.pts?'Curve ('+r.pts.length+' points)':fx(r.result,3)),
    units:T&&T.units||'', points:r.pts||null
  };
  App.savedData.push(record);
  if(App.savedData.length>100) App.savedData.shift();
  persistSimulatorState();
  return record;
}
function lastResultString(){
  const r = App.results[App.results.length-1];
  return r ? r.text : '';
}

/* ---- async busy helper ---------------------------------------------- */
function busyFor(ms, done){
  App.busy = true;
  document.body.style.cursor = 'progress';
  if (App.timer) clearTimeout(App.timer);
  App.timer = setTimeout(()=>{
    if (App.interval){ clearInterval(App.interval); App.interval = null; }
    App.busy = false;
    document.body.style.cursor = '';
    if (done) done();
  }, ms);
}

/* ---- helper: positioner cells --------------------------------------- */
function posCells(id){
  const p = POSITIONERS.find(p=>p.id===id);
  return p ? p.cells : ['B','1','2','3','4','5'];
}
function posSample(id){
  const p = POSITIONERS.find(p=>p.id===id);
  return p ? p.sample : '1';
}

/* =====================================================================
   screens.js — every screen of the AquaMate 8000
   Each screen exposes draw() and key(k).
   ===================================================================== */

/* ---------- navigation helpers --------------------------------------- */
function go(screen){ App.nav.push(App.screen); App.screen = screen; App.sel = 0; paint(); }
function back(){
  const prev = App.nav.pop();
  App.screen = prev || 'mainmenu';
  App.sel = 0; paint();
}
function reset(s){ App.screen = s||'mainmenu'; App.nav = []; App.sel = 0; paint(); }

function configureEntry(cfg){
  App.entry = Object.assign({
    label:'', value:0, buffer:'', min:-1e9, max:1e9,
    hint:'', decimals:0, unit:''
  }, cfg);
  App.entry.buffer = cfg.buffer !== undefined ? cfg.buffer : String(cfg.value);
  App.entry.pristine = true;
}
function setEntry(cfg){
  configureEntry(cfg);
  App.nav.push(App.screen);
  App.screen = 'entry'; paint();
}
function replaceEntry(cfg){
  configureEntry(cfg);
  paint();
}
/* the onAccept callback is responsible for navigating back */
function commitEntry(){
  const e = App.entry;
  if (!e) return;
  if (e.text){
    const value = e.buffer.trim();
    if (!value || (e.validate && !e.validate(value))){
      e.error = e.invalidMessage || t('e_invalidValue');
      paint();
      return;
    }
    App.entry = null;
    if (e.onAccept) e.onAccept(value, e);
    else back();
    return;
  }
  const n = Number(e.buffer);
  if (!e.buffer.trim() || !Number.isFinite(n)){
    e.error = t('e_invalidNumber');
    paint();
    return;
  }
  if (n < e.min || n > e.max){
    e.error = t('e_valueRange').replace('{min}',e.min).replace('{max}',e.max);
    paint();
    return;
  }
  if(e.integer && !Number.isInteger(n)){
    e.error=t('e_integer'); paint(); return;
  }
  App.entry = null;
  if (e.onAccept) e.onAccept(n, e);
  else back();
}
function setMenu(cfg){
  App.menu = Object.assign({ title:'', opts:[], sel:0, value:null }, cfg);
  App.nav.push(App.screen);
  App.screen = 'menu'; App.sel = 0; paint();
}
function pickMenu(i){
  const m = App.menu; if(!m) return;
  const v = m.opts[i];
  App.menu = null;
  if (m.onPick) m.onPick(v, i);
  else back();
}
function openName(title, initial, maxLen, onAccept, prefixKey){
  App.nameEntry = { title, buf: String(initial||'').slice(0,maxLen||16), max: maxLen||16,
                    row:0, col:0, onAccept, prefixKey };
  App.nav.push(App.screen);
  App.screen = 'nameentry'; paint();
}

function setCellCorrection(T,value){
  if(value==='On' && !['auto6','auto3'].includes(T.positioner)){
    App.notice=t('e_cellCorrHolder');
    logEvent('Cell correction requires Auto 6 or Auto 3');
    return;
  }
  T.cellCorr=value;
  App.notice='';
}
function positionerSampleLimit(id){
  return ({auto6:5,manual6:5,auto3:2,manual3:2,single:99})[id]||1;
}
function setPositioner(T,value){
  T.positioner=value;
  if(T.nSamples>positionerSampleLimit(value)) T.nSamples=positionerSampleLimit(value);
  if(!posCells(value).includes(App.beamCell)) App.beamCell='B';
  if(T.cellCorr==='On' && !['auto6','auto3'].includes(value)){
    T.cellCorr='Off'; App.notice=t('e_cellCorrHolder');
  }
  if(typeof renderCarousel==='function') renderCarousel();
}
function cellCorrectionSpecs(T){
  return [
    P('cellCorr','p_cellCorr','menu',()=>T.cellCorr,v=>setCellCorrection(T,v),{opts:['Off','On']}),
    P('cellCorrSetup','p_setupCorrection','action',()=>t('k_setupCorrection'))
  ];
}
function outputSpecs(T){
  return [
    P('autoPrint','p_autoPrint','toggle',()=>T.autoPrint?'On':'Off',v=>{T.autoPrint=v==='On';}),
    P('autoSave','p_autoSave','toggle',()=>T.autoSave?'On':'Off',v=>{T.autoSave=v==='On';}),
    P('dataFile','p_dataFile','text',()=>T.dataFile,v=>{T.dataFile=v;})
  ];
}

function paint(){ if (typeof render === 'function') render(); }

/* ---------- small builders ------------------------------------------- */
function P(key, label, type, get, set, extra){
  const p=Object.assign({key, label, type, get, set}, extra||{});
  if(key==='nSamples' && p.max===99 && App.mode!=='water') p.max=positionerSampleLimit(App.test.positioner);
  return p;
}
const NL = n => String(n).padStart(n>1?2:1,'0');

/* =====================================================================
   PARAMETER SPECIFICATIONS  (labels match the User Guide)
   ===================================================================== */
function paramSpec(){
  const T = App.test;
  switch(App.mode){
    case 'atc_basic': return [
      P('name','p_testName','text', ()=>T.name),
      P('mode','p_mode','menu', ()=>T.mode, v=>{T.mode=v; resetStats();},
        {opts:['Absorbance','%Transmittance','Concentration'],
         labels:o=>o==='Absorbance'?t('v_abs'):o==='%Transmittance'?t('v_t'):t('v_conc')}),
      P('lambda','p_wavelength','num', ()=>T.lambda, v=>{T.lambda=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('delay','p_delay','time', ()=>T.delay, v=>{T.delay=v;}),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      P('stat','p_stats','toggle', ()=>T.stat?'On':'Off', v=>{T.stat=v==='On'; if(!T.stat) resetStats();}),
      P('autoPrint','p_autoPrint','toggle', ()=>T.autoPrint?'On':'Off', v=>{T.autoPrint=v==='On';}),
      P('low','p_low','num', ()=>T.low, v=>{T.low=v;}, {min:0,max:1e6}),
      P('high','p_high','num', ()=>T.high, v=>{T.high=v;}, {min:0,max:1e6})
    ];
    case 'atc_adv': return [
      P('name','p_testName','text', ()=>T.name),
      P('mode','p_mode','menu', ()=>T.mode, v=>{T.mode=v; resetStats(); App.stdA=null;},
        {opts:['Absorbance','%Transmittance','Conc/Std','Conc/Factor'],
         labels:o=>o==='Absorbance'?t('v_abs'):o==='%Transmittance'?t('v_t'):o==='Conc/Std'?t('v_concStd'):t('v_concFactor')}),
      P('lambda','p_wavelength','num', ()=>T.lambda, v=>{T.lambda=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('refCorr','p_refCorr','toggle', ()=>T.refCorr?'On':'Off', v=>{T.refCorr=v==='On';}),
      P('refWl','p_refWl','num', ()=>T.refWl, v=>{T.refWl=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('delay','p_delay','time', ()=>T.delay, v=>{T.delay=v;}),
      P('concStd','p_concStd','num', ()=>T.concStd, v=>{T.concStd=v;}, {min:0,max:1e9,dec:3}),
      P('factor','p_factor','num', ()=>T.factor, v=>{T.factor=v;}, {min:0,max:1e9,dec:4}),
      P('units','p_units','menu', ()=>T.units, v=>{T.units=v;}, {opts:UNITS}),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      P('more','p_moreParams','more',()=>'',null,{page:'more'})
    ];
    case 'atc_adv2': return [
      P('stat','p_stats','toggle', ()=>T.stat?'On':'Off', v=>{T.stat=v==='On'; if(!T.stat) resetStats();}),
      P('autoPrint','p_autoPrint','toggle', ()=>T.autoPrint?'On':'Off', v=>{T.autoPrint=v==='On';}),
      P('autoSave','p_autoSave','toggle', ()=>T.autoSave?'On':'Off', v=>{T.autoSave=v==='On';}),
      P('dataFile','p_dataFile','text', ()=>T.dataFile, v=>{T.dataFile=v;}),
      P('cellCorr','p_cellCorr','menu', ()=>T.cellCorr, v=>setCellCorrection(T,v), {opts:['Off','On']}),
      P('id','p_id','num', ()=>T.id, v=>{T.id=v;}, {min:0,max:999}),
      P('low','p_low','num', ()=>T.low, v=>{T.low=v;}, {min:0,max:1e6}),
      P('high','p_high','num', ()=>T.high, v=>{T.high=v;}, {min:0,max:1e6})
    ];
    case 'scan': return [
      P('name','p_testName','text', ()=>T.name),
      P('mode','p_mode','menu', ()=>T.mode, v=>{T.mode=v;},
        {opts:['Absorbance','%Transmittance'], labels:o=>o==='Absorbance'?t('v_abs'):t('v_t')}),
      P('start','p_startWl','num', ()=>T.start, v=>{T.start=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('stop','p_stopWl','num', ()=>T.stop, v=>{T.stop=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('scanSpeed','p_scanSpeed','menu', ()=>t(T.scanSpeed), v=>{T.scanSpeed=v;},
        {opts:['v_fast','v_medium','v_slow'], labels:o=>t(o)}),
      P('interval','p_interval','num', ()=>T.interval, v=>{T.interval=v;}, {min:0.1,max:10,dec:1,unit:'nm'}),
      ...cellCorrectionSpecs(T),
      P('id','p_id','num', ()=>T.id, v=>{T.id=v;}, {min:0,max:999}),
      ...outputSpecs(T)
    ];
    case 'kinetics': return [
      P('name','p_testName','text', ()=>T.name),
      P('mode','p_mode','menu', ()=>T.mode, v=>{T.mode=v;},
        {opts:['Absorbance','%Transmittance'], labels:o=>o==='Absorbance'?t('v_abs'):t('v_t')}),
      P('wavelength','p_wavelength','num', ()=>T.wavelength, v=>{T.wavelength=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('refCorr','p_refCorr','toggle', ()=>T.refCorr?'On':'Off', v=>{T.refCorr=v==='On';}),
      P('delay','p_delay','time', ()=>T.delay, v=>{T.delay=v;}),
      P('intervalTime','p_intervalTime','time', ()=>T.intervalTime, v=>{T.intervalTime=v;}),
      P('totalRun','p_totalRun','duration', ()=>T.totalRun, v=>{T.totalRun=v;}),
      P('measBlank','p_measBlank','menu', ()=>t(T.measBlank), v=>{T.measBlank=v;},
        {opts:['p_measureOnce','p_measureEvery'], labels:o=>t(o)}),
      P('dispResult','p_displayRes','toggle', ()=>T.dispResult?'On':'Off', v=>{T.dispResult=v==='On';}),
      ...cellCorrectionSpecs(T),
      ...outputSpecs(T)
    ];
    case 'multi': {
      const measurementModes=['Absorbance','%Transmittance','Conc/Factor'];
      if(!measurementModes.includes(T.mode)) T.mode='Absorbance';
      return [
      P('name','p_testName','text', ()=>T.name),
      P('mode','p_mode','menu', ()=>T.mode, v=>{T.mode=v; resetStats(); App.results=[];},
        {opts:measurementModes, labels:o=>o==='Absorbance'?t('v_abs'):o==='%Transmittance'?t('v_t'):t('v_concFactor')}),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      ...cellCorrectionSpecs(T),
      P('id','p_id','num', ()=>T.id, v=>{T.id=v;}, {min:0,max:999})
    ];
    }
    case 'ratio': return [
      P('name','p_testName','text', ()=>T.name, undefined,
        {format:v=>T.saved&&v!=='-------'?String(v)+'[Saved]':v}),
      P('wl1','p_wl1','num', ()=>T.wl1, v=>{T.wl1=v;},
        {min:190,max:1100,dec:1,unit:'nm',format:v=>fx(v,1)+'nm'}),
      P('wl2','p_wl2','num', ()=>T.wl2, v=>{T.wl2=v;},
        {min:190,max:1100,dec:1,unit:'nm',format:v=>fx(v,1)+'nm'}),
      P('refCorr','p_refCorr','toggle', ()=>T.refCorr?'On':'Off', v=>{T.refCorr=v==='On';}),
      P('refWl','p_refWl','num', ()=>T.refWl, v=>{T.refWl=v;},
        {min:190,max:1100,dec:1,unit:'nm',format:v=>fx(v,1)+'nm'}),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      P('more','p_moreParams','action', ()=>t('p_moreParams'))
    ];
    case 'diff': return [
      P('name','p_testName','text', ()=>T.name),
      P('wl1','p_wl1','num', ()=>T.wl1, v=>{T.wl1=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('wl2','p_wl2','num', ()=>T.wl2, v=>{T.wl2=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('refCorr','p_refCorr','toggle', ()=>T.refCorr?'On':'Off', v=>{T.refCorr=v==='On';}),
      P('refWl','p_refWl','num', ()=>T.refWl, v=>{T.refWl=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('factor1','Factor 1','num', ()=>T.factor1, v=>{T.factor1=v;}, {min:0,max:1e6,dec:3}),
      P('factor2','Factor 2','num', ()=>T.factor2, v=>{T.factor2=v;}, {min:0,max:1e6,dec:3}),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      ...cellCorrectionSpecs(T), ...outputSpecs(T)
    ];
    case 'ptnet': return [
      P('name','p_testName','text', ()=>T.name),
      P('wl1','p_wl1','num', ()=>T.wl1, v=>{T.wl1=v;}, {min:190,max:1100,dec:1,unit:'nm',format:v=>fx(v,1)+'nm'}),
      P('wl2','p_wl2','num', ()=>T.wl2, v=>{T.wl2=v;}, {min:190,max:1100,dec:1,unit:'nm',format:v=>fx(v,1)+'nm'}),
      P('wl3','p_wl3','num', ()=>T.wl3, v=>{T.wl3=v;}, {min:190,max:1100,dec:1,unit:'nm',format:v=>fx(v,1)+'nm'}),
      P('factor','p_factor','num', ()=>T.factor, v=>{T.factor=v;}, {min:-1e6,max:1e6,dec:3,format:v=>fx(v,3)}),
      P('units','p_units','menu', ()=>T.units||'C', v=>{T.units=v;}, {opts:UNITS}),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      P('more','p_moreParams','more', ()=>'', null, {page:'more'})
    ];
    case 'stdcurve': return [
      P('name','p_testName','text', ()=>T.name),
      P('wavelength','p_wavelength','num', ()=>T.wavelength, v=>{T.wavelength=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('units','p_units','menu', ()=>T.units, v=>{T.units=v;}, {opts:UNITS}),
      P('curveFit','p_curveFit','menu', ()=>t(T.curveFit), v=>{T.curveFit=v;},
        {opts:['v_linear','v_linear0','v_segmented'], labels:o=>t(o)}),
      P('standards','p_standardConc','num', ()=>T.standards.length, null, {readonly:true}),
      P('runStd','p_measuringStd','action', ()=>'Run Standard'),
      P('positioner','p_positioner','menu',
        ()=>t((POSITIONERS.find(p=>p.id===T.positioner)||{}).label||''),
        v=>{T.positioner=v;},
        {opts:POSITIONERS.map(p=>p.id), labels:p=>t(p.label)}),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      ...cellCorrectionSpecs(T),
      P('stat','p_stats','toggle', ()=>T.stat?'On':'Off', v=>{T.stat=v==='On'; if(!T.stat) resetStats();}),
      ...outputSpecs(T)
    ];
    case 'water': return [
      P('name','p_testName','text', ()=>T.name),
      P('lambda','p_wavelength','num', ()=>T.lambda, v=>{T.lambda=v;}, {min:190,max:1100,dec:1,unit:'nm'}),
      P('positioner','p_positioner','const', ()=>t('v_manual3')),
      P('nSamples','p_nSamples','num', ()=>T.nSamples, v=>{T.nSamples=v;}, {min:1,max:99}),
      P('reverse','p_reverseColor','toggle', ()=>T.reverse?'On':'Off', v=>{T.reverse=v==='On'; if(T.reverse)T.rgntBlank=true;}),
      P('rgntBlank','p_reagentBlank','toggle', ()=>T.rgntBlank?'On':'Off', v=>{T.rgntBlank=v==='On';}),
      P('more','p_moreParams','action', ()=>'')
    ];
    case 'water2': return [
      P('A','A (intercept)','num', ()=>T.A0, v=>{T.A0=v;}, {min:-10,max:10,dec:4}),
      P('B','B (linear factor)','num', ()=>T.B, v=>{T.B=v;}, {min:-1e6,max:1e6,dec:3}),
      P('C','C (quadratic factor)','num', ()=>T.C, v=>{T.C=v;}, {min:-1e6,max:1e6,dec:4}),
      P('D','D (cubic factor)','num', ()=>T.D, v=>{T.D=v;}, {min:-1e6,max:1e6,dec:4}),
      P('units','p_units','menu', ()=>T.units, v=>{T.units=v;}, {opts:UNITS}),
      P('adj1pt','p_1ptAdjust','toggle', ()=>T.adj1pt?'On':'Off', v=>{T.adj1pt=v==='On';}),
      P('stat','p_stats','toggle', ()=>T.stat?'On':'Off', v=>{T.stat=v==='On'; if(!T.stat) resetStats();}),
      P('autoPrint','p_autoPrint','toggle', ()=>T.autoPrint?'On':'Off', v=>{T.autoPrint=v==='On';}),
      P('autoSave','p_autoSave','toggle', ()=>T.autoSave?'On':'Off', v=>{T.autoSave=v==='On';}),
      P('dataFile','p_dataFile','text', ()=>T.dataFile, v=>{T.dataFile=v;}),
      P('id','p_id','num', ()=>T.id, v=>{T.id=v;}, {min:0,max:999}),
      P('calc1pt','k_calc1pt','action', ()=>'')
    ];
    case 'pv': return [
      P('start','k_startTest','action', ()=>'')
    ];
  }
  return [];
}

/* waterfall: when a page is longer than the visible rows, the last
   visible slot becomes "More parameters..." (as in the manual) */
function withMore(spec, nextPage){
  if (spec.length <= LCD.BODY_ROWS) return spec;
  const out = spec.slice(0, LCD.BODY_ROWS-1);
  out.push(P('more','p_moreParams','more', ()=>'', null, {page:nextPage}));
  return out;
}

/* =====================================================================
   SCREENS
   ===================================================================== */
const Screens = {};

/* ---------- main menu -------------------------------------------------- */
Screens.mainmenu = {
  draw(){
    const modes = [
      ['m_atc_basic','i1'],['m_atc_adv','i2'],['m_scan','i3'],['m_multi','i4'],
      ['m_ratio','i5'],['m_diff','i6'],['m_ptnet','i7'],['m_stdcurve','i8'],
      ['m_kinetics','i9'],['m_water','i10'],['m_cellcorr','i11'],['m_pv','i12']
    ];
    LCD.header(t('mainmenu'), clockString()+'  '+dateString());
    LCD.rows(modes.map((m,i)=>({label:t(m[0]), hi:i===App.sel})), 2);
    LCD.status(t('selectMode'));
    LCD.fkeys([App.smartstart.length?t('k_smartstart'):'', '', '', '']);
  },
  key(k){
    if (k==='up')   { App.sel=(App.sel+11)%12; paint(); }
    if (k==='down') { App.sel=(App.sel+1)%12; paint(); }
    if (k==='enter'){
      const map=['atc_basic','atc_adv','scan','multi','ratio','diff','ptnet',
                 'stdcurve','kinetics','water','cellcorr','pv'];
      startMode(map[App.sel]);
    }
    if (k==='f1' && App.smartstart.length) go('smartstart');
    if (k==='test') reset('mainmenu');
  }
};

Screens.smartstart = {
  draw(){
    LCD.header('SmartStart', clockString()+'  '+dateString());
    LCD.rows(App.smartstart.map((n,i)=>({label:n, hi:i===App.sel})), 2);
    LCD.status(App.notice || t('u_selItem'));
    LCD.fkeys([t('k_loadTest'),'','','']);
  },
  key(k){
    const n = App.smartstart.length;
    if (!n) return reset('mainmenu');
    if (k==='up')   { App.sel=(App.sel+n-1)%n; paint(); }
    if (k==='down') { App.sel=(App.sel+1)%n; paint(); }
    if (k==='enter'||k==='f1') loadStored(App.smartstart[App.sel]);
    if (k==='esc') back();
  }
};

function startMode(m){
  App.mode = m;
  App.results = []; App.sampleN=1; resetStats(); App.blankRef = null; App.rgntBlank = null; App.stdA=null;
  if (m==='cellcorr'){
    App.test = newTest('pv',{pvType:'cellcorr'});
    App.cellcorrContext='direct'; App.cellcorrState=App.cellcorrState||{
      positioner:'auto6',mode:'Scan',start:400,stop:700,n:1,wavelengths:[546],measurements:{},completedAt:null
    };
    go('cellcorr'); if(typeof renderCarousel==='function') renderCarousel(); return;
  }
  if (m==='pv'){ App.test = newTest('pv'); go('pv'); return; }
  App.test = newTest(m);
  if (m==='stdcurve') seedStdCurve();
  if (m==='water'){ App.test.methodId='copper'; syncWaterMethod(); }
  App.beamCell= m==='water' ? '2' : (posCells(App.test.positioner).includes(App.beamCell)?App.beamCell:'B');
  App.paramsPage = 'main';
  go('params');
  if(typeof renderCarousel==='function') renderCarousel();
}

/* ---------- utility menu ---------------------------------------------- */
Screens.utility = {
  draw(){
    const u = App.util;
    const rows = [
      ['u_swRev','4.000d'], ['u_serial','2R01234567'], ['u_printer', t(u.printer)],
      ['u_datetime', clockString()+'  '+dateString()], ['u_standby', t(u.standby)],
      ['u_baselineExp', u.baselineExp? String(Math.floor(u.baselineExp/60))+':'+NL(u.baselineExp%60) : t('v_off')],
      ['u_beeper', u.beeper?t('v_on'):t('v_off')], ['u_language', App.lang==='en'?t('v_english'):t('v_spanish')],
      ['u_lampLife','0.87%'], ['u_screenContrast',''], ['u_printContrast',''],
      ['u_storedDir',''], ['u_usbFiles',''], ['u_calculator','']
    ];
    const N = rows.length, win = LCD.BODY_ROWS;
    const top = Math.max(0, Math.min(App.sel-win+1, N-win));
    LCD.header(t('u_utility'), clockString()+'  '+dateString());
    LCD.rows(rows.slice(top, top+win).map((r,i)=>({label:t(r[0]), value:r[1], hi:(top+i)===App.sel})), 2);
    LCD.status(t('u_selItem'));
    LCD.fkeys(['','','','']);
  },
  key(k){
    const N = 14;
    if (k==='up')   { App.sel=(App.sel+N-1)%N; paint(); }
    if (k==='down') { App.sel=(App.sel+1)%N; paint(); }
    if (k==='enter'){
      switch(App.sel){
        case 2: setMenu({title:t('u_printer'), opts:['PC','Serial','None'],
                          get:i=>['PC','Serial','None'][i],
                          onPick:v=>{App.util.printer=v; logEvent('Printer = '+v); back();}}); break;
        case 3: go('datetime'); break;
        case 4: setMenu({title:t('u_standby'),
              opts:['v_standbyOff','v_standby5','v_standby10','v_standby15','v_standby20','v_standby30','v_standby60'],
              get:i=>['v_standbyOff','v_standby5','v_standby10','v_standby15','v_standby20','v_standby30','v_standby60'][i],
              onPick:v=>{App.util.standby=v; back();}}); break;
        case 5: setEntry({label:t('u_baselineExp'), value:App.util.baselineExp, min:0, max:999,
              hint:'Entry Baseline Expiration (0 - 999)',
              onAccept:v=>{App.util.baselineExp=v; back();}}); break;
        case 6: App.util.beeper=!App.util.beeper; App.sel=6; paint(); break;
        case 7: setLanguageMenu(); break;
        case 9: contrastScreen(); break;
        case 10: setEntry({label:t('u_printContrast'), value:50, min:0, max:100,
              hint:'Entry Printout Contrast (0 - 100)', onAccept:()=>back()}); break;
        case 11: go('stored'); break;
        case 12: go('usb'); break;
        case 13: go('calculator'); break;
      }
    }
    if (k==='esc') back();
  }
};

function setLanguageMenu(){
  setMenu({title:t('u_language'), opts:['English','Español'],
    get:i=>i===0?'English':'Español',
    onPick:v=>{ setLang(v==='English'?'en':'es'); back(); }});
}

Screens.datetime = {
  draw(){
    const d = App.util.date;
    const rows = [
      [t('u_setDate'), NL(d.d)+'/'+NL(d.m)+'/'+d.y],
      [t('u_setMonth'), MON[d.m-1]],
      [t('u_setYear'), String(d.y)],
      [t('u_setTime'), clockString()],
      [t('u_setHour'), String(d.h)],
      [t('u_setMinute'), NL(d.min)],
      [t('u_setAMPM'), d.pm?'PM':'AM'],
      [t('u_timeFormat'), d.fmt24?t('v_24h'):t('v_amPM')]
    ];
    LCD.header(t('u_datetime'), clockString()+'  '+dateString());
    LCD.rows(rows.map((r,i)=>({label:r[0], value:r[1], hi:i===App.sel})), 2);
    LCD.status(t('u_selItem'));
    LCD.fkeys(['','','','']);
  },
  key(k){
    const d = App.util.date, N = 8;
    if (k==='up')   { App.sel=(App.sel+N-1)%N; paint(); }
    if (k==='down') { App.sel=(App.sel+1)%N; paint(); }
    if (k==='enter'){
      if (App.sel===1) setMenu({title:t('u_setMonth'), opts:MON, get:i=>MON[i], onPick:v=>{d.m=MON.indexOf(v)+1; back();}});
      else if (App.sel===6) { d.pm=!d.pm; back(); }
      else if (App.sel===7) { d.fmt24=!d.fmt24; back(); }
      else {
        const cfg = {0:{max:31,min:1},2:{max:2099,min:1900},4:{max:23,min:0},5:{max:59,min:0}}[App.sel];
        const cur = [d.d,d.y,d.h,d.min][ [0,2,4,5].indexOf(App.sel) ];
        setEntry({label:t(['u_setDate','u_setYear','u_setHour','u_setMinute'][ [0,2,4,5].indexOf(App.sel) ]),
          value:cur, min:cfg.min, max:cfg.max,
          hint:'Entry ('+cfg.min+' - '+cfg.max+')',
          onAccept:v=>{ if(App.sel===0)d.d=v; else if(App.sel===2)d.y=v;
                        else if(App.sel===4)d.h=v; else d.min=v; back(); }});
      }
    }
    if (k==='esc') back();
  }
};

function contrastScreen(){
  App.sel = Math.round(App.contrast*10);
  LCD.setContrast(App.contrast);
  go('contrast');
}
Screens.contrast = {
  draw(){
    LCD.header(t('u_screenContrast'), clockString()+'  '+dateString());
    const pct = String(Math.round(App.contrast*100))+'%';
    LCD.cell(0, 4, '  ' + '[' + ' '.repeat(Math.max(0, 10-pct.length)) + pct + ']');
    LCD.cell(0, 5, 'Contrast');
    LCD.status('Use ↑ or ↓ to adjust, Esc to save.');
    LCD.fkeys(['','','','']);
  },
  key(k){
    if (k==='up')   { App.sel=Math.min(10,App.sel+1); App.contrast=App.sel/10; }
    if (k==='down') { App.sel=Math.max(0,App.sel-1); App.contrast=App.sel/10; }
    LCD.setContrast(App.contrast);
    if (k==='esc') back();
    else paint();
  }
};

/* ---------- stored tests directory ------------------------------------ */
Screens.stored = {
  draw(){
    LCD.header(t('u_storedDir'), clockString()+'  '+dateString());
    const rows = App.stored.map(s=>({label:(App.smartstart.indexOf(s.name)>=0? '> ':'  ')+s.name,
                                      hi:App.sel===App.stored.indexOf(s)}));
    if (!rows.length) rows.push({label:t('e_noFiles'), hi:false});
    LCD.rows(rows.slice(0,LCD.BODY_ROWS), 2);
    LCD.status(App.notice || t('u_selItem'));
    LCD.fkeys([t('k_selectTest'), t('k_loadTest'), t('k_deleteFile'), t('k_lockUnlock')]);
  },
  key(k){
    const n = App.stored.length;
    if (k==='up')   { App.sel=(App.sel+n-1)%Math.max(1,n); paint(); }
    if (k==='down') { App.sel=(App.sel+1)%Math.max(1,n); paint(); }
    if (k==='enter'||k==='f2'){ if(n) loadStored(App.stored[App.sel].name); }
    if (k==='f1'){ if(n){
        const nm = App.stored[App.sel].name;
        const i = App.smartstart.indexOf(nm);
        if (i>=0) App.smartstart.splice(i,1); else App.smartstart.push(nm);
        logEvent('SmartStart ' + (i>=0?'removed ':'added ') + nm); persistSimulatorState(); paint(); } }
    if (k==='f3'){ if(n){
        const nm = App.stored[App.sel].name;
        if (App.locked.indexOf(nm)>=0){ logEvent(nm+' is locked'); }
        else { const ix=App.stored.findIndex(s=>s.name===nm);
               if (ix>=0) App.stored.splice(ix,1);
               App.smartstart=App.smartstart.filter(x=>x!==nm);
               App.sel=0; logEvent('Deleted '+nm); persistSimulatorState(); paint(); } } }
    if (k==='f4'){ if(n){
        const nm = App.stored[App.sel].name;
        const i = App.locked.indexOf(nm);
        setEntry({label:t('p_softwarePassword'),value:'',min:0,max:9999999,
          hint:t('e_passwordHint'),onAccept:v=>{
            if(String(v)==='4363797'){
              if(i>=0) App.locked.splice(i,1); else App.locked.push(nm);
              logEvent(nm+(i>=0?' unlocked':' locked')); App.notice=''; persistSimulatorState();
            }else{
              App.notice=t('e_wrongPassword'); logEvent('Incorrect software password');
            }
            back();
          }});
      } }
    if (k==='esc') back();
  }
};

function loadStored(name){
  const s = App.stored.find(x=>x.name===name);
  if (!s) return;
  const hasConfig=!!s.config;
  App.mode = s.mode;
  App.test = hasConfig
    ? Object.assign(newTest(s.mode,{methodId:s.methodId||s.method}),JSON.parse(JSON.stringify(s.config)))
    : newTest(s.mode,{methodId:s.methodId||s.method});
  if (s.mode==='multi'){
    if(!Array.isArray(App.test.wls)) App.test.wls=[];
    if(!['Absorbance','%Transmittance','Conc/Factor'].includes(App.test.mode)) App.test.mode='Absorbance';
  }
  if (s.methodId && !hasConfig) { App.test.methodId = s.methodId; syncWaterMethod(); }
  if (s.mode==='stdcurve' && !App.test.standards.length) seedStdCurve();
  App.test.name = name; App.test.saved = true;
  if(!posCells(App.test.positioner).includes(App.beamCell))
    App.beamCell=App.mode==='water'?'2':'B';
  App.results = []; App.sampleN=1; resetStats();
  App.stdA=null;
  App.nav = []; App.screen = 'params'; App.paramsPage='main'; App.sel=0;
  logEvent('Loaded test ' + name);
  paint();
  if(typeof renderCarousel==='function') renderCarousel();
}

Screens.usb = {
  draw(){
    LCD.header(t('u_usbFiles'), clockString()+'  '+dateString());
    LCD.rows([
      {label:'[/USB]', hi:App.sel===0},
      {label:'  '+t('e_folderThermo'), hi:App.sel===1},
      {label:'  '+t('e_folderMerck'), hi:App.sel===2},
      {label:'  '+t('e_folderChemetrics'), hi:App.sel===3}
    ], 2);
    LCD.status(t('u_selItem'));
    LCD.fkeys([t('k_loadTest'),'','','']);
  },
  key(k){
    if (k==='up')   { App.sel=(App.sel+3)%4; paint(); }
    if (k==='down') { App.sel=(App.sel+1)%4; paint(); }
    if (k==='enter'&&App.sel>0) App.sel=1;
    if (k==='f1'){
      if (App.sel===0) return;
      const m = METHODS[ (App.sel-1)*4 ];
      if (m){ App.mode='water'; App.test=newTest('water',{methodId:m.id});
              syncWaterMethod(); App.test.saved=false;
              App.nav=[]; App.screen='params'; paint(); }
    }
    if (k==='esc') back();
  }
};

/* ---------- calculator ------------------------------------------------- */
Screens.calculator = {
  draw(){
    const c = App.util.calculator || {a:'',op:'',b:'',res:''};
    LCD.header(t('e_calculator'), clockString()+'  '+dateString());
    LCD.cell(3, 4, (c.a||'0') + (c.op?' '+c.op+' ':'') + (c.b||''));
    LCD.cell(3, 6, c.res? '= ' + c.res : '');
    LCD.status('Enter values with the numeric keypad.');
    LCD.fkeys(['','','','']);
  },
  key(k){
    const c = App.util.calculator || (App.util.calculator={a:'',op:'',b:'',res:''});
    const dig = (s)=>['0','1','2','3','4','5','6','7','8','9','dot','minus'];
    if (dig(k).indexOf(k)>=0){
      const ch = k==='dot'?'.':(k==='minus'?'-':k);
      if (c.op && c.b.length<10) c.b+=ch;
      else if (!c.op) c.a+=ch;
      return paint();
    }
    if (k==='clear'){ c.a='';c.b='';c.op='';c.res=''; return paint(); }
    if ('+-x/'.indexOf(k)>=0 && k.length===1){ c.op=k; c.b=''; return paint(); }
    if (k==='enter'){
      const a=parseFloat(c.a), b=parseFloat(c.b);
      if (!isNaN(a)&&!isNaN(b)&&c.op){
        let r = c.op==='+'?a+b : c.op==='-'?a-b : c.op==='x'?a*b : (b?a/b:NaN);
        c.res = isNaN(r)? 'Error' : String(Math.round(r*1e6)/1e6);
        logEvent(c.a+' '+c.op+' '+c.b+' = '+c.res);
      }
      return paint();
    }
    if (k==='esc'){ App.util.calculator=null; back(); }
  }
};

/* ---------- alphanumeric name entry ------------------------------------ */
const NAME_CHARSETS = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  'abcdefghijklmnopqrstuvwxyz _*/()#'
];
function moveNameCursor(n, step){
  const topLength=NAME_CHARSETS[0].length;
  const total=topLength+NAME_CHARSETS[1].length;
  let index=n.row===0?n.col:topLength+n.col;
  index=(index+step+total)%total;
  if(index<topLength){n.row=0;n.col=index;}
  else{n.row=1;n.col=index-topLength;}
}

Screens.nameentry = {
  draw(){
    const n = App.nameEntry;
    const upperRow = 3, lowerRow = 5;
    const selectedRow = n.row===0 ? upperRow : lowerRow;
    const chars = NAME_CHARSETS[n.row];
    const selectedChar = chars[n.col] || ' ';

    LCD.header(n.title || t('e_createTestName'), clockString()+'  '+dateString());
    LCD.cell(0, upperRow, NAME_CHARSETS[0]);
    LCD.cell(0, lowerRow, NAME_CHARSETS[1]);

    /* Reverse video the selected character, as on the instrument display. */
    LCD.rect(n.col*LCD.CW, selectedRow*LCD.CH, LCD.CW, LCD.CH, LCD.ink());
    LCD.cell(n.col, selectedRow, selectedChar, {color:LCD.paper()});

    LCD.cell(0, 8, t('e_newName') + ' ' + n.buf);
    LCD.cell(0, 14, t('e_nameSelectChar'));
    LCD.cell(0, 15, t('e_nameAcceptInstruction').replace('{key}',t('k_acceptName')));
    LCD.fkeys([t('k_deleteName'), t('k_deleteChar'), t('k_addChar'), t('k_acceptName')]);
  },
  key(k){
    const n = App.nameEntry;
    const chars = NAME_CHARSETS[n.row];
    if (k==='up' || k==='left')  { moveNameCursor(n,-1); paint(); }
    if (k==='down' || k==='right') { moveNameCursor(n,1); paint(); }
    if (k==='f3'){
      if (n.buf.length<n.max) n.buf+=chars[n.col];
      paint();
    }
    if (k==='f1'){ n.buf=''; paint(); }
    if (k==='f2'){ if(n.buf.length) n.buf=n.buf.slice(0,-1); paint(); }
    if (k==='f4'){
      const nm = n.buf || 'Test';
      App.nameEntry = null;
      if (n.onAccept) n.onAccept(nm);
      back();
    }
    if (k==='esc'){ App.nameEntry=null; back(); }
  }
};

/* ---------- generic parameter screen ---------------------------------- */
Screens.params = {
  draw(){
    const spec = paramSpec();
    const T = App.test;
    const page = App.paramsPage || 'main';
    let list = spec;
    if (page==='more') list = withMore(paramSpecMore(), null);
    list = visibleParams(list);

    LCD.header(modeTitle(), clockString()+'  '+dateString());
    if(App.mode==='multi'||App.mode==='ratio'||App.mode==='ptnet') LCD.badge('BLANK',{rightPad:2});
    else LCD.badge(App.blankRef ? 'BLANK' : null);
    const rows=list.map((p,i)=>({label:t(p.label),
      value:p.type==='action'||p.type==='more'||p.type==='const'?'':p.format?p.format(p.get()):''+p.get(),
      hi:i===App.sel}));
    LCD.rows(rows, App.mode==='multi'||((App.mode==='ratio'||App.mode==='ptnet')&&page==='main')?3:2);
    LCD.status(App.notice || t('u_selItemChange'));
    LCD.fkeys(fkeysFor(App.mode, T));
  },
  key(k){
    const page = App.paramsPage || 'main';
    const runStandardsKey = App.mode==='ptnet' && k==='f1';
    const spec = page==='more' ? paramSpecMore() : paramSpec();
    const list = visibleParams(withMore(spec, page==='main'?'more':null));
    const N = list.length;
    if (k==='up')   { App.sel=(App.sel+N-1)%N; paint(); return; }
    if (k==='down') { App.sel=(App.sel+1)%N; paint(); return; }
    if (k==='esc'){
      if(page==='more'){App.paramsPage='main';App.sel=0;paint();return;}
      App.paramsPage='main'; App.sel=0; reset('mainmenu'); return;
    }
    if (k==='f1' && App.mode==='multi'){ doAction('setnms'); return; }
    if (k==='enter') editParam(list[App.sel], list);
    if (k==='f1' && App.mode==='water') { doAction('calc1pt'); return; }
    if (k==='f1' && App.mode==='stdcurve') { doAction('runStd'); return; }
    if (k==='f1' && App.mode==='atc_adv' && App.test.mode==='Conc/Std'){
      doAction('runAtcStandard'); return;
    }
    if (runStandardsKey) k='f4';
    if (k==='f2'){ /* Save Test */
      openName(t('e_createTestName'), App.test.name==='-------'?'':App.test.name, 8, nm=>saveTestAs(nm));
    }
    if (k==='f3'){ /* Stored Tests */
      App.nav.push('params');
      App.screen='stored'; App.sel=0; paint();
    }
    if (k==='f4'){ /* Run Test */
      if(App.mode==='stdcurve' || (App.mode==='ptnet' && !runStandardsKey)) return;
      if(App.mode==='multi' && (!Array.isArray(App.test.wls) || !App.test.wls.length)) return;
      App.sampleN=1;
      App.beamCell='B';
      if(typeof renderCarousel==='function') renderCarousel();
      if (App.mode==='water') { App.nav.push('params'); App.screen='water_run'; App.step='blank'; App.rgntBlank=null; paint(); }
      else if (App.mode==='scan'){ App.nav.push('params'); App.screen='scan_run'; App.step='baseline'; paint(); }
      else if (App.mode==='kinetics'){ App.nav.push('params'); App.screen='kin_run'; App.step='blank'; paint(); }
      else if (App.mode==='multi'){
        App.nav.push('params'); App.screen='run'; App.step='sample';
        App.blankRef={base:0.0004,seed:Math.random()*10}; App.blankAt=null;
        App.results=[]; resetStats();
        App.beamCell=posSample(App.test.positioner);
        if(typeof renderCarousel==='function') renderCarousel();
        paint();
      }
      else if (App.mode==='ratio'){
        App.nav.push('params'); App.screen='run'; App.step='sample';
        App.blankRef={base:0.0004,seed:Math.random()*10}; App.blankAt=null;
        App.results=[]; resetStats();
        App.beamCell=posSample(App.test.positioner);
        if(typeof renderCarousel==='function') renderCarousel();
        paint();
      }
      else { App.nav.push('params'); App.screen='run'; App.step='blank'; resetStats(); App.results=[]; paint(); }
    }
  }
};

function paramSpecMore(){
  switch(App.mode){
    case 'atc_adv': {
      const specs=paramSpecFor('atc_adv2');
      if(App.test.cellCorr==='On') specs.push(P('cellCorrSetup','p_setupCorrection','action',()=>t('k_setupCorrection')));
      return specs;
    }
    case 'water':   return paramSpecFor('water2');
    case 'ratio': return [
      P('factor1','p_factor','num', ()=>App.test.factor1, v=>{App.test.factor1=v;}, {min:0,max:1e6,dec:3}),
      ...cellCorrectionSpecs(App.test),
      ...outputSpecs(App.test)
    ];
    case 'ptnet': return [
      ...cellCorrectionSpecs(App.test),
      ...outputSpecs(App.test)
    ];
    default: return paramSpec().slice(LCD.BODY_ROWS-1);
  }
}
function visibleParams(spec){
  return spec.filter(p=>(p.key!=='cellCorrSetup' || App.test.cellCorr==='On') &&
    (p.key!=='refWl' || App.mode!=='ratio' || App.test.refCorr) &&
    (p.key!=='dataFile' || App.test.autoSave));
}
function saveTestAs(name){
  const nm=String(name||'').trim();
  if(!/^[A-Za-z0-9]{1,8}$/.test(nm)){
    App.notice=t('e_testNameFormat');
    logEvent('Test name must use 1-8 letters or digits');
    return;
  }
  if(App.locked.includes(nm)){
    App.notice=t('e_testLocked');
    logEvent('Cannot overwrite locked test '+nm);
    return;
  }
  App.test.name=nm;
  App.test.saved=true;
  const record={name:nm,mode:App.mode,methodId:App.test.methodId||null,
    config:JSON.parse(JSON.stringify(App.test))};
  const i=App.stored.findIndex(s=>s.name===nm);
  if(i>=0) App.stored[i]=record; else App.stored.push(record);
  App.notice='';
  persistSimulatorState();
  logEvent('Saved test '+nm);
}
function paramSpecFor(k){
  const save = App.mode; App.mode = k;
  const r = paramSpec();
  App.mode = save; return r;
}

function editParam(p, list){
  if (!p || p.set===null || p.type==='const' || p.readonly) return;
  const T = App.test;
  switch(p.type){
    case 'num':
      setEntry({label:t(p.label), value:Number(p.get())||0, min:p.min, max:p.max,
        decimals:p.dec||0, integer:p.key==='nSamples'||p.key==='id', unit:p.unit||'',
        hint:'Entry '+t(p.label).toLowerCase()+' ('+p.min+' - '+p.max+')',
        onAccept:v=>{ p.set(v); logEvent(t(p.label)+' = '+v+(p.unit||'')); back(); }});
      break;
    case 'toggle':
      setMenu({title:t(p.label), opts:['v_on','v_off'], get:i=>i===0?t('v_on'):t('v_off'),
        onPick:v=>{ p.set(v==='v_on'?'On':'Off'); back(); }});
      break;
    case 'toggle3':
    case 'menu':
      if (!p.opts) return;
      setMenu({title:t(p.label), opts:p.opts,
        get:i=> (p.labels? p.labels(p.opts[i]) : p.opts[i]),
        onPick:v=>{ if(p.key==='positioner') setPositioner(T,v); else p.set(v);
          logEvent(t(p.label)+' = '+v); back(); }});
      break;
    case 'menu':
      setMenu({title:t(p.label), opts:p.opts,
        get:i=> (p.labels? p.labels(p.opts[i]) : p.opts[i]),
        onPick:v=>{ p.set(v); logEvent(t(p.label)+' = '+v); back(); }});
      break;
    case 'text': {
      if (p.key==='name'){
        openName(t('e_createTestName'), T.name==='-------'?'':T.name, 16, nm=>{ T.name=nm; });
      } else if(p.key==='dataFile'){
        openName(t(p.label),p.get()||'Data',8,nm=>{p.set(nm);logEvent(t(p.label)+' = '+nm);});
      } else {
        setEntry({label:t(p.label), value:p.get()||'', text:true,
          onAccept:v=>{ p.set(v); logEvent(t(p.label)+' = '+v); back(); }});
      }
      break;
    }
    case 'time':
    case 'duration': {
      const pattern = p.type==='duration' ? /^\d{1,3}:[0-5]\d:[0-5]\d$/ : /^\d{1,3}:[0-5]\d$/;
      const valid = v=>{
        if (!pattern.test(v)) return false;
        if (p.key==='intervalTime'){
          const parts=v.split(':').map(Number);
          return parts[0]*60+parts[1]>0;
        }
        return true;
      };
      setEntry({label:t(p.label), value:p.get()||'', text:true,
        validate:valid, invalidMessage:p.type==='duration' ? t('e_durationFormat') : t('e_timeFormat'),
        onAccept:v=>{ p.set(v); logEvent(t(p.label)+' = '+v); back(); }});
      break;
    }
    case 'action': doAction(p.key); break;
    case 'more': App.paramsPage = p.page; App.sel = 0; paint(); break;
  }
}
function doAction(k){
  const T = App.test;
  if (k==='more'){ App.paramsPage='more'; App.sel=0; paint(); return; }
  if (k==='runAtcStandard'){
    if(['auto6','auto3'].includes(T.positioner)) App.beamCell='B';
    if(typeof renderCarousel==='function') renderCarousel();
    App.nav.push(App.screen);
    App.screen='atc_standard'; App.atcStdStep='blank'; App.stdA=null;
    setEntry({label:t('p_concStd'), value:Number(T.concStd)||0, min:0, max:1e9, dec:3,
      hint:'Entry Standard Concentration', onAccept:v=>{T.concStd=v; App.atcStdStep='blank'; back();}});
    return;
  }
  if (k==='runStd'){
    if(['auto6','auto3'].includes(T.positioner)) App.beamCell=posSample(T.positioner);
    if(App.screen==='params') App.nav.push('params');
    App.sampleN=1; App.blankRef=null; App.rgntBlank=null; App.results=[]; resetStats();
    if(typeof renderCarousel==='function') renderCarousel();
    App.screen='std_std'; paint(); return;
  }
  if (k==='setnms'){
    App.nav.push(App.screen);
    App.screen='multi_setnms';
    App.sel=Array.isArray(T.wls)?T.wls.length:0;
    paint(); return;
  }
  if (k==='calc1pt'){
    App.nav.push(App.screen);
    App.beamCell='B';
    if(typeof renderCarousel==='function') renderCarousel();
    App.screen='water_1pt'; App.oneptStep='blank';
    App.oneptMeasured=undefined; App.oneptFactor=undefined;
    App.blankRef=null; App.rgntBlank=null;
    paint(); return;
  }
  if (k==='cellCorrSetup'){
    App.nav.push(App.screen);
    App.screen='cellcorr'; App.cellcorrContext='test'; App.sel=0; paint(); return;
  }
  if (k==='start'){ /* performance verification */ App.screen='pv_run'; App.step='start'; paint(); return; }
}

Screens.atc_standard = {
  draw(){
    const T=App.test, step=App.atcStdStep||'blank';
    LCD.header(t('k_runStandard'), clockString()+'  '+dateString());
    LCD.badge('Cell #'+App.beamCell);
    if(App.busy){ LCD.cell(2,5,t('v_measuring')); LCD.fkeys(['','','','']); return; }
    LCD.rows([
      {label:t('p_concStd'),value:fx(Number(T.concStd),3)+' '+T.units},
      {label:t('p_wavelength'),value:(T.lambda||546)+'nm'},
      {label:t('r_absorbance'),value:App.stdA===null?'--':fx(App.stdA,4)}
    ],3);
    LCD.status(step==='blank'?'Measure the blank before the standard.'
      :step==='standard'?'Place the standard in the selected cell.'
      :'Standard measured. Accept to return to test parameters.');
    LCD.fkeys(step==='done'?[t('k_accept'),'','','']
      :['','','',step==='blank'?t('k_measureBlank'):t('k_measureStd')]);
  },
  key(k){
    if(App.busy) return;
    if(k==='esc'){ back(); return; }
    if(App.atcStdStep==='blank' && (k==='f4'||k==='enter')){
      App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
      busyFor(500,()=>{
        App.blankRef={base:0.0004,seed:Math.random()*10};
        if(['auto6','auto3'].includes(App.test.positioner)) App.beamCell=posSample(App.test.positioner);
        if(typeof renderCarousel==='function') renderCarousel();
        App.atcStdStep='standard'; logEvent('Advanced A-%T-C blank measured'); paint();
      });
      return;
    }
    if(App.atcStdStep==='standard' && (k==='f4'||k==='enter')){
      App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
      busyFor(500,()=>{
        const T=App.test, a=rawAt(T.lambda);
        App.stdA=T.refCorr ? a-rawAt(T.refWl) : a;
        App.atcStdStep='done';
        logEvent('Advanced A-%T-C standard measured: A='+fx(App.stdA,4)); paint();
      });
      return;
    }
    if(App.atcStdStep==='done' && k==='f1'){ back(); return; }
  }
};

function fkeysFor(mode, T){
  switch(mode){
    case 'atc_adv':
      return (T.mode==='Conc/Std') ? [t('k_runStandard'),t('k_saveTest'),t('k_storedTests'),t('k_runTest')]
                                   : ['',t('k_saveTest'),t('k_storedTests'),t('k_runTest')];
    case 'scan':   return ['', t('k_saveTest'), t('k_storedTests'), t('k_runTest')];
    case 'multi':  return [t('k_setNms'), t('k_saveTest'), t('k_storedTests'), T.wls&&T.wls.length?t('k_runTest'):''];
    case 'stdcurve': return [t('k_runStandards'), t('k_saveTest'), t('k_storedTests'), ''];
    case 'ptnet': return [t('k_runStandards'), t('k_saveTest'), t('k_storedTests'), ''];
    case 'water':  return [t('k_calc1pt'), t('k_saveTest'), t('k_storedTests'), t('k_runTest')];
    case 'pv':     return [t('k_startTest'),'','',''];
    default:       return ['', t('k_saveTest'), t('k_storedTests'), t('k_runTest')];
  }
}

function modeTitle(){
  const map = { atc_basic:'m_atc_basic', atc_adv:'m_atc_adv', scan:'m_scan',
    multi:'m_multi', ratio:'m_ratio', diff:'m_diff', ptnet:'m_ptnet',
    stdcurve:'m_stdcurve', kinetics:'m_kinetics', water:'m_water' };
  const base = t(map[App.mode]||'');
  return (App.paramsPage==='more') ? t('p_moreParams') : base;
}
function samplePrompt(){
  return t('e_insertSample').replace('1',String(App.beamCell));
}

/* ---------- entry + menu popups --------------------------------------- */
Screens.entry = {
  draw(){
    /* draw the screen we came from, then overlay the Entry window */
    const parent = Screens[App.nav[App.nav.length-1]];
    if (parent && parent.draw){ try{ parent.draw(); }catch(e){} }
    else LCD.header('','');
    const e = App.entry || {label:'',buffer:'',hint:''};
    const lines = [String(e.buffer)];
    if (e.label) lines.unshift('');
    LCD.popup('Entry', [e.label? 'Enter '+e.label : '', String(e.buffer), e.error || e.hint]);
    LCD.fkeys(['','','','']);
  },
  key(k){
    const e = App.entry;
    if (k==='esc'){ App.entry=null; back(); return; }
    if (k==='clear'){ e.buffer=''; e.pristine=false; e.error=''; paint(); return; }
    if (k==='enter'){ commitEntry(); return; }
    if (/^[0-9]$/.test(k)){
      e.buffer=((e.pristine?'':e.buffer)+k).slice(-12); e.pristine=false; e.error=''; paint(); return;
    }
    if (k==='dot'){
      if(e.pristine){e.buffer='0.';e.pristine=false;}
      else if(e.buffer.indexOf('.')<0) e.buffer+='.';
      e.error=''; paint(); return;
    }
    if (k==='colon' && e.text){ e.buffer+=':'; e.error=''; paint(); return; }
    if (k==='minus'){
      if(e.pristine){e.buffer='-';e.pristine=false;}
      else e.buffer = e.buffer.charAt(0)==='-'? e.buffer.slice(1) : '-'+e.buffer;
      e.error=''; paint(); return;
    }
    if (k==='up'||k==='down') return;
  }
};
function drawParent(){ /* superseded by Screens.entry.draw */ }

Screens.menu = {
  draw(){
    const m = App.menu || {title:'',opts:[],sel:0,get:i=>''};
    const n = m.opts.length;
    const win = LCD.BODY_ROWS-3;
    const start = Math.max(0, Math.min(m.sel-win+1, n-win));
    LCD.header(m.title, clockString()+'  '+dateString());
    const rows = m.opts.slice(start, start+win).map((o,i)=>({
      label:(o===null?'':'')+m.get(start+i),
      hi:(start+i)===m.sel
    }));
    LCD.rows(rows, 3);
    LCD.status(t('u_selItem'));
    LCD.fkeys(['','','','']);
  },
  key(k){
    const m = App.menu; if(!m) return;
    const n = m.opts.length;
    if (k==='up')   { m.sel=(m.sel+n-1)%n; App.sel=m.sel; paint(); return; }
    if (k==='down') { m.sel=(m.sel+1)%n; App.sel=m.sel; paint(); return; }
    if (k==='enter'){ pickMenu(m.sel); return; }
    if (k==='esc'){ App.menu=null; back(); }
  }
};

/* ---------- measurement flow (A-%T-C, ratio, diff, ptnet, multi) ------- */
function drawMultiRunScreen(T){
  LCD.header(modeTitle(), clockString()+'  '+dateString());
  LCD.badge('BLANK');
  LCD.cell(0,1,t('p_testName')+': '+(T.name||'-------'));
  LCD.cell(0,2,'ID#: '+(T.id||0));
  LCD.cell(3,5,'nm');
  LCD.cell(15,4,t('r_result'));
  LCD.cell(17,5,T.mode==='%Transmittance'?'%T':T.mode==='Conc/Factor'?(T.units||'mg/L'):'Abs');
  LCD.cell(2,6,'------');
  LCD.cell(13,6,'-----------');

  const x=54, y=130, w=212, h=70;
  LCD.rect(x+2,y+2,w-4,h-4,LCD.paper());
  LCD.frame(x,y,w,h,LCD.ink());
  LCD.frame(x+3,y+3,w-6,h-6,LCD.ink());
  const sample=t('e_multiPromptSample').replace('{n}',String(App.sampleN||1));
  const position=t('e_multiPromptPosition').replace('{cell}',String(App.beamCell));
  const prompt=App.busy?t('v_reading'):t('e_multiPromptEnter');
  LCD.text(LCD.W/2,y+10,sample,{align:'center',size:12});
  LCD.text(LCD.W/2,y+24,position,{align:'center',size:12});
  LCD.text(LCD.W/2,y+48,prompt,{align:'center',size:12});
  LCD.fkeys(['','','','']);
}

function ratioSampleCells(T){
  const available=posCells(T.positioner).filter(c=>c!=='B');
  const count=Math.max(1,Math.floor(Number(T.nSamples)||1));
  if(!available.length) return [posSample(T.positioner)];
  return available.slice(0,Math.min(count,available.length));
}
function ratioCellRange(cells){
  if(cells.length>1 && cells.every((c,i)=>String(c)===String(i+1))) return '1 - '+cells.length;
  return cells.join(', ');
}
function drawRatioRunScreen(T){
  LCD.header(modeTitle(), clockString()+'  '+dateString());
  LCD.cell(0,1,t('p_testName')+': '+(T.name||'-------'));
  LCD.badge('BLANK',{rightPad:2});

  const col={id:0,wl1:7,wl2:17,ref:27,result:37};
  LCD.cell(8,3,'Abs');
  LCD.cell(18,3,'Abs');
  LCD.cell(28,3,'Abs');
  LCD.cell(col.id,4,'ID#');
  LCD.cell(col.wl1,4,fx(T.wl1,1));
  LCD.cell(col.wl2,4,fx(T.wl2,1));
  LCD.cell(col.ref,4,'Ref.WL');
  LCD.cell(col.result,4,'Result');

  const samples=ratioSampleCells(T);
  if(App.results.length){
    App.results.slice(0,samples.length).forEach((r,i)=>{
      const row=5+i;
      LCD.cell(col.id,row,String(r.id||i+1));
      LCD.cell(col.wl1,row,fx(r.abs1,3));
      LCD.cell(col.wl2,row,fx(r.abs2,3));
      LCD.cell(col.ref,row,fx(r.absRef,3));
      LCD.cell(col.result,row,r.text);
    });
  }else{
    [col.id,col.wl1,col.wl2,col.ref,col.result].forEach(x=>LCD.cell(x,5,'---'));
  }

  const complete=App.results.length>=samples.length;
  if(App.busy || !complete){
    const x=54,y=130,w=212,h=70;
    LCD.rect(x+2,y+2,w-4,h-4,LCD.paper());
    LCD.frame(x,y,w,h,LCD.ink());
    LCD.frame(x+3,y+3,w-6,h-6,LCD.ink());
    if(App.busy){
      LCD.text(LCD.W/2,y+25,t('e_ratioMeasuring'),{align:'center',size:12});
      LCD.rect(x+20,y+49,w-40,8,LCD.ink());
      LCD.rect(x+22,y+51,Math.round((w-44)*(App.progress||0)),4,LCD.paper());
    }else{
      const range=ratioCellRange(samples);
      const sampleLine=samples.length>1
        ? t('e_ratioPromptManySamples').replace('{range}',range)
        : t('e_multiPromptSample').replace('{n}',range);
      const positionLine=samples.length>1
        ? t('e_ratioPromptManyPositions').replace('{range}',range)
        : t('e_multiPromptPosition').replace('{cell}',range);
      LCD.text(LCD.W/2,y+10,sampleLine,{align:'center',size:12});
      LCD.text(LCD.W/2,y+24,positionLine,{align:'center',size:12});
      LCD.text(LCD.W/2,y+48,t('e_multiPromptEnter'),{align:'center',size:12});
    }
  }
  LCD.status(complete?t('e_testComplete'):' ');
  LCD.fkeys(['','','','']);
}

Screens.run = {
  draw(){
    const T = App.test;
    if(App.mode==='multi') return drawMultiRunScreen(T);
    if(App.mode==='ratio') return drawRatioRunScreen(T);
    LCD.header(modeTitle(), clockString()+'  '+dateString());
    LCD.badge(App.beamCell);
    if (App.busy){
      LCD.cell(2, 5, t('v_reading'));
      LCD.rect(2*CW, 7*CH, 30*CW, CH, LCD.ink());
      LCD.rect(2*CW+2, 7*CH+2, Math.round(28*CW*(App.progress||0.3)), CH-4, LCD.paper());
      LCD.fkeys(['','','','']);
      return;
    }
    const step = App.step || 'blank';
    if (step==='blank'){
      LCD.rows([
        {label:t('p_testName'), value:T.name==='-------'?'':T.name},
        {label:t('r_wavelength'), value:(T.lambda||T.wavelength||'--')+'nm'},
        {label:t('r_cell'), value:App.beamCell}
      ], 3);
      LCD.cell(2, 8, t('e_lidOpen'));
      LCD.cell(2, 9, t('e_insertBlank'));
      LCD.cell(2,10, t('e_lidClose'));
      LCD.status('Blank not measured.');
      LCD.fkeys(['','','',t('k_measureBlank')]);
    } else {
      LCD.cell(2, 5, t('e_lidOpen'));
      LCD.cell(2, 6, samplePrompt());
      LCD.cell(2, 7, t('e_lidClose'));
      LCD.cell(2, 9, 'Sample ' + App.sampleN + ' of ' + T.nSamples);
      LCD.status('Press Measure Sample when ready.');
      LCD.fkeys(['','','',t('k_measureSample')]);
    }
  },
  key(k){
    if(App.mode==='ratio'){
      if(App.busy) return;
      if(k==='esc'){ back(); return; }
      if(k==='enter') doRatioRun();
      return;
    }
    if (App.busy) return;
    if ((App.step||'blank')==='blank'){
      if (k==='f4'||k==='enter') doBlank();
      if (k==='esc') back();
    } else {
      if (k==='f4'||k==='enter') doSample();
      if (k==='esc') back();
    }
  }
};

function doRatioRun(){
  if(App.busy) return;
  const T=App.test, cells=ratioSampleCells(App.test);
  if(App.results.length>=cells.length) return;
  App.progress=0;
  App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.16);paint();},100);
  busyFor(650,()=>{
    clearInterval(App.interval); App.interval=null;
    App.results=[];
    cells.forEach((cell,i)=>{
      App.beamCell=cell;
      const result=computeRatio();
      result.id=i+1; result.cell=cell;
      App.results.push(result);
      pushStat(result.ratio);
      if(T.autoSave) saveResultData();
      if(T.autoPrint) printResult();
      logEvent('Ratio sample '+(i+1)+' measured: '+result.text);
    });
    App.sampleN=cells.length+1;
    App.beamCell=cells[cells.length-1]||App.beamCell;
    App.step='complete';
    if(typeof renderCarousel==='function') renderCarousel();
    paint();
  });
}

function doBlank(){
  App.busy = true; App.progress = 0;
  App.interval = setInterval(()=>{ App.progress=Math.min(1,(App.progress||0)+0.2); paint(); },90);
  busyFor(650, ()=>{ clearInterval(App.interval); App.interval=null;
    App.blankRef = { base: 0.0004, seed: Math.random()*10 };
    App.blankAt = null;
    logEvent('Blank measured at cell B');
    App.step = 'sample';
    if(App.mode!=='water' && ['auto6','auto3'].includes(App.test.positioner))
      App.beamCell=posSample(App.test.positioner);
    if(typeof renderCarousel==='function') renderCarousel();
    if (App.mode==='water' && App.test.rgntBlank) App.step = 'rgnt';
    App.results = []; resetStats();
    paint();
  });
}
function doRgntBlank(){
  App.busy = true; App.progress = 0;
  App.interval = setInterval(()=>{ App.progress=Math.min(1,(App.progress||0)+0.2); paint(); },90);
  busyFor(650, ()=>{ clearInterval(App.interval); App.interval=null;
    App.rgntBlank = {cell:App.beamCell, absorbance:cellAbs(App.beamCell, App.test.lambda)};
    logEvent('Reagent blank measured');
    App.step = 'sample';
    paint();
  });
}

function rawAt(nm){ return measureAbs(App.beamCell, nm); }

function computeATC(){
  const T = App.test;
  const out = { A:0, T:100, conc:null, text:'', unit:'' };
  let A;
  if (T.refCorr) A = rawAt(T.lambda) - rawAt(T.refWl);
  else A = rawAt(T.lambda);
  A += jitter(0.0008);
  out.A = A; out.T = toT(A);
  if (T.mode==='Conc/Std'){
    const cs = parseFloat(T.concStd);
    const std = parseFloat(App.stdA);
    if (!isNaN(cs) && std>0) out.conc = cs*A/std;
  } else if (T.mode==='Conc/Factor'){
    const f = parseFloat(T.factor);
    if (!isNaN(f)) out.conc = A*f;
  }
  out.unit = (out.conc!==null)? T.units : '';
  out.text = out.conc!==null ? fx(out.conc,3)+' '+(out.conc!==null?T.units:'')
             : T.mode==='%Transmittance' ? fx(out.T,2)+' %T' : fx(out.A,3)+' A';
  return out;
}

function doSample(){
  App.busy = true; App.progress = 0;
  App.interval = setInterval(()=>{ App.progress=Math.min(1,(App.progress||0)+0.18); paint(); },80);
  busyFor(620, ()=>{
    clearInterval(App.interval); App.interval=null;
    const T = App.test;
    let res;
    switch(App.mode){
      case 'multi':   res = computeMulti(); break;
      case 'ratio':   res = computeRatio(); break;
      case 'diff':    res = computeDiff(); break;
      case 'ptnet':   res = computePtNet(); break;
      case 'water':   res = computeWater(); break;
      default:        res = computeATC();
    }
    App.results.push(res);
    if (T.autoSave) { saveResultData(); logEvent('Measurement data auto-saved'); }
    pushStat(res.A);
    App.sampleN = (App.sampleN||1)+1;
    logEvent('Sample measured → ' + res.text);
    if (T.autoPrint) printResult();
    App.screen = 'results'; App.sel = 0;
    paint();
  });
}

function computeMulti(){
  const T = App.test;
  const measurements=(T.wls||[]).map(w=>{
    const A=measureAbs(App.beamCell,w.l);
    const value=T.mode==='%Transmittance' ? toT(A)
      : T.mode==='Conc/Factor' ? A*Number(w.f||0) : A;
    const suffix=T.mode==='%Transmittance'?' %T':T.mode==='Conc/Factor'?' '+(T.units||'mg/L'):' A';
    return {A, value, row:{k:fx(w.l,1)+'nm',v:fx(value,T.mode==='%Transmittance'?2:4)+suffix}};
  });
  const A=measurements.length?measurements.reduce((sum,m)=>sum+m.A,0)/measurements.length:0;
  const resultValues=measurements.map(m=>m.value);
  const resultValue=resultValues.length?resultValues.reduce((sum,value)=>sum+value,0)/resultValues.length:0;
  const r={A,T:toT(A),conc:T.mode==='Conc/Factor'?resultValue:null,unit:T.mode==='Conc/Factor'?T.units:'',
    text:fx(resultValue,T.mode==='%Transmittance'?2:4)+(T.mode==='%Transmittance'?' %T':T.mode==='Conc/Factor'?' '+(T.units||'mg/L'):' A'),
    rows:measurements.map(m=>m.row)};
  return r;
}
function computeRatio(){
  const T = App.test;
  const abs1=measureAbs(App.beamCell,T.wl1);
  const abs2=measureAbs(App.beamCell,T.wl2);
  const absRef=measureAbs(App.beamCell,T.refWl);
  const ref = T.refCorr ? absRef : 0;
  const a1 = abs1-ref;
  const a2 = abs2-ref;
  const denominator = Math.abs(a2)<1e-6 ? (a2<0?-1e-6:1e-6) : a2;
  const val = a1/denominator;
  const r = {A:a1, abs1, abs2, absRef, ratio:val, text:fx(val,4), rows:[
    {k:t('p_wl1'), v:T.wl1+'nm', a:a1},
    {k:t('p_wl2'), v:T.wl2+'nm', a:a2},
    {k:t('r_ratio'), v:fx(val,4), a:a1}
  ]};
  return r;
}
function computeDiff(){
  const T = App.test;
  const ref = T.refCorr ? measureAbs(App.beamCell,T.refWl) : 0;
  const a1 = measureAbs(App.beamCell,T.wl1)-ref;
  const a2 = measureAbs(App.beamCell,T.wl2)-ref;
  const val = a1*T.factor1 - a2*T.factor2;
  const r = {A:a1, text:fx(val,4), rows:[
    {k:t('p_wl1')+' x F1', v:T.wl1+'nm', a:fx(a1*T.factor1,4)},
    {k:t('p_wl2')+' x F2', v:T.wl2+'nm', a:fx(-a2*T.factor2,4)},
    {k:t('r_difference'), v:'', a:fx(val,4)}
  ]};
  return r;
}
function computePtNet(){
  const T = App.test;
  const l1=T.wl1,l2=T.wl2,l3=T.wl3;
  const ref = T.refCorr ? measureAbs(App.beamCell,T.refWl) : 0;
  const a1=measureAbs(App.beamCell,l1)-ref, a2=measureAbs(App.beamCell,l2)-ref,
        a3=measureAbs(App.beamCell,l3)-ref;
  /* manual §25:  A3 − ( A1 + ((A2−A1)×(λ3−λ1))/(λ3−λ2) ) */
  const base = a3 + ((a1-a2)*(l3-l2))/((l3-l1)||1);
  const peak = a2 - base;
  const net = peak * T.factor;
  const r = {A:a3, text:fx(net,4), rows:[
    {k:'A('+l1+'nm)', v:'', a:fx(a1,4)},
    {k:'A('+l2+'nm)', v:'', a:fx(a2,4)},
    {k:'A('+l3+'nm)', v:'', a:fx(a3,4)},
    {k:t('p_factor'), v:fx(T.factor,3), a:''},
    {k:t('r_ptnet'), v:'', a:fx(net,4)}
  ]};
  return r;
}
function computeWater(){
  const T = App.test;
  const A = measureAbs(App.beamCell, T.lambda);
  const val = waterEquation(T,A);
  if (T.adj1pt) val *= T.adjFactor;
  const r = {A, text:fx(val,3)+' '+T.units, rows:[
    {k:t('r_absorbance'), v:T.lambda+'nm', a:fx(A,4)},
    {k:'B', v:'', a:String(T.B)},
    {k:t('r_result'), v:'', a:fx(val,3)+' '+T.units}
  ]};
  return r;
}
function waterEquation(T,x){
  return (Number(T.A0)||0) + (Number(T.B)||0)*x +
    (Number(T.C)||0)*x*x + (Number(T.D)||0)*x*x*x;
}
function syncWaterMethod(){
  const T = App.test, m = METHOD_BY_ID[T.methodId];
  if (!m) return;
  T.lambda = m.lambda; T.B = m.B; T.units = m.unit;
  T.reverse = m.reverse; T.rgntBlank = !!m.rgntBlank;
}

function advanceAutomaticSampleCell(){
  const T=App.test;
  if(!['auto6','auto3'].includes(T.positioner)) return true;
  const cells=posCells(T.positioner).filter(c=>c!=='B');
  const next=cells[(Number(App.sampleN)||1)-1];
  if(!next) return false;
  App.beamCell=next;
  return true;
}

/* ---------- results ---------------------------------------------------- */
Screens.results = {
  draw(){
    const r = App.results[App.results.length-1];
    if (!r) return back();
    const T = App.test;
    LCD.header(modeTitle(), clockString()+'  '+dateString());
    LCD.badge('Cell #'+App.beamCell);
    let row = 2;
    if (r.rows){
      r.rows.forEach(x=>{ LCD.rows([{label:x.k, value:x.v||'', hi:false}], row); row++; });
      if (r.rows.length){ LCD.rows([{label:'',value:''}], row); row++; }
    }
    const flags = [];
    if (T && T.stat && App.stats.n>1){
      flags.push([t('r_avg'), fx(statAvg(),3)]);
      flags.push([t('r_stddev'), fx(statSD(),4)]);
    }
    if (T && T.low>0 && parseFloat(r.text)<T.low) flags.push([t('r_low'),'']);
    if (T && T.high>0 && parseFloat(r.text)>T.high) flags.push([t('r_high'),'']);
    const valRow = Math.min(row, LCD.BODY_ROWS-2);
    LCD.rows([{label:t('r_result'), value:r.text, hi:true}], valRow);
    const complete=(Number(App.sampleN)||1)>Number(T.nSamples||1);
    LCD.status(complete?t('e_testComplete'):' ');
    LCD.fkeys([t('k_changeMode'), t('k_saveData'), '', complete?'':t('k_measureSample')]);
  },
  key(k){
    if (k==='f4'){
      const T=App.test;
      if((Number(App.sampleN)||1)>Number(T.nSamples||1)) return;
      if(!advanceAutomaticSampleCell()){
        logEvent('No sample position remains in the selected holder'); return;
      }
      if(App.mode==='water' && T.rgntBlank){App.screen='water_run';App.step='rgnt';}
      else App.screen=App.mode==='stdcurve'?'std_sample':'run';
      if(App.screen!=='water_run') App.step='sample'; paint();
    }
    if (k==='esc'){ App.sel=0; back(); }
    if (k==='f1'){
      const T = App.test;
      if (!T) return;
      const cyc = T.mode==='Absorbance'?'%Transmittance':T.mode==='%Transmittance'?'Absorbance':T.mode;
      if (cyc!==T.mode){ T.mode=cyc; back(); }
    }
    if (k==='print'){ printResult(); }
    if (k==='f2'){
      const record=saveResultData();
      if(record) logEvent('Saved result data for '+record.test);
    }
  }
};

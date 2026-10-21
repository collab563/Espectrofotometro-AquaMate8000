/* =====================================================================
   screens2.js — scanning, kinetics, standard curve, multiwavelength,
   water analysis, performance verification, cell correction
   ===================================================================== */

/* ---------- SCAN ------------------------------------------------------- */
function scanRange(){
  const T = App.test;
  const a = Math.min(T.start,T.stop), b = Math.max(T.start,T.stop);
  const step = Math.max(0.1, T.interval||1);
  const pts = [];
  const n = Math.floor((b-a)/step)+1;
  for (let i=0;i<n;i++){ const nm = a + i*step; pts.push({nm, A: measureAbs(App.beamCell, nm)}); }
  return pts;
}
function scanGraphData(){ return App.results.filter(r=>r.pts).slice(-1)[0]; }
function printScanData(d){
  if(!d) return;
  printLine(''); printLine('Scan  '+T_str(App.test.name));
  printLine('Wavelength(nm)  Absorbance');
  d.pts.forEach(p=>printLine(fx(p.nm,1).padStart(13)+'  '+fx(p.A,4)));
  App.outTab='print'; renderOut();
}

Screens.scan_run = {
  draw(){
    const T = App.test;
    LCD.header(t('m_scan'), clockString()+'  '+dateString());
    LCD.badge(App.step==='sample' ? 'Cell #'+App.beamCell : 'BLANK');
    if (App.busy){
      LCD.cell(2, 4, T.start+' → '+T.stop+'nm');
      LCD.cell(2, 6, 'Sample Position: ' + App.beamCell);
      LCD.cell(2, 8, Math.round((App.progress||0)*100)+'%  ' + (App.progress*  (T.stop-T.start)).toFixed(0) + 'nm');
      LCD.rect(2*CW, 10*CH, 34*CW, CH, LCD.ink());
      LCD.rect(2*CW+2, 10*CH+2, Math.round(32*CW*(App.progress||0)), CH-4, LCD.paper());
      LCD.fkeys(['','','','']);
      return;
    }
    if (App.step==='baseline'){
      LCD.rows([
        {label:t('p_startWl'), value:T.start+'.0nm'},
        {label:t('p_stopWl'),  value:T.stop+'.0nm'},
        {label:t('p_scanSpeed'), value:t(T.scanSpeed)},
        {label:t('p_interval'), value:T.interval.toFixed(1)+'nm'}
      ], 3);
      LCD.cell(2, 9, t('e_insertBlank'));
      LCD.status('Press Collect Baseline to start.');
      LCD.fkeys([t('k_collectBaseline'),'','','']);
    } else {
      LCD.rows([
        {label:t('p_testName'), value:T.name==='-------'?'':T.name},
        {label:t('p_startWl'), value:T.start+'.0nm'},
        {label:t('p_stopWl'),  value:T.stop+'.0nm'}
      ], 3);
      LCD.cell(2, 8, samplePrompt());
      LCD.status('Press Measure Sample to start the scan.');
      LCD.fkeys([t('k_collectBaseline'),'','',t('k_measureSample')]);
    }
  },
  key(k){
    if (App.busy) return;
    if (k==='esc'){ back(); return; }
    if (App.step==='baseline'){
      if (k==='f1') runScan(true);
    } else {
      if (k==='f1') runScan(true);
      if (k==='f4'||k==='enter') runScan(false);
    }
  }
};
function runScan(isBaseline){
  const T = App.test;
  App.busy = true; App.progress = 0;
  App.interval = setInterval(()=>{ App.progress=Math.min(1,(App.progress||0)+0.06); paint(); },55);
  busyFor(1500, ()=>{ clearInterval(App.interval); App.interval=null;
    if (isBaseline){
      App.blankRef = App.blankRef || {base:0.0004, seed:Math.random()*10};
      App.step='sample';
      if(['auto6','auto3'].includes(T.positioner)) App.beamCell=posSample(T.positioner);
      if(typeof renderCarousel==='function') renderCarousel();
      logEvent('Baseline collected');
    } else {
      const pts = scanRange();
      const result={pts, text:'', wavelength:T.start, absorb:0};
      App.results.push(result);
      if(T.autoSave) saveResultData();
      if(T.autoPrint) printScanData(result);
      logEvent('Scan collected '+pts.length+' points');
      App.screen='scan_graph';
    }
    paint();
  });
}

Screens.scan_graph = {
  draw(){
    const T = App.test;
    const d = scanGraphData();
    LCD.header(t('m_scan'), clockString()+'  '+dateString());
    LCD.badge(App.blankRef?'BLANK':'Cell #'+App.beamCell);
    if (!d){ LCD.cell(2,5,'No scan data'); return LCD.fkeys(['','','','']); }
    const pts = App.editGraph ? d.pts.slice(0, App.editCursor+1) : d.pts;
    const xs = d.pts.map(p=>p.nm), ys = d.pts.map(p=>p.A);
    LCD.graph({
      x0:Math.min.apply(null,xs), x1:Math.max.apply(null,xs),
      y0:Math.min(0, Math.min.apply(null,ys)-0.02),
      y1:Math.max.apply(null,ys)*1.05+0.01,
      xlabel:t('g_wavelength'), ylabel:'A',
      points:pts, cursor: App.editGraph? App.editCursor : null
    });
    const p = d.pts[App.editCursor||0];
    LCD.cell(0,12, 'ID#: '+T.id);
    LCD.cell(13,12, t('g_wavelength')+'  '+fx(p.nm,1));
    LCD.cell(13,13, 'Abs    '+fx(p.A,3));
    LCD.status(App.editGraph ? 'Set the X range of the region of interest.' : ' ');
    if (App.editGraph) LCD.fkeys([t('k_setMinX'), t('k_cursorL'), t('k_cursorR'), t('k_setMaxX')]);
    else LCD.fkeys([t('k_collectBaseline'), t('k_tabular'), t('k_editGraph'), t('k_measureSample')]);
  },
  key(k){
    const d = scanGraphData();
    if (!d) return back();
    if (App.editGraph){
      if (k==='f2'||k==='up')   { App.editCursor=Math.max(0,(App.editCursor||0)-1); paint(); }
      if (k==='f3'||k==='down') { App.editCursor=Math.min(d.pts.length-1,(App.editCursor||0)+1); paint(); }
      if (k==='f1'){ App.editMinX=d.pts[App.editCursor||0].nm; logEvent('Min X = '+App.editMinX); paint(); }
      if (k==='f4'){ App.editMaxX=d.pts[App.editCursor||0].nm; App.editGraph=false;
                    logEvent('Max X = '+App.editMaxX); paint(); }
      if (k==='esc'){ App.editGraph=false; paint(); }
      return;
    }
    if (k==='f1'){ App.screen='scan_run'; App.step='baseline'; App.busy=false; paint(); }
    if (k==='f2'){ App.screen='scan_table'; App.sel=0; paint(); }
    if (k==='f3'){ App.editGraph=true; App.editCursor=0; paint(); }
    if (k==='f4'){ App.screen='scan_run'; App.step='sample'; paint(); }
    if (k==='print') printScanData(d);
    if (k==='esc') back();
  }
};

Screens.scan_table = {
  draw(){
    const d = scanGraphData();
    LCD.header(t('k_tabular'), clockString()+'  '+dateString());
    const win = LCD.BODY_ROWS-1;
    const start = Math.max(0, Math.min(App.sel-win+1, d.pts.length-win));
    LCD.table([{label:'Wavelength',w:12},{label:'Absorbance',w:12}],
      d.pts.slice(start,start+win).map((p,i)=>[fx(p.nm,1), fx(p.A,4)]), 2);
    LCD.status(' ');
    LCD.fkeys([t('g_wavelength'),'','',t('k_runTest')]);
  },
  key(k){
    const d = scanGraphData();
    if (k==='up')   { App.sel=Math.max(0,App.sel-1); paint(); }
    if (k==='down') { App.sel=Math.min(d.pts.length-1,App.sel+1); paint(); }
    if (k==='esc'){ App.screen='scan_graph'; paint(); }
    if (k==='f4'){ App.screen='scan_run'; App.step='sample'; paint(); }
  }
};

/* ---------- KINETICS --------------------------------------------------- */
function kinRunPoints(){
  const T = App.test;
  const [ih,im] = T.intervalTime.split(':').map(Number);
  const [th,tm,ts] = T.totalRun.split(':').map(Number);
  const dur = th*3600 + tm*60 + (ts||0);
  const iv  = (ih||0)*60 + (im||0);
  const [dh,dm] = (T.delay||'0:00').split(':').map(Number);
  let delay = (dh||0)*60 + (dm||0);
  const safeInterval = Math.max(1,iv);
  delay = Math.min(delay, Math.max(0,dur-safeInterval));
  const n = Math.min(400, Math.max(2, Math.floor(Math.max(0,dur-delay)/safeInterval)+1));
  const a0 = Math.max(0.02, measureAbs(App.beamCell, T.wavelength));
  const rate = 0.05 * (0.6 + Math.random()*0.8);
  const pts = [];
  for (let i=0;i<n;i++){
    const t = delay+i*safeInterval;
    const bend = t > dur*0.55 ? 0.65 : 1;         /* the usual saturation tail */
    pts.push({ t, A: a0 + rate*t*bend + jitter(0.0015) });
  }
  return pts;
}
function kinData(){ return App.results.filter(r=>r.pts).slice(-1)[0]; }

Screens.kin_run = {
  draw(){
    const T = App.test;
    LCD.header(t('m_kinetics'), clockString()+'  '+dateString());
    LCD.badge(App.step==='blank'?'BLANK':'Cell #'+App.beamCell);
    if (App.busy){
      const el = App.kinElapsed||0, tot = T.totalRun.split(':');
      const secs = (Number(tot[0])*3600+Number(tot[1])*60+Number(tot[2]||0));
      LCD.cell(2, 4, T.wavelength+'nm  '+t('v_measuring'));
      LCD.cell(2, 6, 'Elapsed '+fmtSecs(el)+'  of  '+T.totalRun);
      LCD.rect(2*CW, 8*CH, 34*CW, CH, LCD.ink());
      LCD.rect(2*CW+2, 8*CH+2, Math.round(32*CW*Math.min(1,el/(secs||1))), CH-4, LCD.paper());
      LCD.fkeys(['','','','']);
      return;
    }
    LCD.rows([
      {label:t('p_wavelength'), value:T.wavelength+'nm'},
      {label:t('p_intervalTime'), value:T.intervalTime},
      {label:t('p_totalRun'), value:T.totalRun}
    ], 3);
    if (App.step==='blank'){
      LCD.cell(2, 8, t('e_insertBlank'));
      LCD.status('Press Measure Blank when the compartment is closed.');
      LCD.fkeys(['','','',t('k_measureBlank')]);
    } else {
      LCD.cell(2, 8, samplePrompt());
      LCD.status('Press Measure Sample to start the kinetics run.');
      LCD.fkeys(['','','',t('k_measureSample')]);
    }
  },
  key(k){
    if (App.busy) return;
    if (k==='esc') return back();
    if (App.step==='blank'){ if (k==='f4'||k==='enter') doBlank(); }
    else { if (k==='f4'||k==='enter') runKinetics(); }
  }
};
function fmtSecs(s){
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), q=Math.floor(s%60);
  return (h?h+':':'')+m+':'+String(q).padStart(2,'0');
}
function runKinetics(){
  const T = App.test;
  const pts = kinRunPoints();
  App.busy = true; App.progress = 0; App.kinElapsed = 0;
  const last = pts[pts.length-1].t;
  App.interval = setInterval(()=>{
    App.progress = Math.min(1,(App.progress||0)+0.02);
    App.kinElapsed = Math.round(last*App.progress);
    paint();
  }, 40);
  busyFor(2200, ()=>{ clearInterval(App.interval); App.interval=null;
    const fit = linReg(pts.map(p=>({x:p.t,y:p.A})));
    const ratePerMin = fit.slope*60;
    const T2 = App.test;
    const result = T2.dispResult ? ratePerMin*(parseFloat(T2.factor)||1) : null;
    App.results.push({pts, rate:ratePerMin, fit, text: fx(ratePerMin,3)+' '+t('r_absMin'),
                      result});
    if(T2.autoSave) saveResultData();
    if(T2.autoPrint) printResult();
    logEvent('Kinetics run complete, rate = '+fx(ratePerMin,3)+' A/min');
    App.screen='kin_graph';
    paint();
  });
}

Screens.kin_graph = {
  draw(){
    const T = App.test;
    const d = kinData();
    LCD.header(t('m_kinetics'), clockString()+'  '+dateString());
    LCD.badge('Cell #'+App.beamCell);
    if (!d){ LCD.cell(2,5,'No kinetics data'); return LCD.fkeys(['','','','']); }
    const xs=d.pts.map(p=>p.t), ys=d.pts.map(p=>p.A);
    LCD.graph({ x0:0, x1:Math.max(1,Math.max.apply(null,xs)),
      y0:Math.min.apply(null,ys)-0.01, y1:Math.max.apply(null,ys)+0.02,
      xlabel:t('g_time'), ylabel:'A', points:d.pts,
      cursor: App.kinCursor!==undefined? d.pts[App.kinCursor].t : null });
    const i = App.kinCursor!==undefined? App.kinCursor : d.pts.length-1;
    LCD.cell(0,12,'ID#: '+T.id);
    LCD.cell(11,12, 'A/min   ' + fx(d.rate,3));
    LCD.cell(28,12, t('r_result') + (d.result!==null? fx(d.result,2):' --'));
    LCD.status(App.kinCursor!==undefined ? 'Wavelength  '+fx(d.pts[i].t,0)+'  Abs  '+fx(d.pts[i].A,4) : ' ');
    LCD.fkeys([t('k_tabular'), t('k_manualScale'), t('k_autoScale'), t('k_saveData')]);
  },
  key(k){
    if (k==='f1'){ App.screen='kin_table'; App.sel=0; paint(); }
    if (k==='f2'){ App.kinCursor = App.kinCursor===undefined? 0 : (App.kinCursor+1)%kinData().pts.length; paint(); }
    if (k==='f3'){ App.kinCursor=undefined; paint(); }
    if (k==='f4'){
      const d=kinData();
      const saved=saveResultData();
      if(saved) logEvent('Saved kinetics data for '+saved.test);
      printLine('');
      printLine('Kinetics — ' + T_str(App.test.name));
      printLine('Time(s)  Absorbance');
      d.pts.forEach(p=>printLine(String(p.t).padStart(6)+'   '+fx(p.A,4)));
      printLine('Rate:  ' + fx(d.rate,3) + ' A/min');
      App.outTab='print'; renderOut();
    }
    if (k==='esc'){ App.kinCursor=undefined; back(); }
  }
};
function T_str(s){ return s && s!=='-------' ? s : 'Test'; }

Screens.kin_table = {
  draw(){
    const d = kinData();
    LCD.header(t('k_tabular'), clockString()+'  '+dateString());
    const win = LCD.BODY_ROWS-1;
    const start = Math.max(0, Math.min(App.sel-win+1, d.pts.length-win));
    LCD.table([{label:'Time',w:10},{label:'Abs',w:10}],
      d.pts.slice(start,start+win).map(p=>[String(p.t), fx(p.A,4)]), 2);
    LCD.status(' ');
    LCD.fkeys(['','','',t('k_runTest')]);
  },
  key(k){
    const d=kinData();
    if (k==='up')   { App.sel=Math.max(0,App.sel-1); paint(); }
    if (k==='down') { App.sel=Math.min(d.pts.length-1,App.sel+1); paint(); }
    if (k==='esc'){ App.screen='kin_graph'; App.kinCursor=App.sel; paint(); }
    if (k==='f4'){ App.screen='kin_run'; App.step='sample'; paint(); }
  }
};

/* ---------- MULTIWAVELENGTH -------------------------------------------- */
Screens.multi_setnms = {
  draw(){
    const T = App.test;
    const wavelengths=Array.isArray(T.wls)?T.wls:[];
    const pageSize=8, firstRow=5, tableCols=26;
    const slotCount=Math.max(1,wavelengths.length+1);
    const page=Math.floor(Math.max(0,App.sel)/pageSize);
    const firstSlot=page*pageSize;

    LCD.header(t('m_multi'), clockString()+'  '+dateString());
    LCD.badge('BLANK',{rightPad:2});
    LCD.cell(0,1,t('p_testName')+': '+(T.name||'-------'));
    LCD.cell(0,3,'WL#');
    LCD.cell(8,3,'nm');
    LCD.cell(17,3,t('p_factor'));
    LCD.cell(0,4,'---');
    LCD.cell(8,4,'----');
    LCD.cell(17,4,'---------');

    for(let slot=firstSlot;slot<Math.min(firstSlot+pageSize,slotCount);slot++){
      const row=firstRow+(slot-firstSlot);
      const wavelength=wavelengths[slot];
      const selected=slot===App.sel;
      const color=selected?LCD.paper():undefined;
      if(selected) LCD.rect(0,row*LCD.CH,tableCols*LCD.CW,LCD.CH,LCD.ink());
      LCD.cell(2,row,String(slot+1),{color});
      LCD.cell(8,row,wavelength?fx(wavelength.l,1):'--------',{color});
      LCD.cell(17,row,wavelength?String(wavelength.f===undefined?1:wavelength.f):'----------',{color});
    }

    LCD.cell(0,13,t('e_multiPage').replace('{n}',String(page+1)));
    LCD.status(t('e_multiNmsViewData'));
    const selectedWavelength=wavelengths[App.sel];
    const hasSelectedPair=!!selectedWavelength &&
      selectedWavelength.l!==undefined && selectedWavelength.l!==null && selectedWavelength.l!=='' &&
      Number.isFinite(Number(selectedWavelength.l)) && Number(selectedWavelength.l)>=190 &&
      Number(selectedWavelength.l)<=1100 &&
      (selectedWavelength.f===undefined || (selectedWavelength.f!==null && selectedWavelength.f!=='' &&
        Number.isFinite(Number(selectedWavelength.f)) && Number(selectedWavelength.f)>=0));
    LCD.fkeys([t('k_edit'),t('k_addNm'),hasSelectedPair?t('k_deleteNm'):'',t('k_runTest')]);
  },
  key(k){
    const T = App.test;
    if(!Array.isArray(T.wls)) T.wls=[];
    const wavelengths=T.wls;
    const slotCount=Math.max(1,wavelengths.length+1);

    const enterWavelength=(slot, isNew)=>{
      const existing=wavelengths[slot];
      setEntry({label:t('p_wavelength'),value:existing?existing.l:546,min:190,max:1100,dec:1,unit:'nm',
        hint:'Enter Wavelength (190 - 1100)',onAccept:value=>{
          const save=(factor)=>{
            const pair={l:value,f:factor===undefined?(existing&&existing.f!==undefined?existing.f:1):factor};
            if(isNew) wavelengths.splice(Math.min(slot,wavelengths.length),0,pair);
            else wavelengths[slot]=pair;
            App.sel=isNew?wavelengths.length:slot;
            logEvent((isNew?'Added ':'Edited ')+value+'nm');
          };
          replaceEntry({label:t('p_factor'),value:existing?existing.f:1,min:0,max:1e6,dec:3,
            hint:'Enter Factor (0 - 1000000)',onAccept:factor=>{
              save(factor); back();
            }});
        }});
    };

    if(k==='up'){App.sel=(App.sel+slotCount-1)%slotCount;paint();return;}
    if(k==='down'){App.sel=(App.sel+1)%slotCount;paint();return;}
    if(k==='f1'||k==='enter'){
      if(App.sel<wavelengths.length) enterWavelength(App.sel,false);
      return;
    }
    if(k==='f2'){
      enterWavelength(Math.min(App.sel,wavelengths.length),true);
      return;
    }
    if(k==='f3'){
      if(App.sel<wavelengths.length){
        wavelengths.splice(App.sel,1);
        App.sel=Math.min(App.sel,wavelengths.length);
      }
      paint(); return;
    }
    if(k==='f4'&&wavelengths.length){
      back();
      Screens.params.key('f4');
      return;
    }
    if(k==='esc') back();
  }
};

/* ---------- STANDARD CURVE --------------------------------------------- */
function polyRegression(pts, degree){
  const size=degree+1;
  if (pts.length<size) return null;
  const matrix=Array.from({length:size},()=>Array(size+1).fill(0));
  for (let row=0;row<size;row++){
    for (let col=0;col<size;col++)
      matrix[row][col]=pts.reduce((sum,p)=>sum+Math.pow(p.x,row+col),0);
    matrix[row][size]=pts.reduce((sum,p)=>sum+p.y*Math.pow(p.x,row),0);
  }
  for (let col=0;col<size;col++){
    let pivot=col;
    for (let row=col+1;row<size;row++)
      if (Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col])) pivot=row;
    if (Math.abs(matrix[pivot][col])<1e-12) return null;
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
    const scale=matrix[col][col];
    for (let j=col;j<=size;j++) matrix[col][j]/=scale;
    for (let row=0;row<size;row++) if(row!==col){
      const factor=matrix[row][col];
      for (let j=col;j<=size;j++) matrix[row][j]-=factor*matrix[col][j];
    }
  }
  const coeffs=matrix.map(row=>row[size]);
  const value=x=>coeffs.reduce((sum,c,i)=>sum+c*Math.pow(x,i),0);
  const mean=pts.reduce((sum,p)=>sum+p.y,0)/pts.length;
  const ssTot=pts.reduce((sum,p)=>sum+(p.y-mean)*(p.y-mean),0);
  const ssRes=pts.reduce((sum,p)=>sum+(p.y-value(p.x))**2,0);
  return {coeffs,value,intercept:coeffs[0],slope:coeffs[1]||0,
    r:ssTot?Math.sqrt(Math.max(0,1-ssRes/ssTot)):1};
}
function curveModel(T, pts){
  const sorted=pts.slice().sort((a,b)=>a.x-b.x);
  let model;
  if (T.curveFit==='v_segmented'){
    if(sorted.length<2) return null;
    const segmentAt=x=>{
      let i=0;
      while(i<sorted.length-2 && x>sorted[i+1].x) i++;
      const a=sorted[i], b=sorted[i+1], dx=b.x-a.x;
      return dx ? (b.y-a.y)/dx : 0;
    };
    const value=x=>{
      let i=0;
      while(i<sorted.length-2 && x>sorted[i+1].x) i++;
      const a=sorted[i], b=sorted[i+1], dx=b.x-a.x;
      return dx ? a.y+(x-a.x)*(b.y-a.y)/dx : a.y;
    };
    model={value,intercept:value(0),slope:segmentAt(0),r:1};
  } else if(T.curveFit==='v_linear0'){
    const line=linReg0(pts);
    model={...line,intercept:0,value:x=>line.slope*x};
  } else {
    const degree={v_linear:1,v_quad:2,v_cubic:3,v_quartic:4}[T.curveFit]||1;
    model=polyRegression(pts,degree);
  }
  if (!model) return null;
  const lo=sorted[0].x, hi=sorted[sorted.length-1].x;
  const delta=Math.max(1e-6,(hi-lo)/100);
  let increasing=true, decreasing=true, prev=model.value(lo);
  for(let i=1;i<=100;i++){
    const y=model.value(lo+(hi-lo)*i/100);
    if(y<prev-1e-9) increasing=false;
    if(y>prev+1e-9) decreasing=false;
    prev=y;
  }
  model.valid=increasing||decreasing;
  model.domain=[lo,hi]; model.points=sorted;
  model.direction=model.value(hi)>=model.value(lo)?1:-1;
  model.delta=delta;
  return model;
}
function invertCurve(model, absorbance){
  if(!model||!model.valid) return null;
  let [lo,hi]=model.domain;
  const ylo=model.value(lo), yhi=model.value(hi);
  if((absorbance<Math.min(ylo,yhi))||(absorbance>Math.max(ylo,yhi))){
    const x=absorbance<Math.min(ylo,yhi)?(ylo<yhi?lo:hi):(ylo>yhi?lo:hi);
    const y=model.value(x), dx=x===lo?model.delta:-model.delta;
    const slope=(model.value(x+dx)-y)/dx;
    return Math.abs(slope)>1e-12 ? x+(absorbance-y)/slope : null;
  }
  for(let i=0;i<60;i++){
    const mid=(lo+hi)/2, y=model.value(mid);
    if((y<absorbance)===(model.direction===1)) lo=mid;
    else hi=mid;
  }
  return (lo+hi)/2;
}
function seedStdCurve(){
  const T = App.test;
  T.wavelength = STD_DEMO.lambda; T.units = STD_DEMO.unit;
  T.standards = STD_DEMO.concs.map(c=>({c, A: STD_DEMO.slope*c + STD_DEMO.intercept, done:false}));
}
Screens.std_std = {
  draw(){
    const T = App.test;
    LCD.header(t('r_standards'), clockString()+'  '+dateString());
    LCD.cell(0,2,'Wavelength: '+T.wavelength+'nm   '+t('p_standardConc'));
    const rows = T.standards.map((s,i)=>({
      label:'Std '+(i+1)+'   '+fx(s.c,3)+' '+T.units,
      value: s.done? fx(s.A,4) : '---', hi:i===App.sel}));
    LCD.rows(rows.slice(0,LCD.BODY_ROWS-2), 3);
    LCD.cell(0, LCD.BODY_ROWS+1, 'Number of Standards: '+T.standards.length);
    LCD.status('Place each standard in cell 1, then press Run Standard.');
    LCD.fkeys([t('k_runStandard'),'','',t('k_startTest')]);
  },
  key(k){
    const T = App.test;
    const N = T.standards.length;
    if (k==='up')   { App.sel=(App.sel+N-1)%N; paint(); return; }
    if (k==='down') { App.sel=(App.sel+1)%N; paint(); return; }
    if (k==='f1'||k==='enter'){
      const s = T.standards[App.sel];
      setEntry({label:t('r_standard'), value:s.c, min:0, max:1e6, dec:3,
        hint:'Entry Standard Concentration ('+T.units+')',
        onAccept:v=>{ s.c=v; s.done=false; back(); measureStandard(); }});
      return;
    }
    if (k==='f4'){
      const miss = T.standards.filter(s=>!s.done).length;
      if (miss){ logEvent('Measure all standards first ('+miss+' left)'); App.sel=T.standards.findIndex(s=>!s.done); return paint(); }
      App.screen='std_results'; paint(); return;
    }
    if (k==='esc') back();
  }
};
function measureStandard(){
  const T = App.test;
  const s = T.standards[App.sel];
  App.busy=true; App.progress=0;
  App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
  busyFor(500,()=>{ clearInterval(App.interval); App.interval=null;
    App.blankRef = App.blankRef || {base:0.0004, seed:Math.random()*10};
    s.A = Math.max(0, measureAbs(App.beamCell, T.wavelength) + jitter(0.002));
    s.done = true;
    logEvent('Standard '+fx(s.c,3)+' → A='+fx(s.A,4));
    App.sel = Math.min(T.standards.length-1, App.sel+1);
    paint();
  });
}
Screens.std_results = {
  draw(){
    const T = App.test;
    LCD.header(t('m_stdcurve'), clockString()+'  '+dateString());
    const pts = T.standards.map(s=>({x:s.c, y:s.A}));
    const fit = curveModel(T,pts);
    if(!fit){
      LCD.cell(2,5,'Not enough standards for this curve fit.');
      LCD.fkeys(['','','','']); return;
    }
    if(!fit.valid){
      LCD.cell(2,5,'Curve cannot be used to determine concentrations.');
      LCD.status('The fitted curve is not monotonic.');
      LCD.fkeys([t('k_editCurve'),'','','']); return;
    }
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    LCD.graph({ x0:0, x1:Math.max.apply(null,xs)*1.15||1,
      y0:Math.min(0,Math.min.apply(null,ys)-0.02), y1:Math.max.apply(null,ys)*1.1+0.02,
      xlabel:T.units, ylabel:'A', stds:pts,
      fit: c=> fit.value(c) });
    LCD.cell(0,12,'Slope     '+fx(fit.slope,4));
    LCD.cell(20,12,'Intercept '+fx(fit.intercept,4));
    LCD.cell(0,13,'r = '+fx(fit.r,4)+'   Date Standards Measured '+dateString());
    LCD.status(' ');
    LCD.fkeys([t('k_editCurve'),'','',t('k_measureSample')]);
  },
  key(k){
    if (k==='f1'){ /* edit curve: change curve fit */ 
      const opts=['v_linear','v_linear0','v_segmented','v_quad','v_cubic','v_quartic'];
      const i = opts.indexOf(App.test.curveFit);
      setMenu({title:t('p_curveFit'), opts, get:x=>t(opts[x]),
        onPick:v=>{App.test.curveFit=v; logEvent('Curve fit: '+v); back();}});
      return;
    }
    if (k==='f4'){ App.screen='std_sample'; App.step='sample'; paint(); return; }
    if (k==='esc') back();
  }
};
Screens.std_sample = {
  draw(){
    const T = App.test;
    LCD.header(t('m_stdcurve'), clockString()+'  '+dateString());
    LCD.badge('Cell #'+App.beamCell);
    if (App.busy){ LCD.cell(2,5,t('v_reading')); LCD.fkeys(['','','','']); return; }
    const model=curveModel(T,T.standards.map(s=>({x:s.c,y:s.A})));
    LCD.rows([
      {label:t('p_wavelength'), value:T.wavelength+'nm'},
      {label:t('r_id'), value:String(App.sampleN||1)+' of '+T.nSamples}
    ], 3);
    LCD.cell(2,7, samplePrompt());
    LCD.status(model&&model.valid ? 'Press Measure Sample to determine the concentration.'
                                  : 'Curve cannot be used to determine concentrations.');
    LCD.fkeys(model&&model.valid ? ['','','',t('k_measureSample')] : ['','','','']);
  },
  key(k){
    if (App.busy) return;
    if (k==='f4'||k==='enter'){
      const standards=App.test.standards.map(s=>({x:s.c,y:s.A}));
      const model=curveModel(App.test,standards);
      if(!model||!model.valid){
        logEvent('Standard curve cannot be used to determine concentrations');
        return;
      }
      App.busy=true; App.progress=0;
      App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
      busyFor(500,()=>{ clearInterval(App.interval); App.interval=null;
        const T=App.test;
        const A = Math.max(0, measureAbs(App.beamCell, T.wavelength)+jitter(0.0015));
        const pts = T.standards.map(s=>({x:s.c,y:s.A}));
        const fit = curveModel(T,pts);
        const c = invertCurve(fit,A);
        if(c===null){
          logEvent('Could not determine concentration from the fitted curve');
          App.screen='std_results'; paint(); return;
        }
        App.results.push({A, conc:Math.max(0,c), text:fx(Math.max(0,c),3)+' '+T.units,
          rows:[{k:t('r_absorbance'), v:T.wavelength+'nm', a:fx(A,4)},
                {k:t('r_slope'), v:'', a:fx(fit.slope,4)},
                {k:t('r_concentration'), v:'', a:fx(Math.max(0,c),3)+' '+T.units}]});
        if(T.autoSave) saveResultData();
        if(T.autoPrint) printResult();
        pushStat(c);
        App.sampleN=(App.sampleN||1)+1;
        logEvent('Sample → '+fx(c,3)+' '+T.units);
        App.screen='results'; paint();
      });
      return;
    }
    if (k==='esc') back();
  }
};

/* ---------- WATER ANALYSIS --------------------------------------------- */
Screens.water_run = {
  draw(){
    const T = App.test;
    const m = METHOD_BY_ID[T.methodId] || {};
    LCD.header(t('m_water') + (T.adj1pt?' (1pt Adj)':''), clockString()+'  '+dateString());
    LCD.badge(App.step==='blank'?'BLANK':App.step==='rgnt'?'BLANK':'Cell #'+App.beamCell);
    if (App.busy){ LCD.cell(2,5,t('v_measuring')); LCD.fkeys(['','','','']); return; }
    LCD.rows([
      {label:t('p_testName'), value: T.name==='-------'? m.name : T.name},
      {label:t('p_wavelength'), value:T.lambda+'nm'},
      {label:'B', value:String(T.B)},
      {label:t('p_reverseColor'), value:T.reverse?t('v_on'):t('v_off')},
      {label:t('p_positioner'), value:t('v_manual3')}
    ], 3);
    let f = ['','','',''];
    if (App.step==='blank')      f[3]=t('k_measureBlank');
    else if (App.step==='rgnt')  f[2]=t('k_measureRgnt');
    else                         f[3]=t('k_measureSample');
    LCD.status(App.step==='blank'? t('e_insertBlank')
             : App.step==='rgnt'? 'Insert the reagent blank in cell '+App.beamCell+'.'
             : samplePrompt());
    LCD.fkeys(f);
  },
  key(k){
    if (App.busy) return;
    if (k==='esc'){ App.step='blank'; back(); return; }
    if (App.step==='blank'){ if (k==='f4'||k==='enter') doBlank(); }
    else if (App.step==='rgnt'){ if (k==='f3'||k==='enter') doRgntBlank(); }
    else { if (k==='f4'||k==='enter') doSample(); }
  }
};

Screens.water_1pt = {
  draw(){
    const T = App.test;
    LCD.header(t('k_calc1pt'), clockString()+'  '+dateString());
    LCD.rows([
      {label:t('p_standardConc'), value:String(App.oneptStd!==undefined?App.oneptStd:0), hi:App.sel===0},
      {label:t('r_concentration'), value: App.oneptMeasured!==undefined? fx(App.oneptMeasured,3):'--'},
      {label:'Adjustment Factor', value: App.oneptFactor!==undefined? fx(App.oneptFactor,4):'--'}
    ], 3);
    const step=App.oneptStep||'blank';
    const status={blank:'Place the clear blank in the selected cell.',
      rgnt:'Place the reagent blank in the selected cell.',
      standard:'Place the known standard in the selected cell.',
      accept:'Review the adjustment factor, then accept it.'}[step];
    LCD.status(status);
    if (step==='blank') LCD.fkeys(['','','',t('k_measureBlank')]);
    else if (step==='rgnt') LCD.fkeys(['','',t('k_measureRgnt'),'']);
    else if (step==='standard') LCD.fkeys(['','','',t('k_measureStd')]);
    else LCD.fkeys([t('k_accept'),'','','']);
  },
  key(k){
    const T = App.test;
    if (App.busy) return;
    if (k==='enter'){
      setEntry({label:t('p_standardConc'), value: App.oneptStd||0, min:0, max:1e6, dec:3,
        hint:'Entry Standard Concentration', onAccept:v=>{ App.oneptStd=v; back(); }});
      return;
    }
    if (k==='esc'){ back(); return; }
    if ((App.oneptStep||'blank')==='blank' && k==='f4'){
      App.busy=true; App.progress=0;
      App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
      busyFor(500,()=>{ clearInterval(App.interval); App.interval=null;
        App.blankRef={base:0.0004,seed:Math.random()*10};
        App.rgntBlank=null;
        App.beamCell=posSample(T.positioner);
        if(typeof renderCarousel==='function') renderCarousel();
        App.oneptStep=T.rgntBlank?'rgnt':'standard';
        logEvent('1pt adjustment blank measured');
        paint();
      });
      return;
    }
    if (App.oneptStep==='rgnt' && (k==='f3'||k==='enter')){
      App.busy=true; App.progress=0;
      App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
      busyFor(500,()=>{ clearInterval(App.interval); App.interval=null;
        App.rgntBlank={cell:App.beamCell,absorbance:cellAbs(App.beamCell,T.lambda)};
        App.oneptStep='standard'; logEvent('1pt adjustment reagent blank measured'); paint();
      });
      return;
    }
    if (App.oneptStep==='standard' && (k==='f4'||k==='enter')){
      App.busy=true; App.progress=0;
      App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
      busyFor(500,()=>{ clearInterval(App.interval); App.interval=null;
        const measured=waterEquation(T,measureAbs(App.beamCell,T.lambda));
        App.oneptMeasured=measured;
        App.oneptFactor=measured!==0 ? App.oneptStd/measured : NaN;
        App.oneptStep='accept';
        logEvent('1pt adjust factor = '+fx(App.oneptFactor,4)); paint();
      });
      return;
    }
    if (App.oneptStep==='accept' && k==='f1' && Number.isFinite(App.oneptFactor)){
      T.adjFactor=App.oneptFactor; T.adj1pt=true;
      logEvent('Accepted 1pt adjustment factor = '+fx(T.adjFactor,4));
      App.oneptStep=null; back(); return;
    }
  }
};

/* ---------- PERFORMANCE VERIFICATION ----------------------------------- */
const PV_LIST = [
  ['wavAccInternal','Wavelength Accuracy - Internal'],
  ['wavAccStandard','Wavelength Accuracy - Standard'],
  ['wavRepeat','Wavelength Repeatability'],
  ['resolution','Resolution'],
  ['photoAcc','Photometric Accuracy'],
  ['noise','Noise'],
  ['strayLight','Stray Light']
];
Screens.pv = {
  draw(){
    LCD.header(t('m_pv'), clockString()+'  '+dateString());
    LCD.rows(PV_LIST.map((p,i)=>({label:p[1], hi:i===App.sel})), 2);
    LCD.status('Press Enter to open the test.');
    LCD.fkeys(['','','','']);
  },
  key(k){
    if (k==='up')   { App.sel=(App.sel+PV_LIST.length-1)%PV_LIST.length; paint(); }
    if (k==='down') { App.sel=(App.sel+1)%PV_LIST.length; paint(); }
    if (k==='enter'){ App.test.pvType=PV_LIST[App.sel][0]; App.screen='pv_run'; App.step='start'; paint(); }
    if (k==='esc') back();
  }
};
Screens.pv_run = {
  draw(){
    const T = App.test;
    const nm = (PV_LIST.find(p=>p[0]===T.pvType)||['','?'])[1];
    LCD.header(nm, clockString()+'  '+dateString());
    if (App.busy){ LCD.cell(2,5,t('v_measuring')); LCD.fkeys(['','','','']); return; }
    const pre = PV_PRESETS[T.pvType];
    if (pre){
      const values = pre.values || pre.lambda || [];
      LCD.cell(0,2,pre.label+'       Nominal       Measured       Result');
      values.forEach((w,i)=>{
        const pass = Math.abs(pre.meas[i]-w) <= pre.tol[i];
        const unit = pre.unit || '';
        const decimals = unit==='A RMS' ? 4 : unit==='A' ? 3 : 2;
        LCD.rows([{label: String(w)+' '+unit, value: fx(pre.meas[i],decimals)+' '+unit+'  '+(pass?t('v_pass'):t('v_fail')), hi:false}], 3+i);
      });
      LCD.status('Results are automatically printed when a printer is connected.');
      LCD.fkeys([t('k_startTest'),'','','']);
    } else {
      LCD.cell(2,6,'No standards loaded for this test.');
      LCD.fkeys([t('k_startTest'),'','','']);
    }
  },
  key(k){
    const T=App.test, pre = PV_PRESETS[T.pvType];
    if (k==='f1'||k==='enter'){
      App.busy=true; App.progress=0;
      App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.2);paint();},80);
      busyFor(900,()=>{ clearInterval(App.interval); App.interval=null;
        if (pre){
          const values = pre.values || pre.lambda || [];
          let allPass=true;
          values.forEach((w,i)=>{ if(Math.abs(pre.meas[i]-w)>pre.tol[i]) allPass=false; });
          printLine('');
          printLine(nmLine(T.pvType));
          values.forEach((w,i)=>{
            const pass=Math.abs(pre.meas[i]-w)<=pre.tol[i];
            printLine('  '+w+' '+(pre.unit||'')+'   tol '+pre.tol[i]+'   meas '+pre.meas[i]+' '+(pre.unit||'')+'   '+(pass?'Pass':'Fail'));
          });
          printLine('Overall: ' + (allPass?'PASS':'FAIL'));
          App.outTab='print'; renderOut();
        }
        logEvent(nmLine(T.pvType)+' complete');
        paint();
      });
      return;
    }
    if (k==='esc') back();
  }
};
function nmLine(k){
  const x = PV_LIST.find(p=>p[0]===k); return x? x[1] : 'Performance Verification';
}

/* ---------- CELL CORRECTION -------------------------------------------- */
function cellCorrConfig(){
  const defaults={mode:'Scan',start:400,stop:700,n:1,wavelengths:[546],measurements:{},completedAt:null};
  if(App.cellcorrContext==='test'){
    const T=App.test;
    T.cellCorrConfig=Object.assign({},defaults,T.cellCorrConfig||{});
    if(!Array.isArray(T.cellCorrConfig.wavelengths)) T.cellCorrConfig.wavelengths=[546];
    if(!T.cellCorrConfig.measurements) T.cellCorrConfig.measurements={};
    return T.cellCorrConfig;
  }
  App.cellcorrState=Object.assign({positioner:'auto6'},defaults,App.cellcorrState||{});
  if(!Array.isArray(App.cellcorrState.wavelengths)) App.cellcorrState.wavelengths=[546];
  if(!App.cellcorrState.measurements) App.cellcorrState.measurements={};
  return App.cellcorrState;
}
function cellCorrPositioner(){
  return App.cellcorrContext==='test' ? App.test.positioner : cellCorrConfig().positioner;
}
function cellCorrRows(C){
  const rows=[];
  if(App.cellcorrContext!=='test') rows.push({key:'positioner',label:t('p_positioner'),value:t((POSITIONERS.find(p=>p.id===C.positioner)||{}).label||'')});
  rows.push({key:'mode',label:t('p_correctionMode'),value:C.mode});
  if(C.mode==='Scan'){
    rows.push({key:'start',label:t('p_startWl'),value:C.start+'nm'});
    rows.push({key:'stop',label:t('p_stopWl'),value:C.stop+'nm'});
  }else{
    rows.push({key:'n',label:t('p_matchedCuvettes'),value:String(C.n)});
    rows.push({key:'wavelengths',label:t('p_discreteNms'),value:String(C.wavelengths.length)});
  }
  rows.push({key:'status',label:t('p_correctionStatus'),value:C.completedAt?C.completedAt.date+' '+C.completedAt.time:t('v_notMeasured')});
  return rows;
}
function startCellCorrection(){
  const C=cellCorrConfig(), positioner=cellCorrPositioner();
  const available=posCells(positioner).filter(c=>c!=='B');
  if(!['auto6','auto3'].includes(positioner)){
    App.notice=t('e_cellCorrHolder'); logEvent('Cell correction requires Auto 6 or Auto 3'); paint(); return;
  }
  if(C.mode==='Scan' && Number(C.start)>=Number(C.stop)){
    App.notice=t('e_cellCorrRange'); paint(); return;
  }
  const cells=C.mode==='Scan'?available.slice(0,1):available.slice(0,Number(C.n));
  const wavelengths=C.mode==='Scan'
    ? Array.from({length:Math.floor((C.stop-C.start)/1)+1},(_,i)=>Number(C.start)+i)
    : C.wavelengths.slice();
  if(!cells.length || !wavelengths.length || wavelengths.length>31 && C.mode!=='Scan'){
    App.notice=t('e_cellCorrSetup'); paint(); return;
  }
  const checkCells=['B'].concat(cells);
  if(checkCells.some(c=>!App.cells[c]||App.cells[c].sol!=='water')){
    App.notice=t('e_cellCorrBlanks'); logEvent('Load distilled water into the blank and matched cuvettes'); paint(); return;
  }
  App.notice=''; App.busy=true; App.progress=0;
  App.interval=setInterval(()=>{App.progress=Math.min(1,(App.progress||0)+0.12);paint();},80);
  busyFor(900,()=>{
    clearInterval(App.interval); App.interval=null;
    const measurements={};
    cells.forEach(c=>{
      measurements[c]=wavelengths.map(nm=>({nm,delta:cellAbs(c,nm)-cellAbs('B',nm)}));
    });
    C.measurements=measurements;
    C.cells=cells.slice();
    C.completedAt={date:dateString(),time:clockString()};
    printLine(''); printLine('Cell Correction  '+C.completedAt.date+' '+C.completedAt.time);
    Object.keys(measurements).forEach(c=>{
      printLine('Cell '+c+': '+measurements[c].length+' wavelength correction(s)');
    });
    logEvent('Cell correction completed for '+cells.length+' matched cuvette(s)');
    persistSimulatorState();
    paint();
  });
}
Screens.cellcorr = {
  draw(){
    const C=cellCorrConfig(), rows=cellCorrRows(C);
    LCD.header(t('m_cellcorr'), clockString()+'  '+dateString());
    if(App.busy){
      LCD.cell(2,5,t('v_measuring'));
      LCD.rect(2*CW,8*CH,34*CW,CH,LCD.ink());
      LCD.rect(2*CW+2,8*CH+2,Math.round(32*CW*(App.progress||0)),CH-4,LCD.paper());
      LCD.fkeys(['','','','']); return;
    }
    LCD.rows(rows.map((r,i)=>({label:r.label,value:r.value,hi:i===App.sel})),2);
    LCD.status(App.notice || t('e_cellCorrBlanks'));
    LCD.fkeys([t('k_runCorr'),'','','']);
  },
  key(k){
    if(App.busy) return;
    const C=cellCorrConfig(), rows=cellCorrRows(C), row=rows[App.sel];
    if (k==='up'){ App.sel=Math.max(0,App.sel-1); paint(); return; }
    if (k==='down'){ App.sel=Math.min(rows.length-1,App.sel+1); paint(); return; }
    if(k==='esc'){ App.notice=''; back(); return; }
    if (k==='enter'){
      if(!row) return;
      if(row.key==='positioner') setMenu({title:t('p_positioner'),opts:['auto6','auto3'],
        get:i=>t(i===0?'v_auto6':'v_auto3'),onPick:v=>{C.positioner=v; C.measurements={};
          if(!posCells(v).includes(App.beamCell)) App.beamCell='B';
          if(typeof renderCarousel==='function') renderCarousel(); back();}});
      else if(row.key==='mode') setMenu({title:t('p_correctionMode'),opts:['Scan','Discrete nms'],
        onPick:v=>{C.mode=v; back();}});
      else if(row.key==='n') setEntry({label:t('p_matchedCuvettes'),value:C.n,min:1,
        max:Math.min(5,posCells(cellCorrPositioner()).filter(c=>c!=='B').length),
        integer:true,
        onAccept:v=>{C.n=v; C.measurements={}; back();}});
      else if(row.key==='start'||row.key==='stop') setEntry({label:row.label,value:C[row.key],min:190,max:1100,decimals:1,
        onAccept:v=>{C[row.key]=v; back();}});
      else if(row.key==='wavelengths'){ App.nav.push('cellcorr'); App.screen='cellcorr_nms'; App.sel=0; paint(); }
      return;
    }
    if(k==='f1') startCellCorrection();
  }
};

Screens.cellcorr_nms={
  draw(){
    const C=cellCorrConfig();
    LCD.header(t('p_discreteNms'),clockString()+'  '+dateString());
    LCD.rows(C.wavelengths.map((nm,i)=>({label:'nm '+(i+1),value:nm+'nm',hi:i===App.sel})),2);
    if(!C.wavelengths.length) LCD.cell(2,4,t('e_cellCorrAddNm'));
    LCD.status(App.notice || t('e_cellCorrNmsHint'));
    LCD.fkeys([t('k_addNm'),' ',t('k_deleteNm'),t('k_accept')]);
  },
  key(k){
    const C=cellCorrConfig(), N=C.wavelengths.length;
    if(k==='up'){App.sel=Math.max(0,App.sel-1);paint();return;}
    if(k==='down'){App.sel=Math.min(Math.max(0,N-1),App.sel+1);paint();return;}
    if(k==='f1'){
      if(N>=31){App.notice=t('e_cellCorrMaxNms');return paint();}
      setEntry({label:t('p_wavelength'),value:546,min:190,max:1100,dec:1,
        onAccept:v=>{if(!C.wavelengths.some(nm=>Math.abs(nm-v)<0.05)) C.wavelengths.push(v);
          C.wavelengths.sort((a,b)=>a-b); C.measurements={}; App.notice=''; back();}});
      return;
    }
    if(k==='f3'&&N){C.wavelengths.splice(App.sel,1);App.sel=Math.max(0,App.sel-1);C.measurements={};paint();return;}
    if(k==='enter'&&N){
      const old=C.wavelengths[App.sel];
      setEntry({label:t('p_wavelength'),value:old,min:190,max:1100,dec:1,
        onAccept:v=>{if(!C.wavelengths.some((nm,i)=>i!==App.sel&&Math.abs(nm-v)<0.05)) C.wavelengths[App.sel]=v;
          C.wavelengths.sort((a,b)=>a-b);C.measurements={};App.notice='';back();}});
      return;
    }
    if(k==='f4'||k==='esc'){App.notice='';back();}
  }
};

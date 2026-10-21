/* =====================================================================
   app.js — boot, input wiring, side panels, output
   ===================================================================== */

(function(){

/* ---------- boot ------------------------------------------------------- */
function boot(){
  App.lang = 'en';
  App.stored = defaultStoredTests();
  App.smartstart = ['Copper','Chlorine'];
  restoreSimulatorState();
  App.test = newTest('atc_basic');
  App.sampleN = 1;
  App.outTab = 'print';
  LCD.init(document.getElementById('lcd'));
  LCD.setContrast(App.contrast);

  buildModeList();
  wireInstrument();
  wireTopbar();
  wireTabs();
  wirePicker();
  wireKeyboard();
  setLang('en');
  paintAll();
  scheduleClockRefresh();
}

/* Keep the LCD clock in step with the computer's local clock. Align refreshes
   to minute boundaries so the displayed minute changes at the right time. */
function scheduleClockRefresh(){
  const untilNextMinute = 60000 - (Date.now() % 60000);
  window.setTimeout(()=>{
    render();
    scheduleClockRefresh();
  }, untilNextMinute);
}

function paintAll(){
  render();
  renderCarousel();
  renderGuide();
  renderScreenRef();
  renderOut();
  paintFKeyLabels();
}

/* ---------- LCD render -------------------------------------------------- */
function render(){
  if (!App.power) return;
  LCD.clear();
  const s = Screens[App.screen] || Screens.mainmenu;
  try { s.draw(); }
  catch(err){ LCD.header('Error',''); LCD.cell(0,4, String(err.message).slice(0,40)); console.error(err); }
  LCD.texture();
  paintFKeyLabels();
}

/* The instrument itself carries no key captions — the labels live on the
   LCD footer. We mirror them into the button tooltips for mouse users. */
function paintFKeyLabels(){
  const labels = App.lastFkeys || [];
  document.querySelectorAll('.fkey').forEach((el,i)=>{
    el.title = labels[i] ? (App.lang==='es'?'Tecla de función ':'Function key ')+(i+1)+': '+labels[i] : '';
  });
}

/* ---------- input ------------------------------------------------------- */
function press(k){
  if (!App.power) return;
  /* The tutorial tracks the action while the simulated instrument receives it. */
  if (App.tutorOn && Tutor.active) Tutor.handle(k);
  const s = Screens[App.screen] || Screens.mainmenu;
  const before = App.screen;
  try { s.key(k); }
  catch(err){ console.error(err); logEvent('Error: '+err.message); }
  if (App.screen === before && typeof render === 'function') render();
  renderGuide();
}

function wireInstrument(){
  document.querySelectorAll('[data-key]').forEach(el=>{
    let holdDelay=null, repeatTimer=null, clickReset=null;
    let pointerHeld=false, swallowClick=false;

    const stopHold=()=>{
      if(!pointerHeld) return;
      pointerHeld=false;
      clearTimeout(holdDelay); clearInterval(repeatTimer);
      holdDelay=null; repeatTimer=null;
      clickReset=setTimeout(()=>{swallowClick=false;clickReset=null;},0);
    };

    if(el.classList.contains('arrowkey')){
      el.addEventListener('pointerdown', e=>{
        if(App.screen!=='nameentry' || e.button!==0) return;
        e.preventDefault();
        pointerHeld=true; swallowClick=true;
        if(clickReset){clearTimeout(clickReset);clickReset=null;}
        try{el.setPointerCapture(e.pointerId);}catch(_err){}
        press(el.dataset.key);
        holdDelay=setTimeout(()=>{
          repeatTimer=setInterval(()=>{
            if(App.screen==='nameentry') press(el.dataset.key);
            else stopHold();
          },60);
        },320);
      });
      el.addEventListener('pointerup',stopHold);
      el.addEventListener('pointercancel',stopHold);
      el.addEventListener('lostpointercapture',stopHold);
    }

    el.addEventListener('click', e=>{
      e.preventDefault();
      if(swallowClick){swallowClick=false;return;}
      press(el.dataset.key);
    });
  });
  document.querySelectorAll('[data-cell]').forEach(el=>{
    el.addEventListener('click', e=>{
      e.preventDefault();
      const c = el.dataset.cell;
      if(!selectCell(c)) return;
      if (App.tutorOn && Tutor.active && Tutor.handle('cell'+c)) render();
    });
  });
}

function selectCell(c){
  if(!currentHolderCells().includes(c)){
    logEvent('Cell '+c+' is not available in the selected holder');
    return false;
  }
  App.beamCell = c;
  document.querySelectorAll('[data-cell]').forEach(e=>
    e.classList.toggle('in-beam', e.dataset.cell===App.beamCell));
  logEvent('Cell ' + c + ' → ' + cellLabel(c));
  render(); renderCarousel();
  return true;
}
function currentHolderCells(){
  let holder=App.test&&App.test.positioner||'auto6';
  if(App.mode==='water') holder='manual3';
  if(App.mode==='cellcorr' && App.cellcorrContext==='direct' && App.cellcorrState)
    holder=App.cellcorrState.positioner||'auto6';
  return posCells(holder);
}
function cellLabel(c){
  const cell = App.cells[c];
  if (!cell || cell.sol==='water' || cell.sol===null) return t('c_water');
  const m = METHOD_BY_ID[cell.sol];
  if (m) return (App.lang==='es'? m.nameEs : m.name) + ' ' + fx(cell.conc,2) + ' ' + m.unit;
  const s = SOL_BY_ID[cell.sol];
  if (s) return (App.lang==='es'? s.nameEs : s.name) + ' ' + fx(cell.conc,2);
  return t('c_empty');
}

const KEYMAP = {
  '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
  '.':'dot',',':'dot','-':'minus','Enter':'enter','Escape':'esc','Backspace':'clear',
  'ArrowUp':'up','ArrowDown':'down','ArrowLeft':'left','ArrowRight':'right',':':'colon',
  'Delete':'clear',' ':'f4'
};
function wireKeyboard(){
  document.addEventListener('keydown', e=>{
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    let k = KEYMAP[e.key];
    if (!k){
      const kk = e.key.toLowerCase();
      if (['f1','f2','f3','f4'].indexOf(kk)>=0) k = kk;
      else if (kk==='t') k='test';
      else if (kk==='u') k='utility';
      else if (kk==='p') k='print';
    }
    if (!k) return;
    e.preventDefault();
    press(k);
  });
}

/* ---------- top bar ----------------------------------------------------- */
function wireTopbar(){
  document.getElementById('btnReset').addEventListener('click', ()=>{
    setTutor(false);
    App.power=false;
    App.timer && clearTimeout(App.timer);
    if (App.interval){ clearInterval(App.interval); App.interval=null; }
    App.busy=false;
    App.timer = setTimeout(()=>{
      Object.assign(App,{ screen:'mainmenu', nav:[], sel:0, entry:null, menu:null,
        nameEntry:null, blankRef:null, rgntBlank:null, results:[], log:[], printout:[],
        sampleN:1, test:newTest('atc_basic'), mode:'atc_basic', paramsPage:'main',
        beamCell:'B', step:'blank', progress:0, busy:false, interval:null, power:true });
      resetStats();
      App.cells = { B:{kind:'vial',sol:'water',conc:0}, '1':{kind:'square',sol:'water',conc:0},
        '2':{kind:'square',sol:'water',conc:0}, '3':{kind:'vial',sol:'water',conc:0},
        '4':{kind:'longpath',sol:'water',conc:0}, '5':{kind:'vial',sol:'water',conc:0} };
      App.outTab='print'; App.printout.push('Thermo Scientific Orion AquaMate 8000 UV-Vis');
      App.printout.push('Self test complete. Press TEST to begin.');
      paintAll();
    }, 700);
  });

  document.getElementById('btnTutorial').addEventListener('click', e=>{
    const on = !App.tutorOn;
    setTutor(on);
    if (on && !Tutor.active) Tutor.start('basic_atc');
  });
  document.getElementById('tutorToggle').addEventListener('change', e=>{
    setTutor(e.target.checked);
    if (e.target.checked && !Tutor.active) Tutor.start('basic_atc');
  });
  document.getElementById('tutorNext').addEventListener('click', ()=>{ Tutor.next(); render(); });
  document.getElementById('tutorPrev').addEventListener('click', ()=>{ Tutor.prev(); render(); });
  document.getElementById('tutorExit').addEventListener('click', ()=>{ setTutor(false); });

  document.querySelectorAll('.lang-btn').forEach(b=>{
    b.addEventListener('click', ()=> setLang(b.dataset.lang));
  });
  document.getElementById('btnExportData').addEventListener('click', exportSavedData);
}
function exportSavedData(){
  if(!App.savedData.length){ logEvent(t('e_noSavedData')); renderOut(); return; }
  const q=v=>'"'+String(v===null||v===undefined?'':v).replace(/"/g,'""')+'"';
  const rows=[['Test','Data File','Mode','Method','Date','Time','Cell','Wavelength (nm)','Absorbance','Result','Units','Point X','Point Absorbance']];
  App.savedData.forEach(r=>{
    if(Array.isArray(r.points)&&r.points.length){
      r.points.forEach(p=>rows.push([r.test,r.fileName,r.mode,r.methodId,r.date,r.time,r.cell,r.wavelength,
        r.absorbance,r.result,r.units,p.nm===undefined?(p.t===undefined?'':p.t):p.nm,p.A===undefined?'':p.A]));
    }else rows.push([r.test,r.fileName,r.mode,r.methodId,r.date,r.time,r.cell,r.wavelength,r.absorbance,r.result,r.units,'','']);
  });
  const csv=rows.map(row=>row.map(q).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download='aquamate8000_data.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  logEvent('Exported saved data as CSV');
}
function setTutor(on){
  App.tutorOn = on;
  document.getElementById('btnTutorial').setAttribute('aria-pressed', on?'true':'false');
  document.getElementById('tutorToggle').checked = on;
  if (!on){ Tutor.stop(); clearHints(); }
  else { applyHint(); }
  renderGuide();
}

/* ---------- tabs -------------------------------------------------------- */
function wireTabs(){
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector('.panel[data-panel="'+tab.dataset.tab+'"]').classList.add('active');
    });
  });
  document.querySelectorAll('.out-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.out-tab').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.out-tab').forEach(x=>x.classList.remove('active'));
      tab.classList.add('active');
      App.outTab = tab.dataset.out;
      renderOut();
    });
  });
}

/* ---------- guide list --------------------------------------------------- */
function buildModeList(){
  const order = ['basic_atc','advanced_atc','scanning','multilambda','ratio','difference',
                 'ptnet','stdcurve','kinetics','water','cellcorr','pv','utility'];
  const host = document.getElementById('modeList');
  host.innerHTML = order.map(id=>{
    const T = Tutorials[id];
    return '<button class="mode-btn" data-tut="'+id+'"><span class="mn">'+t(T.title)+
           '</span><span class="mi">'+T.icon+'</span></button>';
  }).join('');
  host.querySelectorAll('.mode-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      setTutor(true);
      Tutor.start(b.dataset.tut);
      render();
    });
  });
}

/* ---------- carousel ----------------------------------------------------- */
function renderCarousel(){
  const host = document.getElementById('carousel');
  const ids = ['B','1','2','3','4','5'];
  const allowed=currentHolderCells();
  host.innerHTML = ids.map(c=>{
    const cell = App.cells[c];
    const isBlank = cell.sol==='water' || cell.sol===null;
    const kind = cell.kind;
    const shape = kind==='vial'
      ? '<span class="vial'+(isBlank?'':' filled')+'"></span>'
      : '<span class="cuv2" style="--fill:'+(isBlank?'transparent':fillColor(cell))+'"></span>';
    const conc = isBlank ? '' : fx(cell.conc,2);
    return '<button class="cellcard'+(c===App.beamCell?' in-beam':'')+'" data-c="'+c+'">'+
      '<div class="cn">'+(c==='B'? t('c_posB') : t('r_cell')+' '+c)+'</div>'+
      '<div class="cv">'+shape+'</div>'+
      '<div class="cm">'+cellLabel(c)+'</div>'+
      (conc? '<div class="cc">'+conc+'</div>':'')+
      '</button>';
  }).join('');
  host.querySelectorAll('.cellcard').forEach(b=>{
    b.disabled=!allowed.includes(b.dataset.c);
    b.addEventListener('click', ()=>{ if(selectCell(b.dataset.c)) openPicker(b.dataset.c); });
  });
  document.querySelectorAll('[data-cell]').forEach(e=>{
    const c = e.dataset.cell;
    e.disabled=!allowed.includes(c);
    e.classList.toggle('has-sample', !(App.cells[c].sol==='water'||App.cells[c].sol===null));
    e.classList.toggle('is-blank', App.cells[c].sol==='water'||App.cells[c].sol===null);
    e.classList.toggle('in-beam', c===App.beamCell);
  });
}
function fillColor(cell){
  const m = METHOD_BY_ID[cell.sol];
  const s = SOL_BY_ID[cell.sol];
  const n = cell.conc * (1/(s&&s.slope ? s.slope : 1));
  const hue = m ? m.lambda : (s?s.lambda||500:500);
  const light = 20 + Math.min(45, n*45);
  const sat = 55 + Math.min(35, n*35);
  return 'hsl('+hue+', '+sat+'%, '+light+'%)';
}

let pickerCell = '1';
function openPicker(c){
  pickerCell = c;
  const p = document.getElementById('picker');
  p.hidden = false;
  document.getElementById('pickerTitle').textContent = (c==='B'? t('c_posB') : t('r_cell')+' '+c);
  const sel = document.getElementById('selMethod');
  sel.innerHTML = ['water'].concat(METHODS.map(m=>m.id), SOLUTIONS.filter(s=>!s.blank).map(s=>s.id))
    .map(id=>{
      const m = METHOD_BY_ID[id], s = SOL_BY_ID[id];
      const nm = m ? (App.lang==='es'? m.nameEs : m.name) : (s ? (App.lang==='es'? s.nameEs : s.name) : id);
      return '<option value="'+id+'"'+(App.cells[c].sol===id?' selected':'')+'>'+nm+'</option>';
    }).join('');
  const cur = App.cells[c];
  const sol = SOL_BY_ID[cur.sol] || (METHOD_BY_ID[cur.sol]&&{maxConc:METHOD_BY_ID[cur.sol].maxConc});
  const max = (sol && (sol.maxConc!==undefined? sol.maxConc : (sol.concRange?sol.concRange[1]:10))) || 10;
  const rng = document.getElementById('rngConc');
  rng.max = Math.round(max*20);
  rng.value = Math.min(rng.max, Math.round((cur.conc/max)*rng.max));
  updateConcOut();
  document.getElementById('lblMethod').textContent = t('methodLabel');
  document.getElementById('lblConc').textContent = t('concLabel');
  document.getElementById('btnFillCell').textContent = t('placeInCell');
}
function wirePicker(){
  document.getElementById('pickerClose').addEventListener('click', ()=>{
    document.getElementById('picker').hidden = true;
  });
  document.getElementById('selMethod').addEventListener('change', updateConcOut);
  document.getElementById('rngConc').addEventListener('input', updateConcOut);
  document.getElementById('btnFillCell').addEventListener('click', ()=>{
    const c = pickerCell;
    const id = document.getElementById('selMethod').value;
    const max = concMax(id);
    const frac = parseFloat(document.getElementById('rngConc').value) /
                 parseFloat(document.getElementById('rngConc').max);
    App.cells[c].sol = id;
    App.cells[c].conc = Math.round(frac*max*1000)/1000;
    App.cells[c].kind = (id==='water') ? (c==='B'?'vial':'square') : (c==='4'?'longpath':(c==='B'?'vial':'square'));
    logEvent('Cell '+c+' ← '+cellLabel(c));
    document.getElementById('picker').hidden = true;
    renderCarousel(); render();
  });
}
function concMax(id){
  const m = METHOD_BY_ID[id], s = SOL_BY_ID[id];
  if (m) return m.maxConc;
  if (s && s.concRange) return s.concRange[1];
  return 10;
}
function updateConcOut(){
  const id = document.getElementById('selMethod').value;
  const rng = document.getElementById('rngConc');
  const val = (parseFloat(rng.value)/parseFloat(rng.max))*concMax(id);
  const m = METHOD_BY_ID[id], s = SOL_BY_ID[id];
  const unit = m? m.unit : (s? s.unit : '');
  document.getElementById('outConc').textContent = fx(val,3)+' '+unit;
}

/* ---------- screen reference --------------------------------------------- */
function renderScreenRef(){
  const items = [
    ['mainmenu','mainmenu','u_selItem'],
    ['m_utility','u_utility','u_selItem'],
    ['u_datetime','u_datetime','u_setDate'],
    ['u_storedDir','u_storedDir','k_selectTest'],
    ['e_calculator','e_calculator','—'],
    ['m_atc_basic','m_atc_basic','p_wavelength'],
    ['m_atc_adv','m_atc_adv','p_refCorr'],
    ['m_scan','m_scan','k_collectBaseline'],
    ['m_multi','m_multi','k_setNms'],
    ['m_ratio','m_ratio','p_wl1'],
    ['m_diff','m_diff','Factor 1'],
    ['m_ptnet','m_ptnet','p_wl3'],
    ['m_stdcurve','m_stdcurve','k_runStandard'],
    ['m_kinetics','m_kinetics','p_intervalTime'],
    ['m_water','m_water','p_reverseColor'],
    ['m_cellcorr','m_cellcorr','k_runCorr'],
    ['m_pv','m_pv','k_startTest']
  ];
  document.getElementById('screenList').innerHTML = items.map(([a,b,c])=>
    '<div class="scr-item"><div class="sn">'+t(a)+'</div><div class="sd">'+
    (t(b)===t(c)? t(b) : t(b)+' → '+t(c))+'</div></div>').join('');
}

/* ---------- output ------------------------------------------------------- */
function renderOut(){
  const box = document.getElementById('outbox');
  if (App.outTab==='print'){
    box.innerHTML = App.printout.slice(-60).map(l=>
      l? esc(l) : '<span class="dim">────────────────────────────────────────</span>').join('\n');
    box.scrollTop = box.scrollHeight;
  } else if (App.outTab==='log'){
    box.innerHTML = App.log.slice(-80).map(esc).join('\n');
    box.scrollTop = box.scrollHeight;
  } else if (App.outTab==='data'){
    box.innerHTML = App.savedData.slice(-50).map(r=>
      esc(r.date+' '+r.time+'  '+r.fileName+'  '+r.test+'  Cell '+r.cell+'  '+r.result+(r.units?' '+r.units:''))
    ).join('\n') || esc(t('e_noSavedData'));
    box.scrollTop = box.scrollHeight;
  } else {
    box.innerHTML = helpText();
  }
}
function esc(s){ return String(s).replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }
function helpText(){
  const rows = App.lang==='es' ? [
    ['0 – 9 . −','Escriben el valor en la ventana Entry'],
    ['↑ / ↓','Mueven el resaltado entre parámetros'],
    ['Enter','Abre la ventana Entry o acepta la selección'],
    ['Esc','Regresa a la pantalla anterior'],
    ['clear','Borra el valor que se está escribiendo'],
    ['test','Vuelve al Menú Principal'],
    ['utility','Abre el menú Utility'],
    ['F1 – F4','Teclas de función; su etiqueta aparece en la parte inferior del LCD'],
    ['B, 1 – 5','Posiciones del carrusel de celdas'],
    ['t / u / p','Atajos de teclado para test, utility y print']
  ] : [
    ['0 – 9 . −','Type a value in the Entry window'],
    ['↑ / ↓','Move the selection between parameters'],
    ['Enter','Open the Entry window or accept a selection'],
    ['Esc','Return to the previous screen'],
    ['clear','Clear the value being entered'],
    ['test','Return to the Main Menu'],
    ['utility','Open the Utility menu'],
    ['F1 – F4','Function keys; labels appear along the bottom of the LCD'],
    ['B, 1 – 5','Cell carousel positions'],
    ['t / u / p','Keyboard shortcuts for test, utility and print']
  ];
  return rows.map(r=>'<span class="hl">'+esc(r[0].padEnd(14))+'</span>'+esc(r[1])).join('\n');
}

/* ---------- language ----------------------------------------------------- */
function setLang(l){
  App.lang = l;
  App.util.lang = l==='en' ? 'English' : 'Español';
  document.documentElement.lang = l;
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active', b.dataset.lang===l));
  document.getElementById('brandSub').textContent = t('brandSub');
  document.getElementById('kbdHint').textContent = t('kbdHint');
  document.getElementById('btnTutorialTxt').textContent = t('guidedMode');
  document.getElementById('btnResetTxt').textContent = t('reset');
  document.getElementById('tabGuide').textContent = t('tabGuide');
  document.getElementById('tabCar').textContent = t('tabCarousel');
  document.getElementById('tabScreen').textContent = t('tabScreen');
  document.getElementById('guideTitle').textContent = t('guideTitle');
  document.getElementById('guideToggleTxt').textContent = t('guideEnabled');
  document.getElementById('guideIntro').textContent = t('guideIntro');
  document.getElementById('modeListHead').textContent = t('walkthroughs');
  document.getElementById('carTitle').textContent = t('carTitle');
  document.getElementById('carIntro').textContent = t('carIntro');
  document.getElementById('refTitle').textContent = t('refTitle');
  document.getElementById('refIntro').textContent = t('refIntro');
  document.getElementById('otPrint').textContent = t('otPrint');
  document.getElementById('otLog').textContent = t('otLog');
  document.getElementById('otHelp').textContent = t('otHelp');
  document.getElementById('otData').textContent = t('otData');
  document.getElementById('btnExportData').textContent = t('exportData');
  document.getElementById('footNote').textContent = t('footNote');
  document.getElementById('tutorPrev').textContent = '←';
  document.getElementById('tutorNext').textContent = '→';
  buildModeList();
  paintAll();
}

/* ---------- go ----------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('beforeunload', persistSimulatorState);
window.render = render;
window.renderGuide = renderGuide;
window.renderOut = renderOut;
window.renderCarousel = renderCarousel;
window.setLang = setLang;
window.setTutor = setTutor;

})();

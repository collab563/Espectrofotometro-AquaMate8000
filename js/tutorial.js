/* =====================================================================
   tutorial.js — guided walkthroughs (student mode)
   Each step names the key that must be pressed; the simulator pulses
   that key on the panel and explains the step in the chosen language.
   ===================================================================== */

function T_(en, es){ return {en, es}; }

const Tutorials = {

basic_atc: { title:'m_atc_basic', icon:'01', steps:[
  {key:'test',    s:T_('Press the test key to open the Main Menu.','Presiona la tecla test para abrir el Menú Principal.')},
  {key:'enter',   s:T_('Basic A-%T-C is already highlighted. Press Enter to load it.',
                       'A-%T-C Básico ya está resaltado. Presiona Enter para cargarlo.')},
  {key:'down', times:2, s:T_('Move down to Wavelength and press Enter.',
                             'Baja hasta Longitud de Onda y presiona Enter.')},
  {key:'enter',   s:T_('The Entry window opens. Type 450 and press Enter to change the wavelength.',
                       'Se abre la ventana de Entrada. Escribe 450 y presiona Enter para cambiar la longitud de onda.')},
  {key:'cellB',   s:T_('Load distilled water into the blank position B (use the Carousel tab, then click position B).',
                       'Carga agua destilada en la posición de blanco B (usa la pestaña Carrusel y haz clic en la posición B).')},
  {key:'up', times:1, s:T_('Scroll back up to the Wavelength row.',
                           'Vuelve a subir hasta la fila de Longitud de Onda.'), need:{sel:2}},
  {key:'f4',      s:T_('Press Run Test (the 4th function key).','Presiona Run Test (la 4a tecla de función).')},
  {key:'f4',      s:T_('The compartment screen appears. With distilled water in B, press Measure Blank.',
                       'Aparece la pantalla de medición. Con agua destilada en B, presiona Medir Blanco.'), need:{screen:'run'}},
  {key:'cell1',   s:T_('Now load your coloured sample into cell 1 and select it in the Carousel.',
                       'Ahora carga tu muestra coloreada en la celda 1 y selecciónala en el Carrusel.')},
  {key:'f4',      s:T_('Press Measure Sample. The absorbance of your sample appears.',
                       'Presiona Medir Muestra. Aparece la absorbancia de tu muestra.'), need:{step:'sample'}},
  {key:'f1',      s:T_('Press Change Mode to switch between Absorbance, %Transmittance and Concentration.',
                       'Presiona Cambiar Modo para alternar entre Absorbancia, %Transmitancia y Concentración.')},
  {key:'esc',     s:T_('Press Esc to return to the Main Menu. That is the whole Basic A-%T-C cycle.',
                       'Presiona Esc para volver al Menú Principal. Ese es el ciclo completo de A-%T-C Básico.')}
]},

advanced_atc: { title:'m_atc_adv', icon:'02', steps:[
  {key:'test',  s:T_('Press test to reach the Main Menu.','Presiona test para llegar al Menú Principal.')},
  {key:'down',  s:T_('Move down to Advanced A-%T-C.','Baja hasta A-%T-C Avanzado.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'down',  s:T_('Move to Measurement Mode.','Baja hasta Modo de Medición.')},
  {key:'enter', s:T_('Choose Conc/Std to measure concentration against a standard.',
                     'Elige Conc/Std para medir concentración contra un estándar.')},
  {key:'down',  s:T_('Move to Conc of Standard.','Baja hasta Conc del Estándar.')},
  {key:'enter', s:T_('Enter 100 for the standard concentration and press Enter.',
                     'Escribe 100 como concentración del estándar y presiona Enter.')},
  {key:'f1',    s:T_('With a known standard loaded in cell 1, press Run Standard (function key 1).',
                     'Con un estándar conocido en la celda 1, presiona Ejecutar Estándar (tecla de función 1).'), need:{screen:'params'}},
  {key:'enter', s:T_('Enter the standard concentration and press Enter.',
                     'Escribe la concentración del estándar y presiona Enter.'), need:{screen:'entry'}},
  {key:'f4',    s:T_('Measure the blank before the standard.',
                     'Mide el blanco antes del estándar.'), need:{screen:'atc_standard'}},
  {key:'f4',    s:T_('Place the known standard in the selected cell and measure it.',
                     'Coloca el estándar conocido en la celda seleccionada y mídelo.'), need:{screen:'atc_standard'}},
  {key:'f1',    s:T_('Accept the measured standard and return to parameters.',
                     'Acepta el estándar medido y vuelve a los parámetros.'), need:{screen:'atc_standard'}},
  {key:'f4',    s:T_('Press Run Test to begin measuring samples.',
                     'Presiona Run Test para comenzar a medir muestras.'), need:{screen:'params'}},
  {key:'f4',    s:T_('Measure the blank.', 'Mide el blanco.'), need:{screen:'run'}},
  {key:'f4',    s:T_('Measure the sample to calculate its concentration.',
                     'Mide la muestra para calcular su concentración.'), need:{screen:'run',step:'sample'}},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

scanning: { title:'m_scan', icon:'03', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:2, s:T_('Move down to Scanning.','Baja hasta Barrido.')},
  {key:'enter', s:T_('Press Enter to open the Scanning parameters.','Presiona Enter para abrir los parámetros de Barrido.')},
  {key:'down',  s:T_('Move to Start Wavelength.','Baja hasta Longitud de Onda Inicial.')},
  {key:'enter', s:T_('Type 350 and press Enter.','Escribe 350 y presiona Enter.')},
  {key:'cellB', s:T_('Load distilled water into the blank position B.','Carga agua destilada en la posición de blanco B.')},
  {key:'f4',    s:T_('Press Run Test.','Presiona Run Test.')},
  {key:'f1',    s:T_('Press Collect Baseline to store the blank spectrum.',
                     'Presiona Recoger Línea Base para guardar el espectro del blanco.'), need:{screen:'scan_run'}},
  {key:'cell1', s:T_('Load a multi-peak solution (the Glass filter) into cell 1.',
                     'Carga una solución mult pico (el filtro de vidrio) en la celda 1.')},
  {key:'f4',    s:T_('Press Measure Sample to collect the sample spectrum.',
                     'Presiona Medir Muestra para recoger el espectro de la muestra.')},
  {key:'f2',    s:T_('Press Tabular to see the wavelength/absorbance table.',
                     'Presiona Tabular para ver la tabla de longitudes de onda y absorbancias.')},
  {key:'esc',   s:T_('Press Esc to return to the graph, then Esc again to the Main Menu.',
                     'Presiona Esc para volver a la gráfica y otra vez para el Menú Principal.')}
]},

multilambda: { title:'m_multi', icon:'04', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:3, s:T_('Move down to Multiwavelength.','Baja hasta Multilambda.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'f1',    s:T_('Press Set nms to list and edit the wavelengths and factors.',
                     'Presiona Fijar nms para listar y editar longitudes de onda y factores.')},
  {key:'down', times:4, s:T_('Move down to ID# (0=OFF).','Baja hasta ID# (0=OFF).'), need:{screen:'params'}},
  {key:'enter', s:T_('Enter 1 and press Enter so samples are numbered.',
                     'Escribe 1 y presiona Enter para que las muestras se numeren.')},
  {key:'f4',    s:T_('Press Run Test, then Measure Blank, then Measure Sample.',
                     'Presiona Run Test, luego Medir Blanco, luego Medir Muestra.')},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

ratio: { title:'m_ratio', icon:'05', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:4, s:T_('Move down to Absorbance Ratio.','Baja hasta Razón de Absorbancia.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'down',  s:T_('Move to Wavelength 1.','Baja hasta Longitud de Onda 1.')},
  {key:'enter', s:T_('Enter 546 and press Enter.','Escribe 546 y presiona Enter.')},
  {key:'cell1', s:T_('Load a coloured sample into cell 1.','Carga una muestra coloreada en la celda 1.')},
  {key:'f4',    s:T_('Press Run Test, Measure Blank, then Measure Sample.',
                     'Presiona Run Test, Medir Blanco y luego Medir Muestra.')},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

difference: { title:'m_diff', icon:'06', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:5, s:T_('Move down to Absorbance Difference.','Baja hasta Diferencia de Absorbancia.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'cell1', s:T_('Load a coloured sample into cell 1.','Carga una muestra coloreada en la celda 1.')},
  {key:'f4',    s:T_('Press Run Test, Measure Blank, then Measure Sample.',
                     'Presiona Run Test, Medir Blanco y luego Medir Muestra.')},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

ptnet: { title:'m_ptnet', icon:'07', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:6, s:T_('Move down to 3-Point Net.','Baja hasta 3-Punto Neto.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'enter', s:T_('Set Wavelength 1 to 350 nm.','Fija la Longitud de Onda 1 en 350 nm.'), need:{sel:1}},
  {key:'down',  s:T_('Move to Wavelength 2 and set it to 450 nm.',
                     'Baja hasta Longitud de Onda 2 y fijala en 450 nm.')},
  {key:'cell1', s:T_('Load a narrow-peak sample (blue dye) into cell 1.',
                     'Carga una muestra de pico estrecho (azul) en la celda 1.')},
  {key:'f4',    s:T_('Press Run Test, Measure Blank, then Measure Sample.',
                     'Presiona Run Test, Medir Blanco y luego Medir Muestra.')},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

stdcurve: { title:'m_stdcurve', icon:'08', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:7, s:T_('Move down to Standard Curve.','Baja hasta Curva Estándar.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'f1',    s:T_('Press Run Standard to measure each standard.',
                     'Presiona Ejecutar Estándar para medir cada estándar.'), need:{screen:'params'}},
  {key:'enter', s:T_('Enter the concentration of the standard shown on screen, then measure it.',
                     'Escribe la concentración del estándar que aparece y medilo.'), need:{screen:'std_std'}},
  {key:'down',  s:T_('Move through the list of standards, measuring each one.',
                     'Recorre la lista de estándares midiendo cada uno.'), need:{screen:'std_std'}},
  {key:'f4',    s:T_('When every standard is measured, press Start Test to see the curve.',
                     'Cuando todos los estándares estén medidos, presiona Iniciar Prueba para ver la curva.'), need:{screen:'std_std'}},
  {key:'f4',    s:T_('Press Measure Sample to read an unknown against the curve.',
                     'Presiona Medir Muestra para leer una desconocida contra la curva.'), need:{screen:'std_results'}},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

kinetics: { title:'m_kinetics', icon:'09', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:8, s:T_('Move down to Kinetics.','Baja hasta Cinemética.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'down', times:5, s:T_('Move down to Interval Time.','Baja hasta Tiempo de Intervalo.')},
  {key:'enter', s:T_('Enter 0:15 for a reading every 15 seconds.','Escribe 0:15 para una lectura cada 15 segundos.')},
  {key:'cell1', s:T_('Load a coloured sample into cell 1.','Carga una muestra coloreada en la celda 1.')},
  {key:'f4',    s:T_('Press Run Test, then Measure Blank.','Presiona Run Test y luego Medir Blanco.')},
  {key:'f4',    s:T_('Press Measure Sample and watch the absorbance build over time.',
                     'Presiona Medir Muestra y observa cómo crece la absorbancia en el tiempo.'), need:{step:'sample'}},
  {key:'f2',    s:T_('Press Manual Scale to walk the cursor through the data points.',
                     'Presiona Escala Manual para recorrer los puntos con el cursor.'), need:{screen:'kin_graph'}},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

water: { title:'m_water', icon:'10', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:9, s:T_('Move down to Water Analysis.','Baja hasta Análisis de Agua.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'down',  s:T_('Move down to Wavelength.','Baja hasta Longitud de Onda.')},
  {key:'enter', s:T_('Set the wavelength of your chosen method, for example 850 for Copper.',
                     'Fija la longitud de onda de tu método, por ejemplo 850 para Cobre.')},
  {key:'cell2', s:T_('Load the prepared reagent sample into position 2 and pick its concentration in the Carousel.',
                     'Carga la muestra de reactivo preparada en la posición 2 y elige su concentración en el Carrusel.')},
  {key:'f4',    s:T_('Press Run Test.','Presiona Run Test.')},
  {key:'f4',    s:T_('Put distilled water in B and press Measure Blank.',
                     'Pon agua destilada en B y presiona Medir Blanco.'), need:{screen:'water_run'}},
  {key:'cell2', s:T_('Select position 2 to move the Manual 3 holder to your sample.',
                     'Selecciona la posición 2 para colocar la muestra en el porta-cubetas Manual 3.'), need:{screen:'water_run',step:'sample'}},
  {key:'f4',    s:T_('Press Measure Sample to get the concentration in mg/L.',
                     'Presiona Medir Muestra para obtener la concentración en mg/L.'), need:{step:'sample'}},
  {key:'esc',   s:T_('Esc returns to the Main Menu.','Esc regresa al Menú Principal.')}
]},

cellcorr: { title:'m_cellcorr', icon:'11', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:10, s:T_('Move down to Cell Correction.','Baja hasta Corrección de Celda.')},
  {key:'enter', s:T_('Press Enter.','Presiona Enter.')},
  {key:'f1',    s:T_('Press Run Corr. to measure the configured cell-correction range.',
                     'Presiona Corr. Celda para medir el intervalo configurado de corrección.'), need:{screen:'cellcorr'}},
  {key:'esc',   s:T_('Esc returns to the Main Menu. Cell correction compensates for small differences between cuvettes.',
                     'Esc regresa al Menú Principal. La corrección de celda compensa pequeñas diferencias entre cubetas.')}
]},

pv: { title:'m_pv', icon:'12', steps:[
  {key:'test',  s:T_('Press test.','Presiona test.')},
  {key:'down', times:11, s:T_('Move down to Performance Verification.','Baja hasta Verificación de Desempeño.')},
  {key:'enter', s:T_('Press Enter to open the list of verification tests.','Presiona Enter para abrir la lista de pruebas.')},
  {key:'enter', s:T_('Open Wavelength Accuracy - Internal (xenon lines at 229, 529 and 883 nm).',
                     'Abre Exactitud de Longitud de Onda - Interna (líneas de xenón en 229, 529 y 883 nm).')},
  {key:'f1',    s:T_('Press Start Test. Results and a printed report are produced.',
                     'Presiona Iniciar Prueba. Se obtienen resultados y un informe impreso.'), need:{screen:'pv_run'}},
  {key:'esc',   s:T_('Esc twice returns to the Main Menu.','Esc dos veces regresa al Menú Principal.')}
]},

utility: { title:'u_utility', icon:'13', steps:[
  {key:'utility', s:T_('Press the utility key to open the Utility menu.','Presiona la tecla utility para abrir el menú Utilidad.')},
  {key:'down', times:3, s:T_('Move down to Date/Time Setup.','Baja hasta Configurar Fecha/Hora.')},
  {key:'enter',  s:T_('Press Enter.','Presiona Enter.')},
  {key:'down', times:3, s:T_('Move down to Set Hour.','Baja hasta Fijar Hora.')},
  {key:'enter',  s:T_('Enter a new hour and press Enter.','Escribe una nueva hora y presiona Enter.')},
  {key:'esc', s:T_('Press Esc to save. Every Utility parameter changes the instrument, not the measurement.',
                   'Presiona Esc para guardar. Cada parámetro de Utilidad cambia el instrumento, no la medición.')},
  {key:'utility', s:T_('Press utility again to return to the Utility menu.','Presiona utility otra vez para volver al menú Utilidad.')},
  {key:'esc', s:T_('Esc returns to the previous screen.','Esc regresa a la pantalla anterior.')}
]}
};

/* ---- runner ---------------------------------------------------------- */
const Tutor = {
  active: null, idx: 0, count: 0, waiting: 0,

  start(id){
    const t = Tutorials[id];
    if (!t) return;
    this.active = id; this.idx = 0; this.count = 0; this.waiting = 0;
    App.tutorMode = id;
    renderGuide();
  },
  stop(){
    this.active = null; App.tutorMode = null;
    clearHints();
    renderGuide();
  },
  cur(){ return (this.active && Tutorials[this.active].steps[this.idx]) || null; },
  stepText(){
    const s = this.cur(); if (!s) return '';
    return s.s[App.lang] || s.s.en;
  },
  next(){
    if (!this.active) return;
    const steps = Tutorials[this.active].steps;
    if (this.idx >= steps.length-1) { this.stop(); return; }
    this.idx++; this.count = 0; this.waiting = 0;
    applyHint(); renderGuide();
  },
  prev(){
    if (!this.active) return;
    this.idx = Math.max(0, this.idx-1); this.count = 0; this.waiting = 0;
    applyHint(); renderGuide();
  },
  /* returns true if the keypress was consumed by the tutorial */
  handle(keyName){
    if (!this.active) return false;
    const s = this.cur(); if (!s) return false;
    if (s.need){
      if (s.need.screen && App.screen !== s.need.screen) return false;
      if (s.need.sel !== undefined && App.sel !== s.need.sel) return false;
    }
    const want = s.key;
    const got  = keyName === 'down'||keyName==='up' ? keyName : keyName;
    if (got !== want) return false;
    const times = s.times || 1;
    this.count++;
    if (this.count >= times){ this.next(); }
    else { applyHint(); renderGuide(); }
    return true;
  }
};

/* highlight the key the student must press next */
function clearHints(){
  document.querySelectorAll('.tutor-hint').forEach(e=>e.classList.remove('tutor-hint'));
}
function applyHint(){
  clearHints();
  const s = Tutor.cur();
  if (!s || !App.tutorOn) return;
  const el = document.querySelector(s.key==='cellB'?'[data-cell="B"]'
        : s.key && s.key[0]==='c' && s.key[4] ? `[data-cell="${s.key[4]}"]`
        : `[data-key="${s.key}"]`);
  if (el){ el.classList.add('tutor-hint'); scrollIntoViewIfNeeded(el); }
}
function scrollIntoViewIfNeeded(el){
  const r = el.getBoundingClientRect();
  if (r.top < 60 || r.bottom > window.innerHeight-20) el.scrollIntoView({block:'center'});
}

function renderGuide(){
  const box = document.getElementById('tutorStep');
  const list = document.getElementById('modeList');
  if (!box || !list) return;
  if (!App.tutorOn || !Tutor.active){
    box.hidden = true; applyHint();
    list.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
    return;
  }
  box.hidden = false;
  const T = Tutorials[Tutor.active];
  document.getElementById('tutorPos').textContent = Tutor.idx+1;
  document.getElementById('tutorOf').textContent  = '/ '+T.steps.length;
  document.getElementById('tutorText').textContent = Tutor.stepText();
  const s = Tutor.cur();
  const names = {cellB:'Blank position B', cell1:'Cell 1', cell2:'Cell 2', cell3:'Cell 3',
                 cell4:'Cell 4', cell5:'Cell 5', test:'test key', utility:'utility key',
                 enter:'enter key', esc:'esc key', up:'↑ key', down:'↓ key', clear:'clear key',
                 f1:'function key 1', f2:'function key 2', f3:'function key 3', f4:'function key 4'};
  const n = (s && names[s.key]) || (s? s.key : '');
  document.getElementById('tutorWhere').innerHTML =
    n ? (App.lang==='es' ? 'Pulsa: ' : 'Press: ') + '<b>'+n+'</b>' : '';
  list.querySelectorAll('.mode-btn').forEach(b=>
    b.classList.toggle('active', b.dataset.tut===Tutor.active));
}

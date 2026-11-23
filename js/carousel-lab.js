/* Direct-mouse training scene: human hand, cuvettes, door, screw, and holder. */
const CarouselLab=(function(){
  const POSITIONS=['B','1','2','3','4','5'];
  const ANGLES={B:-90,'1':-30,'2':30,'3':90,'4':150,'5':210};
  const C={x:330,y:235,rx:122,ry:82};
  const T={
    en:{
      kicker:'DIRECT-MANIPULATION TRAINING',title:'Human arm · cell changer',
      intro:'Reach into the chamber and handle the cuvettes and holder with the mouse.',
      liveOpen:'Door open · access to cells',liveClosed:'Door closed · ready to measure',
      liveHeld:'Hand is holding a cuvette',liveNoHolder:'Cell holder is lifted',liveLoose:'Tighten the holder before measuring',
      svgTitle:'Human hand operating the six-position sample carousel',
      svgDesc:'Drag cuvettes, open the chamber, loosen the captive screw, and lift or reinstall the holder.',
      beam:'Optical beam',selected:'Selected position',held:'Held by hand',active:'ACTIVE POSITION',
      blank:'Blank position',sample:'Sample position',water:'Distilled water',empty:'Empty position',
      blankHint:'B is the reference blank. In Auto 6, the instrument measures B before samples 1 through 5.',
      sampleHint:'This cuvette is selected for the next measurement. Auto 6 advances through sample positions.',
      manualHint:'Manual positioner: select each cell here before measuring it from the LCD.',
      auto3Hint:'Auto 3 uses B as the blank, then sample positions 2 and 4.',
      manual3Hint:'Manual 3 uses B, 2, and 4. Select the cell before measuring.',
      singleHint:'Single-cell mode: load the supported position and start measurements from the LCD.',
      readyTitle:'MEASUREMENT SETUP',holderCheck:'Holder installed and secured',
      blankCheck:'Distilled water or method blank in B',sampleCheck:'Selected cell is loaded',
      orientCheck:'Clear optical faces aligned with the beam',doorCheck:'Chamber door closed',
      help:'Drag a loaded cuvette to carry it; release over an empty slot to place it. Click a slot to index it; click the held cuvette to rotate it. Double-click an empty slot to load a solution. Click the door or screw. Drag the loosened holder up, then back onto both pins.',
      doorLabel:'HINGED CHAMBER DOOR',doorOpenLabel:'Click to close chamber door',
      doorClosedLabel:'Click to open chamber door',screwLabel:'CAPTIVE THUMBSCREW',
      holderLabel:'SIX-POSITION CELL HOLDER',pinLabel:'ALIGNMENT PINS',
      beamLabel:'OPTICAL BEAM',lamp:'LAMP',detector:'DETECTOR',slotBlank:'BLANK',slotSample:'SAMPLE',
      clickHint:'Click to select · drag to move a cuvette',
      feedbackOpen:'Door open. Click a cell position to select it or drag a loaded cuvette to an empty slot.',
      feedbackClosed:'Chamber closed. The instrument is ready to measure from the selected position.',
      feedbackB:'Position B is the reference blank. Use distilled water or the method blank before measuring samples.',
      feedbackSample:'Sample position selected. Check the method and start the measurement from the instrument LCD.',
      feedbackPicked:'Cuvette lifted. Keep holding and release over an empty position to place it.',
      feedbackPlaced:'Cuvette placed. The destination is selected for measurement.',
      feedbackOccupied:'That position is occupied. Release over an empty slot or return the cuvette to its original position.',
      feedbackEmpty:'This slot is empty. Double-click it to load a solution from the Carousel panel below.',
      feedbackDoor:'Open the chamber door before reaching inside.',
      feedbackHolderMissing:'Install the cell holder before moving cuvettes.',
      feedbackScrew:'Loosen the captive thumbscrew before lifting the holder.',
      feedbackScrewLoose:'Thumbscrew loosened. Drag the holder straight up to remove it.',
      feedbackScrewTight:'Thumbscrew tightened. The holder is secured.',
      feedbackNoHolder:'The holder is lifted. Drag it back until it sits over both alignment pins.',
      feedbackAlign:'Center the holder over both alignment pins before installing it.',
      feedbackHolderRemoved:'Holder lifted from the chamber. Keep it level and align its holes with the pins.',
      feedbackHolderInstalled:'Holder seated on both alignment pins. Tighten its captive thumbscrew before closing the door.',
      feedbackNeedSecure:'Secure the holder before closing the chamber.',feedbackHandOut:'Move your hand outside the chamber before closing the door.',
      feedbackHeld:'Place the cuvette in a slot before closing the chamber.',
      feedbackReady:'Setup is ready. Start or continue the measurement from the instrument LCD.',
      feedbackCheckBlocked:'Complete the pending setup items before measuring.',
      footnote:'Training aid based on the user guide: the beam is 2 × 7 mm, with its center 8.5 mm above the cell bottom. Keep the clear faces toward the beam and use a consistent orientation. The real cell changer indexes automatically.'
    },
    es:{
      kicker:'ENTRENAMIENTO DE MANIPULACIÓN DIRECTA',title:'Brazo humano · carrusel de celdas',
      intro:'Alcanza la cámara y manipula las cubetas y el soporte con el mouse.',
      liveOpen:'Puerta abierta · acceso a las cubetas',liveClosed:'Puerta cerrada · lista para medir',
      liveHeld:'La mano sostiene una cubeta',liveNoHolder:'Portacubetas levantado',liveLoose:'Ajusta el soporte antes de medir',
      svgTitle:'Mano humana operando el carrusel de seis posiciones',
      svgDesc:'Arrastra cubetas, abre la cámara, afloja el tornillo cautivo y levanta o instala el portacubetas.',
      beam:'Haz óptico',selected:'Posición seleccionada',held:'Sostenida por la mano',active:'POSICIÓN ACTIVA',
      blank:'Posición del blanco',sample:'Posición de muestra',water:'Agua destilada',empty:'Posición vacía',
      blankHint:'B es la referencia del blanco. En Auto 6, el instrumento mide B antes de las muestras 1 a 5.',
      sampleHint:'Esta cubeta está seleccionada para la siguiente medición. Auto 6 avanza por las posiciones de muestra.',
      manualHint:'Posicionador manual: selecciona aquí cada celda antes de medirla desde la pantalla LCD.',
      auto3Hint:'Auto 3 usa B como blanco y luego las posiciones de muestra 2 y 4.',
      manual3Hint:'Manual 3 usa B, 2 y 4. Selecciona cada celda antes de medir.',
      singleHint:'Modo de una celda: carga la posición disponible e inicia la medición desde la pantalla LCD.',
      readyTitle:'PREPARACIÓN DE MEDICIÓN',holderCheck:'Portacubetas instalado y asegurado',
      blankCheck:'Agua destilada o blanco del método en B',sampleCheck:'La celda seleccionada contiene una solución',
      orientCheck:'Caras transparentes alineadas con el haz',doorCheck:'Puerta de la cámara cerrada',
      help:'Arrastra una cubeta cargada para llevarla y suéltala sobre una ranura vacía. Haz clic en una ranura para seleccionarla; haz clic en la cubeta sostenida para girarla. Doble clic en una ranura vacía para cargar solución. Haz clic en la puerta o el tornillo. Arrastra hacia arriba el soporte flojo y bájalo sobre los pasadores. Retira la mano antes de cerrar la puerta.',
      doorLabel:'PUERTA CON BISAGRA',doorOpenLabel:'Clic para cerrar la puerta',
      doorClosedLabel:'Clic para abrir la puerta',screwLabel:'TORNILLO CAUTIVO',
      holderLabel:'PORTACUBETAS DE SEIS POSICIONES',pinLabel:'PASADORES DE ALINEACIÓN',
      beamLabel:'HAZ ÓPTICO',lamp:'LÁMPARA',detector:'DETECTOR',slotBlank:'BLANCO',slotSample:'MUESTRA',
      clickHint:'Clic para elegir · arrastra la cubeta para moverla',
      feedbackOpen:'Puerta abierta. Haz clic en una posición para seleccionarla o arrastra una cubeta cargada hasta una ranura vacía.',
      feedbackClosed:'Cámara cerrada. El instrumento está listo para medir desde la posición seleccionada.',
      feedbackB:'La posición B es la referencia del blanco. Usa agua destilada o el blanco del método antes de medir las muestras.',
      feedbackSample:'Posición de muestra seleccionada. Revisa el método e inicia la medición desde la pantalla LCD.',
      feedbackPicked:'Cubeta levantada. Sigue sujetando el mouse y suéltala sobre una posición vacía.',
      feedbackPlaced:'Cubeta colocada. El destino quedó seleccionado para medir.',
      feedbackOccupied:'Esa posición está ocupada. Suelta la cubeta en una ranura vacía o devuélvela a su posición de origen.',
      feedbackEmpty:'Esta ranura está vacía. Haz doble clic para cargar una solución desde el panel Carrusel de abajo.',
      feedbackDoor:'Abre la puerta de la cámara antes de introducir la mano.',
      feedbackHolderMissing:'Instala el portacubetas antes de mover las cubetas.',
      feedbackScrew:'Afloja el tornillo cautivo antes de levantar el portacubetas.',
      feedbackScrewLoose:'Tornillo cautivo flojo. Arrastra el soporte hacia arriba para retirarlo.',
      feedbackScrewTight:'Tornillo cautivo ajustado. El portacubetas está asegurado.',
      feedbackNoHolder:'El portacubetas está levantado. Arrástralo de nuevo hasta que coincida con los dos pasadores.',
      feedbackAlign:'Centra el portacubetas sobre los dos pasadores antes de instalarlo.',
      feedbackHolderRemoved:'Portacubetas levantado. Mantenlo nivelado y alinea sus orificios con los pasadores.',
      feedbackHolderInstalled:'Portacubetas asentado en los dos pasadores. Ajusta el tornillo cautivo antes de cerrar la puerta.',
      feedbackNeedSecure:'Asegura el portacubetas antes de cerrar la cámara.',feedbackHandOut:'Retira la mano de la cámara antes de cerrar la puerta.',
      feedbackHeld:'Coloca la cubeta en una ranura antes de cerrar la cámara.',
      feedbackReady:'La preparación está lista. Inicia o continúa la medición desde la pantalla LCD.',
      feedbackCheckBlocked:'Completa los elementos pendientes antes de medir.',
      footnote:'Ayuda didáctica basada en el manual: el haz mide 2 × 7 mm y su centro está a 8.5 mm del fondo de la celda. Orienta las caras transparentes hacia el haz y conserva una orientación constante. El carrusel real indexa las celdas automáticamente.'
    }
  };
  const state={doorOpen:true,holderInstalled:true,screwTight:true,holderAligned:true,held:null,hand:{x:608,y:151},holderX:C.x,holderY:C.y,orientation:{B:0,'1':0,'2':0,'3':0,'4':0,'5':0},notice:'feedbackOpen'};
  let initialized=false,drag=null,raf=0,lastEmptyClick=null;
  const tr=function(k){const lang=T[App.lang]||T.en;return lang[k]||T.en[k]||k;};
  const el=function(id){return document.getElementById(id);};
  const esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  const isLoaded=function(c){return !!c&&c.sol!=='empty';};
  const allowed=function(){return typeof window.getAllowedCarouselPositions==='function'?window.getAllowedCarouselPositions():POSITIONS;};
  function solution(c){
    if(!isLoaded(c))return tr('empty');
    if(c.sol==='water'||c.sol===null)return tr('water');
    const m=METHOD_BY_ID[c.sol],s=SOL_BY_ID[c.sol];
    if(m)return (App.lang==='es'?m.nameEs:m.name)+(c.conc?' · '+fx(c.conc,2)+' '+m.unit:'');
    if(s)return (App.lang==='es'?s.nameEs:s.name)+(c.conc?' · '+fx(c.conc,2)+' '+s.unit:'');
    return String(c.sol);
  }
  function posName(id){return id==='B'?tr('blank'):tr('sample')+' '+id;}
  function fill(c){if(!isLoaded(c)||c.sol==='water'||c.sol===null)return '#72c5e6';return typeof window.carouselFillColor==='function'?window.carouselFillColor(c):'#c98345';}
  function pointAt(id,rotation){
    const a=(ANGLES[id]+rotation)*Math.PI/180;
    return {x:C.x+C.rx*Math.cos(a)+state.holderX-C.x,y:C.y+C.ry*Math.sin(a)+state.holderY-C.y};
  }
  function slotPoint(id){return pointAt(id,-ANGLES[App.beamCell||'B']);}
  function nearest(p,limit){
    let best=limit||52,found=null;
    POSITIONS.forEach(function(id){if(!allowed().includes(id))return;const q=slotPoint(id),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<best){best=d;found=id;}});
    return found;
  }
  function select(id){
    if(!POSITIONS.includes(id))return false;
    if(!allowed().includes(id)){state.notice='feedbackEmpty';render();return false;}
    const ok=typeof window.selectCarouselPosition==='function'?window.selectCarouselPosition(id):(App.beamCell=id,true);
    if(!ok)return false;
    state.notice=id==='B'?'feedbackB':'feedbackSample';render();animateHand(slotPoint(id));return true;
  }
  function animateHand(p){
    if(raf)cancelAnimationFrame(raf);if(drag)return;
    const from={x:state.hand.x,y:state.hand.y},to={x:p.x,y:p.y-38},start=performance.now(),duration=330;
    function step(now){if(drag)return;const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);state.hand={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e};render();if(t<1)raf=requestAnimationFrame(step);else raf=0;}
    raf=requestAnimationFrame(step);
  }
  function drawCell(id,c){
    const active=id===App.beamCell,unavailable=!allowed().includes(id),kind=c&&c.kind||'square';
    const h=kind==='longpath'?56:kind==='vial'?54:48,w=kind==='longpath'?24:kind==='vial'?22:31,y=-h/2;
    const color=fill(c),liqY=y+(kind==='vial'?14:12),orientation=state.orientation[id]||0;
    const marks=orientation===0
      ? '<path d="M'+(-w/2+4)+' '+(y+5)+'v'+(h-10)+' M'+(w/2-4)+' '+(y+5)+'v'+(h-10)+'" stroke="#e2faff" stroke-width="2"/>'
      : '<path d="M'+(-w/2+3)+' '+(y+5)+'h'+(w-6)+' M'+(-w/2+3)+' '+(y+h-5)+'h'+(w-6)+'" stroke="#ffc66b" stroke-width="2.5"/>';
    const glass=isLoaded(c)
      ? '<rect class="lab-glass" x="'+(-w/2)+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="3"/><path d="M'+(-w/2+3)+' '+(y+4)+'h'+(w-6)+'v'+(h-8)+'h'+(-(w-6))+'z" fill="'+esc(color)+'" fill-opacity=".76"/><path d="M'+(-w/2+3)+' '+liqY+' Q0 '+(liqY-4)+' '+(w/2-3)+' '+liqY+'" fill="none" stroke="#f1fcff" stroke-width="1.4"/>'+marks+'<path d="M'+(-w/2)+' '+(y+5)+'l4 -3 M'+(w/2)+' '+(y+5)+'l-4 -3" stroke="#f5fdff" stroke-width="1.4"/>'
      : '<rect x="'+(-w/2)+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="3" fill="#15212b" fill-opacity=".65" stroke="#93a8b7" stroke-width="2" stroke-dasharray="4 3"/><path d="M-7 0h14" stroke="#91a3b1" stroke-width="2"/>';
    return '<g class="lab-slot'+(active?' selected':'')+(unavailable?' unavailable':'')+'" data-part="slot" data-id="'+id+'" role="button" tabindex="0" aria-label="'+esc(posName(id)+': '+solution(c))+'"><ellipse cx="0" cy="'+(h/2+5)+'" rx="21" ry="7" fill="#05090d" opacity=".52"/><circle class="slot-outline" cx="0" cy="0" r="31" fill="'+(active?'rgba(245,178,77,.17)':'rgba(10,18,26,.43)')+'" stroke="'+(active?'#ffc56c':'#627789')+'" stroke-width="'+(active?2.6:1.4)+'"/>'+glass+'<text class="slot-label" x="0" y="'+(h/2+19)+'">'+id+'</text><text class="slot-sub" x="0" y="'+(h/2+30)+'">'+(id==='B'?tr('slotBlank'):tr('slotSample'))+'</text></g>';
  }
  function arm(){
    const a={x:780,y:28},w=state.hand,dx=w.x-a.x,dy=w.y-a.y,d=Math.max(1,Math.hypot(dx,dy));
    let nx=-dy/d,ny=dx/d;if(nx<0){nx=-nx;ny=-ny;}
    const bend=Math.max(48,Math.min(90,d*.17)),e={x:(a.x+w.x)/2+nx*bend,y:(a.y+w.y)/2+ny*bend};
    const angle=Math.atan2(-dx,dy)*180/Math.PI;
    const held=state.held;
    const cup=held?'<g class="held-cuvette" data-part="held-cup" transform="translate(0 23) rotate('+(held.orientation||0)+')"><rect x="-13" y="-25" width="26" height="50" rx="3" fill="url(#glassFill)" stroke="#e3f8ff" stroke-width="2"/><path d="M-10 -7h20v27h-20z" fill="'+esc(fill(held.cell))+'" fill-opacity=".82"/><path d="M-9 -7q9 -4 18 0" fill="none" stroke="#f1fbff" stroke-width="1.5"/><path d="'+((held.orientation||0)===0?'M-8 -21v42 M8 -21v42':'M-10 -20h20 M-10 20h20')+'" stroke="'+((held.orientation||0)===0?'#effcff':'#ffc66b')+'" stroke-width="2"/></g>':'';
    const fingers=held
      ? '<path d="M-13 17 Q-19 25 -13 32 Q-9 35 -6 28 M-5 22 Q-9 31 -3 35 Q1 36 2 29 M3 22 Q1 31 7 34 Q11 34 10 27 M10 18 Q11 26 16 27 Q20 27 17 20" fill="none" stroke="#a65f42" stroke-width="4" stroke-linecap="round"/>'
      : '<path d="M-13 15 Q-17 23 -15 34 Q-14 39 -10 38 Q-7 37 -8 32 L-7 21 M-6 17 Q-9 26 -8 36 Q-7 40 -3 39 Q0 38 -1 33 L0 21 M1 17 Q0 27 2 36 Q3 40 7 39 Q10 37 8 32 L7 20 M8 15 Q9 23 12 32 Q14 37 18 34 Q21 32 17 26 L14 14" fill="none" stroke="#f3bd91" stroke-width="4.3" stroke-linecap="round" stroke-linejoin="round"/>';
    return '<g class="lab-human-arm"><path d="M'+a.x+' '+a.y+' L'+e.x.toFixed(1)+' '+e.y.toFixed(1)+'" fill="none" stroke="#080d12" stroke-width="78" stroke-linecap="round"/><path d="M'+a.x+' '+a.y+' L'+e.x.toFixed(1)+' '+e.y.toFixed(1)+'" fill="none" stroke="url(#coat)" stroke-width="68" stroke-linecap="round"/><path d="M'+(a.x-9)+' '+(a.y+5)+' L'+(e.x-8).toFixed(1)+' '+(e.y-5).toFixed(1)+'" fill="none" stroke="#d9e6ee" stroke-opacity=".44" stroke-width="4" stroke-linecap="round"/><ellipse cx="'+e.x.toFixed(1)+'" cy="'+e.y.toFixed(1)+'" rx="35" ry="12" transform="rotate('+angle+' '+e.x.toFixed(1)+' '+e.y.toFixed(1)+')" fill="#b3cad9" stroke="#edf6fb" stroke-width="2"/><path d="M'+e.x.toFixed(1)+' '+e.y.toFixed(1)+' L'+w.x.toFixed(1)+' '+w.y.toFixed(1)+'" fill="none" stroke="#603b31" stroke-width="58" stroke-linecap="round"/><path d="M'+e.x.toFixed(1)+' '+e.y.toFixed(1)+' L'+w.x.toFixed(1)+' '+w.y.toFixed(1)+'" fill="none" stroke="url(#skin)" stroke-width="48" stroke-linecap="round"/><path d="M'+(e.x-3).toFixed(1)+' '+(e.y-12).toFixed(1)+' L'+(w.x-4).toFixed(1)+' '+(w.y-11).toFixed(1)+'" fill="none" stroke="#ffd0a7" stroke-opacity=".62" stroke-width="5" stroke-linecap="round"/><g class="lab-hand" data-part="hand" role="button" tabindex="0" aria-label="'+esc(held?'Hand holding a cuvette. Drag to a slot.':'Human hand. Drag it to reach a cuvette.')+'" transform="translate('+w.x.toFixed(1)+' '+w.y.toFixed(1)+') rotate('+angle+')">'+cup+'<path d="M-15 -2 Q-19 4 -15 13 L-12 23 Q-10 30 -3 30 L11 28 Q18 27 15 19 L11 7 Q10 1 6 -2 Z" fill="url(#skin)" stroke="#814e3d" stroke-width="1.7"/><path d="M-12 5 Q-8 0 1 2 Q8 3 9 10 L12 19 Q7 22 1 20 L-8 20" fill="none" stroke="#ffd5b3" stroke-opacity=".72" stroke-width="2"/>'+fingers+'<path d="M-13 10 Q-22 12 -23 20 Q-22 25 -17 23 L-10 17" fill="none" stroke="#a9674e" stroke-width="7" stroke-linecap="round"/><path d="M-13 10 Q-22 12 -23 20 Q-22 25 -17 23 L-10 17" fill="none" stroke="#f3bd91" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="-10" cy="37" rx="2" ry="1" fill="#ffe7d3"/><ellipse cx="-2" cy="38" rx="2" ry="1" fill="#ffe7d3"/><ellipse cx="6" cy="37" rx="2" ry="1" fill="#ffe7d3"/><ellipse cx="15" cy="32" rx="2" ry="1" fill="#ffe7d3"/></g></g>';
  }
  function markup(){
    const rotation=-ANGLES[App.beamCell||'B'],tx=(state.holderX-C.x).toFixed(1),ty=(state.holderY-C.y).toFixed(1);
    const cells=POSITIONS.map(function(id){const p=pointAt(id,0),x=p.x-state.holderX+C.x,y=p.y-state.holderY+C.y;return '<g transform="translate('+x.toFixed(1)+' '+y.toFixed(1)+')">'+drawCell(id,App.cells[id])+'</g>';}).join('');
    const screw=state.screwTight?'#73d6a4':'#edb14e';
    const holder='<g id="holderAssembly" data-part="holder" transform="translate('+tx+' '+ty+')"><ellipse class="lab-holder-hit" data-part="holder" cx="'+C.x+'" cy="'+C.y+'" rx="146" ry="100" fill="rgba(255,255,255,.012)" tabindex="0" role="button" aria-label="'+(state.holderInstalled?'Drag the holder after loosening its screw':'Drag holder onto alignment pins')+'"/><ellipse data-part="holder" cx="'+C.x+'" cy="'+(C.y+8)+'" rx="150" ry="101" fill="url(#metal)" stroke="#8398a6" stroke-width="3"/><ellipse data-part="holder" cx="'+C.x+'" cy="'+(C.y+1)+'" rx="136" ry="89" fill="#273744" stroke="#b4c1c8" stroke-opacity=".56" stroke-width="2"/><g class="lab-rotor" style="transform:rotate('+rotation+'deg)">'+cells+'</g><circle cx="'+C.x+'" cy="'+C.y+'" r="31" fill="url(#hub)" stroke="#e0eaee" stroke-width="2.4"/><circle cx="'+C.x+'" cy="'+C.y+'" r="17" fill="#748590" stroke="#d6e0e4" stroke-width="2"/><g data-part="screw" class="lab-screw-hit" tabindex="0" role="button" aria-label="'+(state.screwTight?'Loosen':'Tighten')+' captive thumbscrew"><ellipse cx="'+C.x+'" cy="'+(C.y-3)+'" rx="15" ry="20" fill="transparent"/><rect class="screw-head" x="'+(C.x-10)+'" y="'+(C.y-15)+'" width="20" height="24" rx="7" fill="'+screw+'" stroke="#f1f6f8" stroke-width="2"/><path d="M'+(C.x-6)+' '+(C.y-9)+'h12 M'+(C.x-6)+' '+(C.y-4)+'h12" stroke="#35424a" stroke-width="2"/></g><text class="scene-micro" x="'+C.x+'" y="'+(C.y+51)+'">'+tr('screwLabel')+'</text><path d="M'+(C.x-80)+' '+(C.y+73)+'l-8 16 M'+(C.x+80)+' '+(C.y+73)+'l8 16" stroke="#d8e4e9" stroke-width="6" stroke-linecap="round"/></g>';
    const pins=state.holderInstalled?'':'<ellipse class="lab-install-target" cx="'+C.x+'" cy="'+C.y+'" rx="153" ry="105"/><circle class="lab-pin-hit" data-part="pin" cx="250" cy="331" r="13" fill="#cedbe1" stroke="#708594" stroke-width="2"/><circle class="lab-pin-hit" data-part="pin" cx="410" cy="331" r="13" fill="#cedbe1" stroke="#708594" stroke-width="2"/><text class="scene-micro" x="'+C.x+'" y="365">'+tr('pinLabel')+'</text>';
    const beam='<g opacity="'+(state.doorOpen&&state.holderInstalled?'1':'.48')+'" pointer-events="none"><path d="M426 235 H545" stroke="#f1ae4b" stroke-width="4" filter="url(#beamGlow)"/><path d="M536 226 L553 235 L536 244 Z" fill="#ffe0a2"/><rect x="407" y="219" width="20" height="32" rx="5" fill="#d5a45c" stroke="#ffe2ae" stroke-width="2"/><rect x="553" y="219" width="22" height="32" rx="5" fill="#79abc9" stroke="#d1efff" stroke-width="2"/><text class="scene-micro" x="417" y="205">'+tr('lamp')+'</text><text class="scene-micro" x="564" y="205">'+tr('detector')+'</text><text class="beam-label" x="493" y="266">'+tr('beamLabel')+'</text></g>';
    const door=state.doorOpen
      ?'<g data-part="door" class="lab-door-hit" tabindex="0" role="button" aria-label="'+tr('doorOpenLabel')+'"><path d="M145 107 L89 81 Q72 76 68 94 L62 306 Q63 326 83 319 L146 286 Z" fill="url(#doorOpen)" stroke="#8aa0b1" stroke-width="3"/><path d="M130 124 L87 105 L82 293 L130 271 Z" fill="#182b39" stroke="#bed0dc" stroke-opacity=".55" stroke-width="2"/><path d="M131 139 L145 132 M131 255 L146 264" stroke="#d4e2e8" stroke-width="6" stroke-linecap="round"/><rect class="door-handle" x="72" y="186" width="14" height="43" rx="6" fill="#8ba2b2" stroke="#e1ebef" stroke-width="2"/><text class="scene-label" x="24" y="63">'+tr('doorLabel')+'</text></g>'
      :'<g data-part="door" class="lab-door-hit" tabindex="0" role="button" aria-label="'+tr('doorClosedLabel')+'"><path d="M139 89 H549 Q568 89 568 109 V333 Q568 352 548 352 H139 Q121 352 121 332 V109 Q121 89 139 89Z" fill="url(#doorClosed)" fill-opacity=".88" stroke="#bad3df" stroke-width="4"/><path d="M151 106 H536 Q548 106 548 119 V316 Q548 333 534 333 H151 Q140 333 140 318 V119 Q140 106 151 106Z" fill="#10202d" fill-opacity=".42" stroke="#e2f3f8" stroke-opacity=".46" stroke-width="2"/><path d="M531 175h15v86h-15z" class="door-handle" fill="#9eb5c2" stroke="#e4eff4" stroke-width="2"/><circle cx="537" cy="219" r="3" fill="#344654"/><text class="scene-label" x="164" y="127">'+tr('doorLabel')+'</text></g>';
    return '<defs><linearGradient id="doorOpen" x1="0" x2="1"><stop stop-color="#7590a2"/><stop offset="1" stop-color="#344958"/></linearGradient><linearGradient id="doorClosed" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#506d81"/><stop offset="1" stop-color="#253c4d"/></linearGradient><linearGradient id="metal" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#94a5ad"/><stop offset=".46" stop-color="#52636e"/><stop offset="1" stop-color="#24323c"/></linearGradient><radialGradient id="hub"><stop stop-color="#dfe9ed"/><stop offset="1" stop-color="#728793"/></radialGradient><linearGradient id="glassFill" x1="0" x2="1"><stop stop-color="#93d8ef" stop-opacity=".3"/><stop offset=".45" stop-color="#dbf8ff" stop-opacity=".7"/><stop offset="1" stop-color="#6fb3d0" stop-opacity=".42"/></linearGradient><linearGradient id="coat" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#dce9f1"/><stop offset=".48" stop-color="#8ba5b7"/><stop offset="1" stop-color="#4e697c"/></linearGradient><linearGradient id="skin" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f5c69f"/><stop offset=".48" stop-color="#dc9d78"/><stop offset="1" stop-color="#a9674e"/></linearGradient><filter id="beamGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="humanShadow" x="-.3" y="-.3" width="1.6" height="1.6"><feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#02070b" flood-opacity=".6"/></filter></defs><rect x="1" y="1" width="798" height="498" rx="14" fill="#101720"/><text class="scene-label" x="22" y="30">'+(App.lang==='es'?'CÁMARA DE MUESTRAS':'SAMPLE CHAMBER')+'</text><path d="M24 43 H776" stroke="#263746"/><path d="M70 361 Q96 337 137 340 H535 Q584 341 610 366 L586 428 H91Z" fill="#26343d" stroke="#657887" stroke-width="4"/><path d="M92 360 Q105 348 132 350 H542 Q573 352 591 371 L570 409 H107Z" fill="#121a21" stroke="#9baab2" stroke-width="2"/><path d="M110 337 L122 322 M543 338 L528 322" stroke="#d0dde2" stroke-width="7" stroke-linecap="round"/><path d="M243 329h14v10h-14z M403 329h14v10h-14z" fill="#eff5f7" stroke="#738692" stroke-width="2"/>'+pins+holder+beam+door+arm()+'<text class="scene-micro" x="406" y="461">'+tr('clickHint')+'</text>';
  }
  function checklist(){
    const c=App.cells[App.beamCell]||{},b=App.cells.B||{};
    const rows=[
      [state.holderInstalled&&state.screwTight,'holderCheck'],
      [isLoaded(b)&&(b.sol==='water'||b.sol===null),'blankCheck'],
      [isLoaded(c),'sampleCheck'],
      [!state.held&&(state.orientation[App.beamCell]||0)===0,'orientCheck'],
      [!state.doorOpen,'doorCheck']
    ];
    const done=rows.filter(function(r){return r[0];}).length;
    el('labReady').innerHTML='<ul><li class="lab-ready-title"><b>'+tr('readyTitle')+' · '+done+'/5</b></li>'+rows.map(function(r){return '<li><span class="'+(r[0]?'ok':'pending')+'">'+(r[0]?'✓':'○')+'</span><span>'+esc(tr(r[1]))+'</span></li>';}).join('')+'</ul>';
    return done===5;
  }
  function render(){
    const svg=el('labSvg');if(!svg)return;
    ['labKicker','kicker','labTitle','title','labIntro','intro','labLegendBeam','beam','labLegendSelected','selected','labLegendHeld','held','labSelectedKicker','active','labReadyHeading','readyTitle','labMouseHelp','help','labFootnote','footnote'].forEach(function(x,i,all){if(i%2===0&&el(x))el(x).textContent=tr(all[i+1]);});
    svg.setAttribute('aria-label',tr('svgTitle')+'. '+tr('svgDesc'));
    svg.innerHTML=markup();
    const id=App.beamCell||'B',cell=App.cells[id]||{sol:'empty'},positioner=App.test&&App.test.positioner||'auto6';
    el('labSelectedCell').textContent=id;el('labSelectedName').textContent=posName(id);el('labSelectedContents').textContent=solution(cell);
    el('labBeamNote').textContent=tr(positioner==='manual6'?'manualHint':positioner==='manual3'?'manual3Hint':positioner==='auto3'?'auto3Hint':positioner==='single'?'singleHint':id==='B'?'blankHint':'sampleHint');
    const live=state.held?tr('liveHeld'):!state.holderInstalled?tr('liveNoHolder'):!state.screwTight?tr('liveLoose'):state.doorOpen?tr('liveOpen'):tr('liveClosed');
    el('labLiveText').textContent=live;el('labLive').classList.toggle('warn',!!state.held||!state.holderInstalled||!state.screwTight);
    const ready=checklist(),key=state.notice|| (state.doorOpen?'feedbackOpen':'feedbackClosed');
    el('labFeedback').textContent=ready&&key==='feedbackClosed'?tr('feedbackReady'):tr(key);
    el('labFeedback').classList.toggle('warn',['feedbackDoor','feedbackHolderMissing','feedbackScrew','feedbackOccupied','feedbackNeedSecure','feedbackHandOut','feedbackAlign'].includes(key));
  }
  function log(s){if(typeof window.logCarouselEvent==='function')window.logCarouselEvent('Cell changer: '+s);}
  function pick(id){
    if(!state.doorOpen){state.notice='feedbackDoor';render();return false;}
    if(!state.holderInstalled){state.notice='feedbackHolderMissing';render();return false;}
    if(!state.screwTight){state.notice='feedbackScrew';render();return false;}
    if(state.held)return false;
    const c=App.cells[id];if(!isLoaded(c)){state.notice='feedbackEmpty';render();return false;}
    state.held={cell:Object.assign({},c),from:id,orientation:state.orientation[id]||0};
    App.cells[id]={kind:c.kind,sol:'empty',conc:0};state.notice='feedbackPicked';
    const q=slotPoint(id);state.hand={x:q.x,y:q.y-12};log('lifted cuvette from '+id);
    if(typeof window.renderCarousel==='function')window.renderCarousel();else render();return true;
  }
  function place(id){
    if(!state.held)return false;
    if(!allowed().includes(id)){state.notice='feedbackAlign';render();return false;}
    if(isLoaded(App.cells[id])&&id!==state.held.from){state.notice='feedbackOccupied';render();return false;}
    const held=state.held;App.cells[id]=Object.assign({},held.cell);
    state.orientation[id]=held.orientation||0;state.held=null;
    const q=slotPoint(id);state.hand={x:q.x,y:q.y-38};state.notice='feedbackPlaced';log('placed cuvette in '+id);
    select(id);if(typeof window.renderCarousel==='function')window.renderCarousel();else render();return true;
  }
  function toggleDoor(){
    if(state.doorOpen){
      if(state.held){state.notice='feedbackHeld';render();return;}
      if(!state.holderInstalled){state.notice='feedbackNoHolder';render();return;}
      if(!state.screwTight){state.notice='feedbackNeedSecure';render();return;}
      if(state.hand.x<590){state.notice='feedbackHandOut';render();return;}
      state.doorOpen=false;state.notice='feedbackClosed';
    }else{state.doorOpen=true;state.notice='feedbackOpen';}
    render();
  }
  function toggleScrew(){
    if(!state.doorOpen){state.notice='feedbackDoor';render();return;}
    if(!state.holderInstalled){state.notice='feedbackNoHolder';render();return;}
    state.screwTight=!state.screwTight;state.notice=state.screwTight?'feedbackScrewTight':'feedbackScrewLoose';
    log(state.screwTight?'tightened holder screw':'loosened holder screw');render();
  }
  function rotateHeld(){
    if(!state.held)return;
    state.held.orientation=state.held.orientation===0?90:0;
    state.orientation[state.held.from]=state.held.orientation;
    state.notice=state.held.orientation===0?'feedbackPlaced':'feedbackSample';render();
  }
  function toPoint(e){
    const svg=el('labSvg'),m=svg.getScreenCTM();
    if(m&&svg.createSVGPoint){const q=svg.createSVGPoint();q.x=e.clientX;q.y=e.clientY;const p=q.matrixTransform(m.inverse());return {x:p.x,y:p.y};}
    const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)*800/r.width,y:(e.clientY-r.top)*500/r.height};
  }
  function capture(e){try{el('labSvg').setPointerCapture(e.pointerId);}catch(_){}}
  function setHand(p){if(!state.doorOpen&&p.x<590){state.notice='feedbackDoor';p={x:590,y:p.y};}state.hand={x:Math.max(30,Math.min(790,p.x)),y:Math.max(54,Math.min(448,p.y))};}
  function startHolder(p){
    if(!state.doorOpen){state.notice='feedbackDoor';render();return false;}
    if(state.screwTight){state.notice='feedbackScrew';render();return false;}
    if(state.held){state.notice='feedbackHeld';render();return false;}
    drag={type:'holder',start:p,moved:false,ox:p.x-state.holderX,oy:p.y-state.holderY};return true;
  }
  function down(e){
    if(e.button!==undefined&&e.button!==0)return;
    const target=e.target.closest('[data-part]');if(!target)return;
    const type=target.dataset.part,p=toPoint(e);
    if(type==='door'){toggleDoor();e.preventDefault();return;}
    if(type==='screw'){toggleScrew();e.preventDefault();return;}
    if(type==='pin'){state.notice=state.holderInstalled?'feedbackScrew':'feedbackAlign';render();e.preventDefault();return;}
    if(type==='holder'){if(startHolder(p)){capture(e);e.preventDefault();}return;}
    if(type==='slot'){drag={type:state.held?'held-slot':'slot',id:target.dataset.id,start:p,moved:false};capture(e);e.preventDefault();return;}
    if(type==='held-cup'){drag={type:'held-cup',start:p,moved:false};capture(e);e.preventDefault();return;}
    if(type==='hand'){drag={type:'hand',start:p,moved:false};capture(e);e.preventDefault();}
  }
  function move(e){
    if(!drag)return;
    const p=toPoint(e),s=drag;
    if(!s.moved&&Math.hypot(p.x-s.start.x,p.y-s.start.y)>5){
      if(s.type==='slot'){if(!pick(s.id)){drag=null;return;}s.type='cuvette';}
      s.moved=true;
    }
    if(s.type==='holder'){
      state.holderX=Math.max(105,Math.min(650,p.x-s.ox));state.holderY=Math.max(120,Math.min(385,p.y-s.oy));
      if(s.moved){state.holderInstalled=false;state.holderAligned=false;}render();return;
    }
    if(s.type==='cuvette'||s.type==='held-slot'||s.type==='held-cup'||s.type==='hand'){setHand(p);render();}
  }
  function up(e){
    if(!drag)return;
    const s=drag,p=toPoint(e);drag=null;
    if(s.type==='holder'){
      if(!s.moved)return;
      if(Math.hypot(state.holderX-C.x,state.holderY-C.y)<=48){
        state.holderX=C.x;state.holderY=C.y;state.holderInstalled=true;state.holderAligned=true;state.screwTight=false;
        state.notice='feedbackHolderInstalled';log('seated holder on alignment pins');
      }else{state.holderInstalled=false;state.holderAligned=false;state.notice='feedbackAlign';}
      render();return;
    }
    if(s.type==='slot'&&!s.moved){const q=slotPoint(s.id);setHand({x:q.x,y:q.y-38});if(!isLoaded(App.cells[s.id])){const now=Date.now();if(lastEmptyClick&&lastEmptyClick.id===s.id&&now-lastEmptyClick.time<650){lastEmptyClick=null;if(typeof window.openCarouselCellEditor==='function')window.openCarouselCellEditor(s.id);return;}lastEmptyClick={id:s.id,time:now};}else lastEmptyClick=null;select(s.id);return;}
    if(s.type==='held-slot'&&!s.moved){place(s.id);return;}
    if(s.type==='held-cup'&&!s.moved){rotateHeld();return;}
    if(s.type==='hand'){
      const id=nearest(state.hand,58);
      if(id){if(state.held)place(id);else if(pick(id)){const q=slotPoint(id);state.hand={x:q.x,y:q.y-12};render();}}
      else render();return;
    }
    if(s.type==='cuvette'||s.type==='held-slot'||s.type==='held-cup'){
      setHand(p);const id=nearest(p,49);if(id)place(id);else render();return;
    }
    render();
  }
  function cancel(){drag=null;render();}
  function dblclick(e){
    const target=e.target.closest('[data-part="slot"]');if(!target)return;
    const id=target.dataset.id;if(!isLoaded(App.cells[id])&&typeof window.openCarouselCellEditor==='function')window.openCarouselCellEditor(id);
  }
  function key(e){
    const target=e.target.closest('[data-part]');if(!target||!(e.key==='Enter'||e.key===' '))return;
    e.preventDefault();const type=target.dataset.part;
    if(type==='slot'){const id=target.dataset.id;if(state.held)place(id);else select(id);}
    else if(type==='door')toggleDoor();else if(type==='screw')toggleScrew();
    else if(type==='hand'){const id=nearest(state.hand,58);if(id){if(state.held)place(id);else pick(id);}}
  }
  function init(){
    if(initialized)return;initialized=true;const svg=el('labSvg');
    svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',move);
    svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',cancel);
    svg.addEventListener('dblclick',dblclick);svg.addEventListener('keydown',key);
    svg.addEventListener('wheel',function(e){if(state.held){e.preventDefault();rotateHeld();}},{passive:false});
    render();
  }
  function reset(){
    if(raf)cancelAnimationFrame(raf);raf=0;drag=null;
    Object.assign(state,{doorOpen:true,holderInstalled:true,screwTight:true,holderAligned:true,held:null,hand:{x:608,y:151},holderX:C.x,holderY:C.y,orientation:{B:0,'1':0,'2':0,'3':0,'4':0,'5':0},notice:'feedbackOpen'});
    render();
  }
  return {init:init,render:render,reset:reset};
})();
window.CarouselLab=CarouselLab;

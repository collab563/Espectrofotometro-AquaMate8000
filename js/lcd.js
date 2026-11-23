/* =====================================================================
   lcd.js — 320×240 mono LCD renderer
   Reproduces the AquaMate display: reverse-video selection bar,
   header + status badge, bottom row of four function-key labels,
   line graphs and tabular views.
   ===================================================================== */

const LCD = (function(){
  const W = 320, H = 240;
  const CW = 7.2;            /* character cell width  → 44 columns */
  const CH = 13;             /* character cell height → 18 rows    */
  const COLS = Math.floor(W / CW);
  const ROWS = Math.floor(H / CH);

  const HEADER_Y = 1;
  const BADGE_Y  = 14;
  const BODY_Y   = 28;
  const BODY_ROWS= 13;
  const STATUS_Y = 203;
  const FKEY_Y   = 216;
  const FKEY_H   = 24;

  let cv, ctx, contrast = 1;

  const FONT = 'Consolas, Menlo, "DejaVu Sans Mono", "Courier New", monospace';

  function init(canvas){
    cv = canvas;
    cv.width = W; cv.height = H;
    ctx = cv.getContext('2d', { alpha:false });
    ctx.textBaseline = 'top';
    return LCD;
  }

  /* colour helpers — contrast 0..1 blends ink/bg like the real pot */
  function mix(a, b, t){
    const pa = [parseInt(a.slice(1,3),16), parseInt(a.slice(3,5),16), parseInt(a.slice(5,7),16)];
    const pb = [parseInt(b.slice(1,3),16), parseInt(b.slice(3,5),16), parseInt(b.slice(5,7),16)];
    const c = pa.map((v,i)=> Math.round(v + (pb[i]-v)*t));
    return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  function ink(){    return mix('#2b2f36', '#000000', contrast); }
  function paper(){  return mix('#efeada', '#b6b2a0', contrast); }
  function paper2(){ return mix('#e5e0cf', '#a8a494', contrast); }

  function clear(){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, paper());
    g.addColorStop(1, paper2());
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
    ctx.imageSmoothingEnabled = false;
  }

  /* --- primitives ------------------------------------------------------ */
  function rect(x,y,w,h,fill){
    ctx.fillStyle = fill; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  function frame(x,y,w,h,col){
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    x=Math.round(x)+.5; y=Math.round(y)+.5; w=Math.round(w); h=Math.round(h);
    ctx.strokeRect(x,y,w,h);
  }

  /* draw text starting at pixel x (not column) */
  function text(x, y, str, opt){
    opt = opt || {};
    ctx.save();
    ctx.font = (opt.bold===false ? '' : 'bold ') + (opt.size||12) + 'px ' + FONT;
    ctx.fillStyle = opt.color || ink();
    ctx.textAlign = opt.align || 'left';
    let cx = x;
    if (opt.align === 'center') cx = x;
    ctx.fillText(String(str), cx, y);
    ctx.restore();
  }

  /* draw a string on the character grid, one char per cell */
  function cell(col, row, str, opt){
    opt = opt || {};
    const s = String(str);
    for (let i=0;i<s.length;i++){
      const ch = s[i];
      if (ch === ' ') continue;
      const cx = (col+i)*CW + CW/2;
      ctx.save();
      ctx.font = (opt.bold===false?'':'bold ') + (opt.size||12) + 'px ' + FONT;
      ctx.textAlign='center';
      ctx.fillStyle = opt.color || ink();
      ctx.fillText(ch, cx, row*CH + (opt.dy||1));
      ctx.restore();
    }
  }
  function cellLen(str){ return String(str).length; }

  /* reverse-video bar spanning a grid row, then optional text on it */
  function bar(row, str, opt){
    opt = opt || {};
    const w = (opt.len !== undefined ? opt.len : cellLen(str)) * CW;
    const x = opt.col !== undefined ? opt.col*CW : 0;
    rect(x, row*CH, w, CH, ink());
    if (str) cell(opt.col||0, row, str, {color: paper(), bold: opt.bold, size: opt.size});
  }

  /* --- screen furniture ------------------------------------------------ */
  function header(title, right){
    cell(0,0,title,{size:12});
    if (right){
      const w = cellLen(right)*CW;
      cell(COLS - cellLen(right), 0, right, {size:12});
    }
  }
  function badge(text, opts){
    if (!text) return;
    opts = opts || {};
    const textCol = COLS - cellLen(text) - (opts.rightPad || 0);
    /* Leave room for the first glyph's overhang so its black highlight is
       continuous from the very first letter (notably the B in BLANK). */
    const x = Math.max(0, textCol*CW - 4);
    rect(x, BADGE_Y, W - x, CH, ink());
    cell(textCol, 1, text, {color:'#ffffff'});
  }
  function status(str){
    text(0, STATUS_Y, str, {size:12});
  }
  function fkeys(list){
    if (typeof App !== 'undefined') App.lastFkeys = list || [];
    /* Clear old function-key captions before drawing the new footer. */
    ctx.fillStyle=paper(); ctx.fillRect(0,FKEY_Y,W,H-FKEY_Y);
    const footerY=FKEY_Y;
    const footerH=FKEY_H;
    frame(0, footerY, W, footerH, ink());
    const bw = W/4;
    for (let i=0;i<4;i++){
      if (i>0) ctx.fillStyle=ink(), ctx.fillRect(Math.round(i*bw), footerY, 1, footerH);
      const lab = list && list[i];
      if (!lab) continue;
      const words = String(lab).split(/\s+/);
      /* up to two lines; wrap to a second line if the label is long */
      const keepNmsTogether = /\bnms\b/i.test(String(lab));
      let l1 = keepNmsTogether ? String(lab) : words[0];
      let l2 = keepNmsTogether ? '' : words.slice(1).join(' ');
      const maxc = Math.floor((bw-4)/CW);
      if (l1.length > maxc){ l1 = String(lab).slice(0,maxc); l2=''; }
      if (l2.length > maxc) l2 = l2.slice(0,maxc);
      if (!l2 && String(lab).length > maxc && words.length>1){
        l1 = words.slice(0,2).join(' ').slice(0,maxc);
        l2 = words.slice(2).join(' ').slice(0,maxc);
      }
      const cx = i*bw + bw/2;
      ctx.save(); ctx.font='bold 11px '+FONT; ctx.textAlign='center';
      ctx.fillStyle=ink(); ctx.textBaseline='top';
      ctx.fillText(l1, cx, footerY+(l2?1:6));
      if (l2) ctx.fillText(l2, cx, footerY+12);
      ctx.restore();
    }
  }

  /* two-line entry / popup panel drawn over the body */
  function popup(title, lines){
    const h = 16 + lines.length*CH + 8;
    const y = BODY_Y + 26;
    ctx.save();
    ctx.fillStyle = paper();
    ctx.fillRect(6, y, W-12, h);
    ctx.strokeStyle = ink(); ctx.lineWidth = 2;
    ctx.strokeRect(7.5, y+1.5, W-15, h-3);
    ctx.restore();
    cell(1, Math.round((y)/CH)+1, title, {size:11});
    let r = Math.round(y/CH)+2;
    lines.forEach(l=>{ cell(2, r, l); r++; });
  }

  /* Numeric entry panel follows the instrument guide: a two-line box at
     the bottom of the LCD, with the live entry on the first line. */
  function entryPopup(entryLine, prompt){
    const x=2, y=174, w=W-4, h=36;
    ctx.save();
    ctx.fillStyle=paper();
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=ink(); ctx.lineWidth=2;
    ctx.strokeRect(x+1,y+1,w-2,h-2);
    ctx.lineWidth=1;
    ctx.strokeRect(x+4.5,y+4.5,w-8,h-8);
    ctx.restore();
    const prefix='Entry: ';
    const value=entryLine.slice(prefix.length);
    const active=value?value.length-1:0;
    const activeCol=2+prefix.length+active;
    cell(2,14,prefix+(value?value.slice(0,-1):''),{dy:-3});
    rect(activeCol*CW,14*CH-4,CW,CH,ink());
    if(value) cell(activeCol,14,value.slice(-1),{color:paper(),dy:-3});
    cell(2,15,prompt,{dy:-3});
  }

  /* --- list rows ------------------------------------------------------- */
  /* rows: [{label, value, hi, right}] rendered with optional selection bar */
  function rows(list, startRow){
    const r0 = startRow !== undefined ? startRow : 2;
    list.forEach((rw,i)=>{
      const row = r0 + i;
      const text = (rw.label===undefined?'':String(rw.label));
      const val  = (rw.value===undefined?'':String(rw.value));
      if (rw.hi){
        const txt = text + ' '.repeat(Math.max(1, COLS - text.length - val.length)) + val;
        rect(0, row*CH, W, CH, ink());
        cell(0, row, txt.slice(0, COLS), {color:paper()});
      } else {
        cell(0, row, text.slice(0, COLS - val.length - 1));
        if (val) cell(COLS - val.length, row, val);
      }
    });
  }

  /* --- line graph ------------------------------------------------------ */
  /* spec: {x0,x1,y0,y1, xlabel, ylabel, points:[{x,y}], cursor, scale} */
  function graph(spec){
    const padL = 34, padR = 8, padT = 28, padB = 36;
    const gx = padL, gy = padT;
    const gw = W - padL - padR, gh = (FKEY_Y-8) - padT - padB;
    const {x0,x1,y0,y1} = spec;
    const sx = v => gx + (v-x0)/(x1-x0 || 1) * gw;
    const sy = v => gy + gh - (v-y0)/(y1-y0 || 1) * gh;

    /* axes */
    ctx.strokeStyle = ink(); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx-.5, gy); ctx.lineTo(gx-.5, gy+gh+.5); ctx.lineTo(gx+gw, gy+gh+.5);
    ctx.stroke();

    /* y ticks */
    ctx.font='bold 10px '+FONT; ctx.fillStyle=ink(); ctx.textAlign='right';
    const yTicks = 4;
    for (let i=0;i<=yTicks;i++){
      const v = y0 + (y1-y0)*i/yTicks;
      const yy = Math.round(sy(v))+.5;
      ctx.beginPath(); ctx.moveTo(gx-4, yy); ctx.lineTo(gx-1, yy); ctx.stroke();
      ctx.fillText(fmtTick(v), gx-6, yy-5);
    }
    /* x ticks */
    ctx.textAlign='center';
    const xTicks = 4;
    for (let i=0;i<=xTicks;i++){
      const v = x0 + (x1-x0)*i/xTicks;
      const xx = Math.round(sx(v))+.5;
      ctx.beginPath(); ctx.moveTo(xx, gy+gh); ctx.lineTo(xx, gy+gh+4); ctx.stroke();
      ctx.fillText(fmtTick(v), xx, gy+gh+6);
    }
    /* axis labels */
    ctx.fillText(spec.xlabel||'', gx+gw/2, gy+gh+17);
    ctx.save(); ctx.translate(11, gy+gh/2); ctx.rotate(-Math.PI/2);
    ctx.fillText(spec.ylabel||'A', 0,0); ctx.restore();

    /* series */
    const pts = spec.points || [];
    if (pts.length>1){
      ctx.strokeStyle = ink(); ctx.lineWidth=1; ctx.beginPath();
      pts.forEach((p,i)=>{ const X=sx(p.x), Y=sy(p.y); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); });
      ctx.stroke();
    }
    /* standards markers */
    if (spec.stds) spec.stds.forEach(s=>{
      const X=sx(s.x), Y=sy(s.y);
      ctx.fillStyle=ink(); ctx.beginPath(); ctx.arc(X,Y,2.6,0,7); ctx.fill();
    });
    /* fit line */
    if (spec.fit){
      ctx.save(); ctx.setLineDash([3,3]);
      ctx.strokeStyle=ink(); ctx.beginPath();
      ctx.moveTo(sx(x0), sy(spec.fit(x0)));
      ctx.lineTo(sx(x1), sy(spec.fit(x1)));
      ctx.stroke(); ctx.restore();
    }
    /* cursor */
    if (spec.cursor !== undefined && spec.cursor !== null){
      const X = Math.round(sx(spec.cursor))+.5;
      ctx.save(); ctx.setLineDash([2,2]); ctx.strokeStyle=ink(); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(X, gy-4); ctx.lineTo(X, gy+gh); ctx.stroke(); ctx.restore();
      ctx.fillStyle=ink(); ctx.fillRect(X-3, gy-8, 7, 5);
    }
  }

  function fmtTick(v){
    const a = Math.abs(v);
    if (a>=100) return String(Math.round(v));
    if (a>=10)  return v.toFixed(1);
    if (a>=1)   return v.toFixed(2);
    if (a>=0.01)return v.toFixed(3);
    return v.toFixed(4);
  }

  /* --- tabular view ---------------------------------------------------- */
  function table(cols, data, startRow){
    const widths = cols.map(c=>c.w||10);
    let r = startRow;
    cols.forEach((c,i)=> cellAt(xOffset(widths,i), r, c.label));
    r++;
    data.forEach(row=>{
      row.forEach((v,i)=> cellAt(xOffset(widths,i), r, v));
      r++;
    });
  }
  function xOffset(widths,i){
    let x=1; for(let k=0;k<i;k++) x += widths[k]*CW;
    return x;
  }
  function cellAt(px, row, str){ cell(px/CW, row, str); }

  /* --- small helpers --------------------------------------------------- */
  function hLine(y){ rect(0,y,W,1,ink()); }
  function vLine(x){ rect(x,0,1,H,ink()); }
  function setContrast(v){ contrast = Math.max(0,Math.min(1,v)); }

  /* scanline / pixel-grid overlay for LCD realism */
  function texture(){
    ctx.save();
    ctx.globalAlpha = .05; ctx.fillStyle='#000';
    for (let y=0;y<H;y+=2) ctx.fillRect(0,y,W,1);
    ctx.restore();
  }

  return { init, clear, text, cell, cellLen, bar, header, badge, status, fkeys,
           popup, entryPopup, rows, graph, table, rect, frame, texture, hLine, vLine,
           setContrast, ink, paper, mix, fmtTick,
           W:W, H:H, CW:CW, CH:CH, COLS:COLS, ROWS:ROWS, BODY_Y:BODY_Y,
           BODY_ROWS:BODY_ROWS, STATUS_Y:STATUS_Y, FKEY_Y:FKEY_Y };
})();

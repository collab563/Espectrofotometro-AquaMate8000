/* =====================================================================
   data — solution library, spectra, units, presets
   Spectra are modelled as sums of Gaussian bands (physically reasonable
   for the reagent complexes used in the Thermo water-analysis methods).
   ===================================================================== */

const UNITS = ['C','μg/L','ppm','M/L','ppb','mM/L','g/L','IU','mg/L','pM/μL','mg/mL','ng/μL','%'];

/* ---- Gaussian helper -------------------------------------------------- */
function gauss(x, c, h, w){ return h * Math.exp(-4*Math.LN2*Math.pow((x-c)/w,2)); }

/* ---- Water-analysis method library ------------------------------------ */
const METHODS = [
  {
    id:'chlorine_free', name:'Chlorine, Free', nameEs:'Cloro, Libre',
    lambda:535, unit:'mg/L', B:0.49, reverse:false, uv:false,
    peaks:[{c:535,h:1.00,w:95}], base:0.004,
    maxConc:10, protocol:'DPD colorimetric'
  },
  {
    id:'chlorine_total', name:'Chlorine, Total', nameEs:'Cloro, Total',
    lambda:535, unit:'mg/L', B:0.49, reverse:false, uv:false,
    peaks:[{c:535,h:1.00,w:95},{c:410,h:0.06,w:70}], base:0.004,
    maxConc:10, protocol:'DPD colorimetric'
  },
  {
    id:'copper', name:'Copper', nameEs:'Cobre',
    lambda:850, unit:'mg/L', B:18.6, reverse:false, uv:false,
    peaks:[{c:850,h:1.00,w:120}], base:0.003,
    maxConc:5, protocol:'Cuprizone'
  },
  {
    id:'iron_total', name:'Iron, Total', nameEs:'Hierro, Total',
    lambda:508, unit:'mg/L', B:131.0, reverse:false, uv:false,
    peaks:[{c:508,h:1.00,w:88}], base:0.004,
    maxConc:4, protocol:'1,10-Phenanthroline'
  },
  {
    id:'manganese', name:'Manganese', nameEs:'Manganeso',
    lambda:525, unit:'mg/L', B:15.5, reverse:false, uv:false,
    peaks:[{c:525,h:1.00,w:92}], base:0.004,
    maxConc:6, protocol:'Periodate oxidation'
  },
  {
    id:'nitrate', name:'Nitrate as N', nameEs:'Nitrato como N',
    lambda:220, unit:'mg/L', B:0.75, reverse:false, uv:true,
    peaks:[{c:220,h:1.00,w:70}], base:0.006,
    maxConc:20, protocol:'UV nitrate screening'
  },
  {
    id:'nitrite', name:'Nitrite as N', nameEs:'Nitrito como N',
    lambda:540, unit:'mg/L', B:4.6, reverse:false, uv:false,
    peaks:[{c:540,h:1.00,w:84}], base:0.004,
    maxConc:4, protocol:'Sulfanilic acid'
  },
  {
    id:'phosphate', name:'Phosphate as P', nameEs:'Fosfato como P',
    lambda:880, unit:'mg/L', B:28.9, reverse:false, uv:false,
    peaks:[{c:880,h:1.00,w:110}], base:0.003,
    maxConc:8, protocol:'Ascorbic acid / molybdate'
  },
  {
    id:'sulfate', name:'Sulfate', nameEs:'Sulfato',
    lambda:420, unit:'mg/L', B:22.7, reverse:false, uv:false,
    peaks:[{c:420,h:1.00,w:82}], base:0.004,
    maxConc:60, protocol:'Turbidimetric'
  },
  {
    id:'alkalinity', name:'Alkalinity as CaCO3', nameEs:'Alcalinidad como CaCO3',
    lambda:510, unit:'mg/L', B:0.31, reverse:false, uv:false,
    peaks:[{c:510,h:1.00,w:90}], base:0.004,
    maxConc:250, protocol:'Bromocresol green'
  },
  {
    id:'calcium', name:'Calcium as Ca', nameEs:'Calcio como Ca',
    lambda:600, unit:'mg/L', B:0.42, reverse:false, uv:false,
    peaks:[{c:600,h:1.00,w:86}], base:0.003,
    maxConc:120, protocol:'OCPC complexone'
  },
  {
    id:'magnesium', name:'Magnesium as Mg', nameEs:'Magnesio como Mg',
    lambda:530, unit:'mg/L', B:38.5, reverse:false, uv:false,
    peaks:[{c:530,h:1.00,w:84}], base:0.004,
    maxConc:40, protocol:'OCPC complexone'
  },
  {
    id:'chloride', name:'Chloride', nameEs:'Cloruro',
    lambda:540, unit:'mg/L', B:0.21, reverse:false, uv:false,
    peaks:[{c:540,h:1.00,w:78}], base:0.004,
    maxConc:250, protocol:'Mercuric thiocyanate'
  },
  {
    id:'fluoride', name:'Fluoride', nameEs:'Fluoruro',
    lambda:620, unit:'mg/L', B:2.35, reverse:false, uv:false,
    peaks:[{c:620,h:1.00,w:88}], base:0.003,
    maxConc:5, protocol:'Zirconium fluoride blue'
  },
  {
    id:'cyanide', name:'Cyanide', nameEs:'Cianuro',
    lambda:510, unit:'mg/L', B:0.94, reverse:false, uv:false,
    peaks:[{c:510,h:1.00,w:92}], base:0.004,
    maxConc:3, protocol:'Iso-pyridine-barbituric acid'
  },
  {
    id:'silica', name:'Silica as SiO2', nameEs:'Sílice como SiO2',
    lambda:630, unit:'mg/L', B:19.4, reverse:false, uv:false,
    peaks:[{c:630,h:1.00,w:105}], base:0.003,
    maxConc:30, protocol:'Molybdosilicate'
  },
  {
    /* ---- reverse-colour methods (negative slope) ---- */
    id:'cod', name:'Chemical Oxygen Demand', nameEs:'Demanda Química de Oxígeno',
    lambda:620, unit:'mg/L', B:-2857, reverse:true, rgntBlank:true, uv:false,
    peaks:[{c:620,h:1.00,w:130}], base:0.030,
    maxConc:1000, protocol:'Dichromate (reverse colour)'
  },
  {
    id:'permanganate', name:'Permanganate Index', nameEs:'Índice de Permanganato',
    lambda:525, unit:'mg/L', B:-111, reverse:true, rgntBlank:true, uv:false,
    peaks:[{c:525,h:1.00,w:120}], base:0.025,
    maxConc:60, protocol:'KMnO4 (reverse colour)'
  },
  {
    id:'tannin', name:'Tannin', nameEs:'Tanino',
    lambda:450, unit:'mg/L', B:-25, reverse:true, rgntBlank:true, uv:false,
    peaks:[{c:450,h:1.00,w:145}], base:0.020,
    maxConc:10, protocol:'NaNO2 + acid (reverse colour)'
  }
];

const METHOD_BY_ID = {};
METHODS.forEach(m => METHOD_BY_ID[m.id] = m);

/* ---- generic teaching solutions (for A-%T-C / scan / kinetics) -------- */
const SOLUTIONS = [
  {
    id:'water', name:'Distilled water', nameEs:'Agua destilada', blank:true,
    lambda:null, unit:'mg/L', peaks:[], base:0, concRange:[0,0]
  },
  {
    id:'perm_bottle', name:'Permanganate solution', nameEs:'Solución de permanganato',
    generic:true, unit:'mg/L', peaks:[{c:525,h:1.00,w:110}], base:0.002,
    lambda:525, factor:2.86, concRange:[0,2.5], slope:0.35
  },
  {
    id:'dye_blue', name:'Blue dye solution', nameEs:'Solución de azul',
    generic:true, unit:'mg/L', peaks:[{c:610,h:1.00,w:130}], base:0.002,
    lambda:610, factor:8.4, concRange:[0,3], slope:0.119
  },
  {
    id:'dye_red', name:'Red dye solution', nameEs:'Solución de rojo',
    generic:true, unit:'mg/L', peaks:[{c:490,h:1.00,w:115}], base:0.002,
    lambda:490, factor:9.1, concRange:[0,3], slope:0.110
  },
  {
    id:'filter', name:'Glass filter', nameEs:'Filtro de vidrio',
    generic:true, unit:'A', peaks:[
      {c:345,h:0.30,w:22},{c:385,h:0.12,w:30},{c:415,h:0.34,w:14},
      {c:465,h:0.13,w:26},{c:525,h:0.70,w:20},{c:580,h:0.11,w:24}
    ], base:0.01, lambda:415, factor:1, concRange:[0,1], slope:1
  },
  {
    id:'beer', name:'Beer sample', nameEs:'Muestra de cerveza',
    generic:true, unit:'mg/L', peaks:[{c:430,h:1.00,w:180},{c:660,h:0.55,w:110}], base:0.02,
    lambda:430, factor:3.2, concRange:[0,3], slope:0.31
  },
  {
    id:'protein', name:'Protein solution', nameEs:'Solución de proteína',
    generic:true, unit:'mg/L', peaks:[{c:280,h:1.00,w:60},{c:205,h:0.62,w:40}], base:0.004,
    lambda:280, factor:1.9, concRange:[0,2.5], slope:0.53, uv:true
  }
];

const SOL_BY_ID = {};
SOLUTIONS.forEach(s => SOL_BY_ID[s.id] = s);

/* ---- cuvette / cell-holder styles for the 8000 ----------------------- */
/* The 8000 ships with a holder for a vial, a 10 mm square cuvette and
   rectangular long-path cuvettes, plus 6-position and single holders.   */
const HOLDER_KINDS = ['vial','square','longpath'];

/* sample positioner options (from the Parameters chapter) */
const POSITIONERS = [
  {id:'auto6',   label:'v_auto6',    cells:['B','1','2','3','4','5'], sample:'1'},
  {id:'auto3',   label:'v_auto3',    cells:['B','2','4'],          sample:'2'},
  {id:'manual6', label:'v_manual6',  cells:['B','1','2','3','4','5'], sample:'1'},
  {id:'manual3', label:'v_manual3',  cells:['B','2','4'],          sample:'2'},
  {id:'single',  label:'v_single',   cells:['B'],                 sample:'B'}
];

/* ---- performance verification presets (UV-Vis 8000) ------------------ */
const PV_PRESETS = {
  wavAccInternal:{ label:'Wavelength', unit:'nm', values:[229,529,883], tol:[1.0,0.5,0.5], meas:[229.1,528.9,883.2] },
  wavAccStandard:{ label:'Wavelength', unit:'nm', values:[656,486], tol:[1.0,1.0], meas:[656.2,485.8] },
  wavRepeat:    { label:'Wavelength', unit:'nm', values:[529], tol:[0.1], meas:[529.0] },
  resolution:   { label:'Wavelength', unit:'nm', values:[269,282], tol:[2.0,2.0], meas:[269.4,281.6] },
  photoAcc:     { label:'Absorbance', unit:'A', values:[0.5,1.0,1.5], tol:[0.01,0.01,0.01], meas:[0.502,0.997,1.504] },
  noise:        { label:'Noise', unit:'A RMS', values:[0.0005], tol:[0.0005], meas:[0.0003] },
  strayLight:   { label:'Wavelength', unit:'nm', values:[220,340,400], tol:[0.1,0.1,0.1], meas:[0.03,0.02,0.04] }
};

/* ---- pre-loaded stored tests ----------------------------------------- */
function defaultStoredTests(){
  return [
    {name:'Copper',   mode:'water', method:'copper'},
    {name:'Chlorine', mode:'water', method:'chlorine_free'},
    {name:'COD',      mode:'water', method:'cod'},
    {name:'pH 7.00',  mode:'water', method:'perm_bottle'},
    {name:'Filter',   mode:'scan'},
    {name:'ENZYME',   mode:'kinetics'},
    {name:'Iron Std', mode:'stdcurve'}
  ];
}

/* ---- standard-curve demo standards ----------------------------------- */
const STD_DEMO = {
  name:'Iron Std',
  lambda:508,
  unit:'mg/L',
  concs:[0.0, 0.20, 0.40, 0.60, 0.80],
  slope:1.31,
  intercept:0.002
};

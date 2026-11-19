// Seed histórico realista de errores a GlitchTip (imita produccion de un cliente).
// Manda eventos variados a 2 proyectos (frontend + backend), repartidos en ~14 dias,
// con pesos para que unos issues sean frecuentes y otros raros (agrupacion realista).
// Uso: node seed.mjs [NUM_POR_PROYECTO]   (def 160)
const HOST = 'errors.example.com';
const PROJECTS = {
  1: { key: 'PUBLIC_KEY_PLACEHOLDER', platform: 'javascript', kind: 'frontend' },
};
const N = parseInt(process.argv[2] || '160', 10);

const pick = a => a[Math.floor(Math.random()*a.length)];
const rint = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const uuid = () => [...Array(32)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
const RELEASES = ['web@2.4.1','web@2.4.2','web@2.5.0','api@1.12.0','api@1.12.1','api@1.13.0'];
const ENVS = ['production','production','production','staging']; // sesgo a prod
const USERS = Array.from({length:40}, (_,i)=>({ id:String(1000+i), email:`user${1000+i}@acme-client.com`, ip_address:`${rint(1,223)}.${rint(0,255)}.${rint(0,255)}.${rint(1,254)}` }));
const BROWSERS = [['Chrome','142.0'],['Safari','18.1'],['Firefox','131.0'],['Edge','142.0']];
const OS = [['Windows','11'],['macOS','15.1'],['iOS','18.1'],['Android','15']];
const URLS = ['/checkout','/cart','/product/8842','/dashboard','/login','/settings/billing','/search?q=handpan'];

function frames(fns, file) {
  return fns.map((fn,i)=>({ filename:file, function:fn, lineno:rint(10,400), colno:rint(1,80), in_app:i<fns.length-1 }));
}

// Catalogo de issues con PESO (prob relativa) -> unos son frecuentes, otros raros
const FRONTEND_ISSUES = [
  { w:30, type:'TypeError', value:"Cannot read properties of undefined (reading 'total')", file:'app/checkout/summary.tsx', fns:['renderSummary','CheckoutPage','commitHookEffectListMount'] },
  { w:22, type:'ChunkLoadError', value:'Loading chunk 48 failed. (timeout: https://cdn.acme-client.com/static/48.chunk.js)', file:'webpack/runtime.js', fns:['requireEnsure','loadChunk'] },
  { w:18, type:'ReferenceError', value:'analytics is not defined', file:'app/lib/track.ts', fns:['track','trackAddToCart'] },
  { w:12, type:'TypeError', value:"Failed to fetch", file:'app/api/client.ts', fns:['apiFetch','getCart'] },
  { w:8,  type:'Error', value:'Non-Error promise rejection captured with value: [object Object]', file:'app/index.tsx', fns:['Promise.then'] },
  { w:4,  type:'RangeError', value:'Maximum call stack size exceeded', file:'app/utils/deepMerge.ts', fns:['deepMerge','deepMerge','deepMerge'] },
  { w:2,  type:'SecurityError', value:"Blocked a frame with origin from accessing a cross-origin frame.", file:'app/embed/widget.ts', fns:['mountWidget'] },
];
const BACKEND_ISSUES = [
  { w:28, type:'ValueError', value:"invalid literal for int() with base 10: ''", file:'api/views/orders.py', fns:['create_order','parse_qty','dispatch'] },
  { w:20, type:'KeyError', value:"'customer_id'", file:'api/serializers/checkout.py', fns:['validate','to_internal_value'] },
  { w:16, type:'ConnectionError', value:'HTTPSConnectionPool(host=\'payments.stripe.com\', port=443): Max retries exceeded', file:'api/services/payments.py', fns:['charge','_post'] },
  { w:12, type:'IntegrityError', value:'duplicate key value violates unique constraint "orders_order_ref_key"', file:'api/models/order.py', fns:['save','create_order'] },
  { w:9,  type:'OperationalError', value:'could not connect to server: Connection timed out', file:'api/db/pool.py', fns:['get_conn','execute'] },
  { w:7,  type:'TimeoutError', value:'Task exceeded soft time limit (30s)', file:'api/tasks/export.py', fns:['run_export'] },
  { w:3,  type:'PermissionError', value:"[Errno 13] Permission denied: '/var/data/invoices/tmp'", file:'api/services/invoice.py', fns:['write_pdf'] },
];
function weighted(list){ const tot=list.reduce((s,x)=>s+x.w,0); let r=Math.random()*tot; for(const x of list){ if((r-=x.w)<=0) return x; } return list[0]; }

function buildEvent(pid) {
  const P = PROJECTS[pid];
  const isFront = P.kind==='frontend';
  const iss = weighted(isFront?FRONTEND_ISSUES:BACKEND_ISSUES);
  const ts = Date.now()/1000 - rint(0, 6*3600); // ultimas 6h (particiones GlitchTip solo existen hoy+)
  const user = pick(USERS);
  const rel = pick(RELEASES.filter(r=>r.startsWith(isFront?'web':'api')));
  const ev = {
    event_id: uuid(),
    timestamp: ts,
    platform: P.platform,
    fingerprint: [iss.type, iss.file],   // agrupacion estable: 1 issue por tipo+archivo
    level: pick(['error','error','error','warning','fatal']),
    logger: isFront ? 'javascript' : 'api.'+iss.file.split('/')[1],
    release: rel,
    environment: pick(ENVS),
    transaction: isFront ? pick(URLS) : 'POST '+iss.file.replace('api/','/').replace('.py',''),
    server_name: isFront ? undefined : pick(['web-01','web-02','worker-01']),
    exception: { values: [{ type: iss.type, value: iss.value, stacktrace: { frames: frames(iss.fns, iss.file) } }] },
    user,
    tags: {
      environment: undefined,
      ...(isFront ? { browser: pick(BROWSERS).join(' '), 'browser.name': pick(BROWSERS)[0], os: pick(OS).join(' '), url: 'https://acme-client.com'+pick(URLS) }
                  : { runtime: 'python 3.12', server_name: pick(['web-01','web-02','worker-01']), endpoint: iss.file }),
    },
    breadcrumbs: { values: [
      { timestamp: ts-rint(1,8), category: isFront?'ui.click':'query', message: isFront?'click button#pay':'SELECT * FROM orders WHERE id=%s', level:'info' },
      { timestamp: ts-rint(1,4), category: isFront?'navigation':'http', message: isFront?('to '+pick(URLS)):'POST /v1/charges 500', level:'info' },
    ]},
  };
  return ev;
}

async function send(pid, ev) {
  const P = PROJECTS[pid];
  const res = await fetch(`https://${HOST}/api/${pid}/store/`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'X-Sentry-Auth':`Sentry sentry_key=${P.key}, sentry_version=7` },
    body: JSON.stringify(ev),
  });
  return res.status;
}

let ok=0, fail=0;
for (const pid of Object.keys(PROJECTS)) {
  for (let i=0;i<N;i++) {
    const st = await send(pid, buildEvent(pid));
    if (st===200) ok++; else { fail++; if(fail<=3) console.log('fail', pid, st); }
    if (i%40===0) process.stdout.write(`p${pid}:${i} `);
    await new Promise(r=>setTimeout(r, 220)); // evita el rate-limit de ingesta (burst rapido = eventos dropeados)
  }
}
console.log(`\nDONE ok=${ok} fail=${fail}`);

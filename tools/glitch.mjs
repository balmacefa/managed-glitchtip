// Capa GlitchTip (errors.example.com) sobre CDP 9222. Driver dedicado estilo JANUS.
// Uso: GT_PW=... node glitch.mjs <cmd> [arg]
//   confirm <url>  -> abre link de verificacion de email
//   login          -> loguea admin@example.com con GT_PW
//   map            -> loguea y vuelca navegacion/estructura (orgs, projects, settings)
//   shot <file>    -> screenshot del estado actual
import { chromium } from 'playwright-core';
const BASE = 'https://errors.example.com';
const EMAIL = 'admin@example.com';
const PW = process.env.GT_PW || '';
const [cmd, arg] = process.argv.slice(2);

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
let p = ctx.pages().find(pg => pg.url().includes('errors.example.com'));
if (!p) p = await ctx.newPage();
await p.bringToFront();

const txt = async () => (await p.locator('body').innerText()).replace(/\s+/g,' ').trim().slice(0,600);
const loggedIn = async () => !/\/login|\/register/.test(p.url()) && (await p.locator('a[href*="settings"], mat-sidenav, [class*="sidenav"], button[aria-label*="account" i]').count()) > 0;

async function login() {
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  if (await loggedIn()) { console.log('ya logueado'); return; }
  await p.fill('input[type=email], input[formcontrolname=email]', EMAIL);
  await p.fill('input[type=password], input[formcontrolname=password]', PW);
  await p.locator('button:has-text("Log in"), button[type=submit]').first().click();
  await p.waitForTimeout(3500);
  console.log('login -> url:', p.url());
  console.log('body:', await txt());
}

async function map() {
  if (!await loggedIn()) await login();
  const out = {};
  out.url = p.url();
  // links de navegacion principales
  out.nav = await p.evaluate(() => [...document.querySelectorAll('a[href^="/"]')]
    .map(a => ({ t: a.textContent.trim().slice(0,30), href: a.getAttribute('href') }))
    .filter(x => x.t).slice(0, 40));
  // recorrer rutas conocidas y ver que hay
  const routes = ['/', '/settings', '/profile', '/issues', '/organizations'];
  out.routes = {};
  for (const r of routes) {
    try {
      await p.goto(BASE + r, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1500);
      out.routes[r] = { finalUrl: p.url(), heading: await p.locator('h1,h2,mat-card-title').first().textContent({timeout:2000}).catch(()=>''), body: (await txt()).slice(0,180) };
    } catch (e) { out.routes[r] = { err: String(e).slice(0,80) }; }
  }
  console.log(JSON.stringify(out, null, 2));
}

async function setup() {
  if (!await loggedIn()) await login();
  // 1. Crear organizacion
  await p.goto(BASE + '/organizations/new', { waitUntil:'domcontentloaded' }).catch(()=>{});
  await p.waitForTimeout(1500);
  if (/not found|\/$/.test(p.url()) || await p.locator('text=Create Organization').count()) {
    await p.locator('text=Create Organization').first().click().catch(()=>{});
    await p.waitForTimeout(1200);
  }
  const orgInput = p.locator('input[type=text], input[formcontrolname=name], input').first();
  if (await orgInput.count()) { await orgInput.fill('MyOrg'); await p.locator('button:has-text("Create"), button[type=submit]').first().click().catch(()=>{}); await p.waitForTimeout(3000); }
  console.log('tras crear org -> url:', p.url());
  // 2. Crear proyecto
  await p.locator('text=/create.*project|new project|add project/i').first().click().catch(()=>{});
  await p.waitForTimeout(1500);
  console.log('pantalla proyecto url:', p.url(), '| body:', await txt());
  // dump de plataformas disponibles (cards)
  const plats = await p.evaluate(() => [...document.querySelectorAll('button,mat-card,a')].map(e=>e.textContent.trim()).filter(t=>/javascript|python|node|php|go|ruby|react|django|laravel/i.test(t)).slice(0,20));
  console.log('plataformas:', JSON.stringify(plats));
}

async function newproject(name, platform) {
  if (!await loggedIn()) await login();
  await p.goto(BASE + '/myorg/settings/projects/new', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  // plataforma: usar el tab 'All' y clickear el tile; fallback 'Other'
  await p.getByRole('tab', { name: 'All' }).click().catch(()=>{});
  await p.waitForTimeout(300);
  const tile = p.getByRole('button', { name: new RegExp('^'+platform+'$','i') });
  if (await tile.count()) await tile.first().click().catch(()=>{});
  else await p.getByRole('button', { name:'Other' }).first().click().catch(()=>{});
  await p.locator('input[formcontrolname=name]').fill(name).catch(()=>{});
  // seleccionar team existente 'devs' del mat-select
  await p.locator('mat-select').first().click().catch(()=>{});
  await p.waitForTimeout(600);
  await p.getByRole('option', { name: /devs/i }).first().click().catch(()=>{});
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Create Project/ }).first().click().catch(()=>{});
  await p.waitForTimeout(3500);
  const dsn = await p.evaluate(() => (document.body.innerText.match(/https?:\/\/[a-f0-9]+@[^\s"']+/i)||[])[0]||null);
  console.log('PROJECT', name, '->', p.url());
  console.log('DSN', dsn);
  return dsn;
}

async function project() {
  if (!await loggedIn()) await login();
  await p.goto(BASE + '/myorg/settings/projects/new', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'Node.js', exact: true }).first().click().catch(()=>{});
  await p.waitForTimeout(400);
  // + crear team
  await p.getByRole('button', { name: /add_circle_outline/ }).first().click().catch(()=>{});
  await p.waitForTimeout(800);
  // tras el +, aparece input de team: lleno el ultimo input de texto
  const inputs = p.locator('input[type=text]');
  const n = await inputs.count();
  if (n >= 1) await inputs.nth(n-1).fill('devs').catch(()=>{});   // team name
  await p.locator('input[formcontrolname=name]').fill('demo').catch(()=>{});  // project name
  await p.getByRole('button', { name: /Create Project/ }).first().click().catch(()=>{});
  await p.waitForTimeout(3500);
  console.log('tras crear proyecto -> url:', p.url());
  // buscar DSN en la pagina (setup/keys)
  const dsn = await p.evaluate(() => {
    const m = document.body.innerText.match(/https?:\/\/[a-f0-9]+@[^\s"']+/i);
    return m ? m[0] : null;
  });
  console.log('DSN:', dsn || '(no visible, ver /settings/projects/demo/keys)');
  console.log('body:', await txt());
}

async function register() {
  await p.goto(BASE + '/login', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.getByText(/sign up/i).first().click().catch(()=>{});
  await p.waitForTimeout(1200);
  await p.fill('input[formcontrolname=email]', EMAIL);
  await p.fill('input[formcontrolname=password]', PW);
  await p.fill('input[formcontrolname=password2]', PW);
  await p.getByRole('button', { name:/Register/ }).first().click().catch(()=>{});
  await p.waitForTimeout(3500);
  console.log('register -> url:', p.url());
}

if (cmd === 'newproject') await newproject(arg, process.argv[4] || 'Other');
else if (cmd === 'project') await project();
else if (cmd === 'register') await register();
else if (cmd === 'setup') await setup();
else if (cmd === 'confirm') { await p.goto(arg, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(2500); console.log('confirm url:', p.url()); console.log('body:', await txt()); }
else if (cmd === 'login') await login();
else if (cmd === 'map') await map();
else if (cmd === 'shot') { await p.screenshot({ path: arg || 'glitch.png', fullPage: true }); console.log('saved', arg || 'glitch.png'); }
else console.log('cmds: confirm <url> | login | map | shot <file>');
await b.close();

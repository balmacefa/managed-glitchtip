import { chromium } from 'playwright-core';
const NAME = process.argv[2] || 'demo';
const PLAT = process.argv[3] || 'JavaScript';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages().find(x=>x.url().includes('errors.example.com'));
await p.goto('https://errors.example.com/myorg/settings/projects/new',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
// plataforma
await p.getByRole('button',{name:new RegExp('^'+PLAT+'$')}).first().click().catch(()=>{});
await p.waitForTimeout(400);
// nombre (input formcontrolname=name)
await p.locator('input[formcontrolname=name]').fill(NAME);
// team: abrir dialog con boton aria-label 'Add a team'
await p.locator('button[aria-label="Add a team"]').first().click();
await p.waitForTimeout(1000);
const slug = p.locator('mat-dialog-container input[formcontrolname=slug], [role=dialog] input').first();
if (await slug.count()) { await slug.fill('devs'); await p.getByRole('button',{name:/Create Team/}).first().click(); await p.waitForTimeout(1500); }
// crear proyecto
await p.getByRole('button',{name:/^Create Project$/}).first().click();
await p.waitForTimeout(4000);
const dsn = await p.evaluate(()=> (document.body.innerText.match(/https?:\/\/[a-f0-9]+@[^\s"']+/i)||[])[0]||null);
console.log('URL', p.url());
console.log('DSN', dsn);
await b.close();

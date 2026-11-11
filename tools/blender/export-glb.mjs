import { chromium } from 'file:///C:/Users/33126/Documents/DIY/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const outFile='<work>/nova-batch1-evidence/yuheng-jade-core.glb';
const browser=await chromium.launch({channel:'chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
const page=await ctx.newPage();
await page.goto('http://127.0.0.1:4340/lab/',{waitUntil:'load'});
await page.waitForTimeout(3000);
const b64=await page.evaluate(async()=>{
  const api=window.__jadeViewer;
  const buf=await api.exportGLB();
  const bytes=new Uint8Array(buf); let s=''; const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  return btoa(s);
});
const buf=Buffer.from(b64,'base64');
fs.writeFileSync(outFile,buf);
console.log(JSON.stringify({size:buf.length, magic:buf.subarray(0,4).toString('ascii')}));
await browser.close();
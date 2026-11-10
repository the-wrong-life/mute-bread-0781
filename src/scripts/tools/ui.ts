import { units, convertUnit, parseJson, stringifyJson, tidyLines } from './logic';

export function mountTools() {
  const el = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
  const kind=el<HTMLSelectElement>('unit-kind'), value=el<HTMLInputElement>('unit-value'), from=el<HTMLSelectElement>('unit-from'), to=el<HTMLSelectElement>('unit-to'), precision=el<HTMLSelectElement>('unit-precision');
  const result=el<HTMLElement>('unit-result'), unitStatus=el<HTMLElement>('unit-status');
  const input=el<HTMLTextAreaElement>('json-input'), output=el<HTMLTextAreaElement>('json-output'), jsonStatus=el<HTMLElement>('json-status'), indent=el<HTMLSelectElement>('json-indent');
  const text=el<HTMLTextAreaElement>('text-input'), textOutput=el<HTMLTextAreaElement>('text-output'), textStatus=el<HTMLElement>('text-status');
  if(!kind || !value || !from || !to || !precision || !result || !unitStatus || !input || !output || !jsonStatus || !indent || !text || !textOutput || !textStatus) return;
  let unitOutput='';
  function calculate() {
    unitOutput=''; result.textContent='—';
    if(!value.value.trim()){value.setAttribute('aria-invalid','false');unitStatus.textContent='等待输入';return;}
    try {const n=convertUnit(value.value,kind.value,from.value,to.value); unitOutput=Number(n.toPrecision(Number(precision.value))).toString()+' '+to.value; result.textContent=unitOutput;unitStatus.textContent=value.value.trim()+' '+from.value+' =';value.setAttribute('aria-invalid','false');}
    catch(error){value.setAttribute('aria-invalid','true');unitStatus.textContent=error instanceof Error?error.message:'无法计算';}
  }
  function populate(){from.replaceChildren();to.replaceChildren();Object.entries(units[kind.value] || {}).forEach(([key,item])=>{from.add(new Option(item.label,key));to.add(new Option(item.label,key));});if(to.options.length>1)to.selectedIndex=1;calculate();}
  kind.addEventListener('change',populate); value.addEventListener('input',calculate); [from,to,precision].forEach(x=>x.addEventListener('change',calculate));
  el<HTMLButtonElement>('unit-example').addEventListener('click',()=>{kind.value='length';populate();value.value='25.4';from.value='mm';to.value='in';calculate();});
  function processJson(action:'check'|'format'|'minify'){
    output.value='';const parsed=parseJson(input.value);
    if(!parsed.ok){const jerr=parsed as {message:string;offset:number|null;line:number|null;column:number|null};input.setAttribute('aria-invalid','true');const location=jerr.offset===null?'（浏览器未提供错误位置）':`（第 ${jerr.line} 行，第 ${jerr.column} 列；字符偏移 ${jerr.offset}，从 0 开始）`;jsonStatus.textContent='JSON 无效'+location+'：'+jerr.message;return;}
    input.setAttribute('aria-invalid','false');
    try {if(action!=='check')output.value=stringifyJson(parsed.value,action==='minify'?0:indent.value==='4'?4:2);jsonStatus.textContent=action==='check'?'JSON 语法有效。':action==='format'?'格式化完成。':'压缩完成。';}
    catch {jsonStatus.textContent='数据嵌套过深，浏览器无法生成输出。';}
  }
  input.addEventListener('input',()=>{output.value='';input.setAttribute('aria-invalid','false');jsonStatus.textContent=new TextEncoder().encode(input.value).length>1024*1024?'输入超过 1 MiB，请缩短后再处理。':'输入已更改，请重新校验。';});
  el<HTMLButtonElement>('json-example').addEventListener('click',()=>{input.value=JSON.stringify({项目:'工程实验室',工具:['单位换算','文本整理'],可用:true});processJson('format');});
  el<HTMLButtonElement>('json-check').addEventListener('click',()=>processJson('check'));el<HTMLButtonElement>('json-format').addEventListener('click',()=>processJson('format'));el<HTMLButtonElement>('json-minify').addEventListener('click',()=>processJson('minify'));
  el<HTMLButtonElement>('text-process').addEventListener('click',()=>{const r=tidyLines(text.value,el<HTMLInputElement>('text-trim').checked,el<HTMLInputElement>('text-sort').checked);textOutput.value=r.text;textStatus.textContent=`处理前 ${r.before} 行，处理后 ${r.after} 行，去重 ${r.duplicates} 行。`;});
  const invalidateText=()=>{textOutput.value='';textStatus.textContent='输入或选项已更改，请重新整理。';};
  text.addEventListener('input',invalidateText); ['text-trim','text-sort'].forEach(id=>el<HTMLInputElement>(id).addEventListener('change',invalidateText));
  el<HTMLButtonElement>('text-example').addEventListener('click',()=>{text.value='青玉\n铜金\n青玉\n\n 墨色 ';textOutput.value='';textStatus.textContent='示例已填入，请点击整理文本。';});
  async function copy(content:string,status:HTMLElement) {
    if(!content){status.textContent='暂无可复制的结果。';return;}
    try {if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(content);status.textContent='已复制。';return;} catch { /* 回退到用户触发的复制命令 */ }
    const previousFocus=document.activeElement as HTMLElement | null; const helper=document.createElement('textarea');helper.value=content;helper.setAttribute('readonly','');helper.style.position='fixed';helper.style.opacity='0';document.body.appendChild(helper);helper.select();let copied=false;try{copied=document.execCommand('copy');}catch{} helper.remove();previousFocus?.focus();status.textContent=copied?'已复制。':'复制失败，请手动选择输出内容复制。';
  }
  el<HTMLButtonElement>('unit-copy').addEventListener('click',()=>void copy(unitOutput,el('unit-copy-status')));el<HTMLButtonElement>('json-copy').addEventListener('click',()=>void copy(output.value,el('json-copy-status')));el<HTMLButtonElement>('text-copy').addEventListener('click',()=>void copy(textOutput.value,el('text-copy-status')));
  populate();
}

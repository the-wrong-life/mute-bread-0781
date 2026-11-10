export const units: Record<string, Record<string, { label: string; factor: number }>> = {
  length: { mm: {label:'mm 毫米',factor:.001}, cm:{label:'cm 厘米',factor:.01}, m:{label:'m 米',factor:1}, km:{label:'km 千米',factor:1000}, in:{label:'in 英寸',factor:.0254}, ft:{label:'ft 英尺',factor:.3048} },
  mass: { g:{label:'g 克',factor:.001}, kg:{label:'kg 千克',factor:1}, oz:{label:'oz 盎司',factor:.028349523125}, lb:{label:'lb 磅',factor:.45359237} },
  temperature: { '°C':{label:'°C 摄氏度',factor:1}, '°F':{label:'°F 华氏度',factor:1}, K:{label:'K 开尔文',factor:1} },
  power: { W:{label:'W 瓦',factor:1}, kW:{label:'kW 千瓦',factor:1000}, hp:{label:'hp 机械马力',factor:745.6998715822702} }
};
export function convertUnit(raw:string, kind:string, from:string, to:string):number {
  if (!raw.trim()) throw new Error('请输入数值。');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) throw new Error('请输入有效的十进制数字。');
  const n=Number(raw);
  if (!Number.isFinite(n) || Math.abs(n)>1e15) throw new Error('请输入绝对值不超过 1×10¹⁵ 的有限数字。');
  const group=Object.hasOwn(units,kind)?units[kind]:undefined;
  if(!group || !Object.hasOwn(group,from) || !Object.hasOwn(group,to)) throw new Error('请选择有效的单位。');
  let out:number;
  if(kind==='temperature') {
    // 在原始量纲校验绝对零度，避免跨温标换算产生的舍入误差。
    const minimum:Record<string,number>={'°C':-273.15,'°F':-459.67,K:0};
    if(n<minimum[from]) throw new Error('温度不能低于绝对零度；此工具不能用于温差。');
    const c=from==='°C'?n:from==='°F'?(n-32)*5/9:n-273.15;
    out=to==='°C'?c:to==='°F'?c*9/5+32:c+273.15;
    if (n===minimum[from]) out=to==='°C'?-273.15:to==='°F'?-459.67:0;
  } else out=n*group[from].factor/group[to].factor;
  if (!Number.isFinite(out)||Math.abs(out)>1e15) throw new Error('结果超出范围：绝对值不得超过 1×10¹⁵。');
  return Object.is(out,-0)?0:out;
}
export type JsonResult = {ok:true; value:unknown} | {ok:false; message:string; offset:number|null; line:number|null; column:number|null};
// 仅在原生解析失败时扫描语法位置；使用显式栈避免深层输入递归溢出。
function locateJsonError(text:string):number {
  type State = 'rootValue'|'rootEnd'|'arrayFirst'|'arrayValue'|'arrayEnd'|'objectFirst'|'objectKey'|'objectColon'|'objectValue'|'objectEnd';
  const stack:State[]=['rootValue']; let i=0;
  const white=()=>{while(i<text.length && /[\x20\t\r\n]/.test(text[i]))i++;};
  const string=()=>{i++;while(i<text.length){const code=text.charCodeAt(i);if(text[i]==='"'){i++;return true;}if(code<32)return false;if(text[i]==='\\'){i++;if(i>=text.length)return false;if(text[i]==='u'){for(let j=0;j<4;j++){i++;if(i>=text.length||!/[0-9a-f]/i.test(text[i]))return false;}}else if(!'"\\/bfnrt'.includes(text[i]))return false;}i++;}return false;};
  while(stack.length){white();const state=stack[stack.length-1];const ch=text[i];
    if(state==='rootEnd')return i;
    if(state==='arrayEnd'){if(ch===']'){i++;stack.pop();continue;}if(ch!==',')return i;i++;stack[stack.length-1]='arrayValue';continue;}
    if(state==='objectEnd'){if(ch==='}'){i++;stack.pop();continue;}if(ch!==',')return i;i++;stack[stack.length-1]='objectKey';continue;}
    if(state==='objectColon'){if(ch!==':')return i;i++;stack[stack.length-1]='objectValue';continue;}
    if(state==='objectFirst'&&ch==='}'){i++;stack.pop();continue;}
    if(state==='objectFirst'||state==='objectKey'){if(ch!=='"')return i;if(!string())return i;stack[stack.length-1]='objectColon';continue;}
    if(state==='arrayFirst'&&ch===']'){i++;stack.pop();continue;}
    stack[stack.length-1]=state==='rootValue'?'rootEnd':state==='objectValue'?'objectEnd':'arrayEnd';
    if(ch==='['){i++;stack.push('arrayFirst');continue;}if(ch==='{'){i++;stack.push('objectFirst');continue;}if(ch==='"'){if(!string())return i;continue;}
    const literal=/true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;literal.lastIndex=i;const match=literal.exec(text);if(!match)return i;i=literal.lastIndex;
  }
  return i;
}
export function parseJson(text:string):JsonResult {
  if(new TextEncoder().encode(text).length>1024*1024) return {ok:false,message:'输入超过 1 MB，请缩短后再处理。',offset:null,line:null,column:null};
  try { return {ok:true,value:JSON.parse(text)}; } catch(error) {
    const message=error instanceof Error?error.message:'无法解析 JSON';
    const pos=message.match(/position (\d+)/i), lineCol=message.match(/line (\d+) column (\d+)/i);
    let offset:number|null=pos?Number(pos[1]):null;
    if(offset===null && lineCol) { const lines=text.split('\n'); const line=Math.min(Number(lineCol[1]),lines.length); offset=lines.slice(0,line-1).reduce((n,s)=>n+s.length+1,0)+Number(lineCol[2])-1; }
    if(offset===null && /end of json input/i.test(message)) offset=text.length;
    if(offset===null) offset=locateJsonError(text);
    offset=Math.max(0,Math.min(offset,text.length)); const before=text.slice(0,offset); const line=before.split('\n').length; const column=offset-before.lastIndexOf('\n');
    return {ok:false,message,offset,line,column};
  }
}
export function stringifyJson(value:unknown,indent:0|2|4):string { return JSON.stringify(value,null,indent); }
export function tidyLines(text:string, trim:boolean, sort:boolean) {
  const lines=text===''?[]:text.split(/\r\n|\n|\r/); const seen=new Set<string>(); const result:string[]=[]; let duplicates=0;
  for(const original of lines) {const line=trim?original.trim():original; if(!line.trim()) continue; if(seen.has(line)){duplicates++;continue;} seen.add(line); result.push(line);}
  if(sort)result.sort((a,b)=>a.localeCompare(b,'zh-CN'));
  return {text:result.join('\n'),before:lines.length,after:result.length,duplicates};
}

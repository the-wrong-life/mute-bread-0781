export const units: Record<string, Record<string, { label: string; factor: number }>> = {
  length: { mm: {label:'mm 毫米',factor:.001}, cm:{label:'cm 厘米',factor:.01}, m:{label:'m 米',factor:1}, km:{label:'km 千米',factor:1000}, in:{label:'in 英寸',factor:.0254}, ft:{label:'ft 英尺',factor:.3048} },
  mass: { g:{label:'g 克',factor:.001}, kg:{label:'kg 千克',factor:1}, oz:{label:'oz 盎司',factor:.028349523125}, lb:{label:'lb 磅',factor:.45359237} },
  temperature: { '°C':{label:'°C 摄氏度',factor:1}, '°F':{label:'°F 华氏度',factor:1}, K:{label:'K 开尔文',factor:1} },
  power: { W:{label:'W 瓦',factor:1}, kW:{label:'kW 千瓦',factor:1000}, hp:{label:'hp 机械马力',factor:745.6998715822702} },
  pressure: { Pa:{label:'Pa 帕',factor:1}, kPa:{label:'kPa 千帕',factor:1000}, MPa:{label:'MPa 兆帕',factor:1e6}, bar:{label:'bar 巴',factor:1e5}, psi:{label:'psi 磅/平方英寸',factor:6894.757293168361}, 'kgf/cm²':{label:'kgf/cm² 公斤力/平方厘米',factor:98066.5} },
  torque: { 'N·m':{label:'N·m 牛·米',factor:1}, 'kgf·m':{label:'kgf·m 公斤力·米',factor:9.80665}, 'lbf·ft':{label:'lbf·ft 磅力·英尺',factor:1.3558179483314004} },
  flow: { 'L/min':{label:'L/min 升/分',factor:1}, 'L/s':{label:'L/s 升/秒',factor:60}, 'm³/h':{label:'m³/h 立方米/时',factor:1000/60}, 'gpm(US)':{label:'gpm 美制加仑/分',factor:3.785411784}, 'gpm(UK)':{label:'gpm 英制加仑/分',factor:4.54609} }
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
  try {
    const value = JSON.parse(text);
    // 校验数字的十进制数值能否经 Number 往返，避免格式化时静默改值。
    const canonical = (raw:string) => {
      const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/)!;
      let digits = (match[2] + (match[3] ?? '')).replace(/^0+/, '');
      if (!digits) return '0';
      let exponent = BigInt(match[4] ?? '0') - BigInt((match[3] ?? '').length);
      const trailing = digits.match(/0+$/)?.[0].length ?? 0;
      if (trailing) { digits = digits.slice(0, -trailing); exponent += BigInt(trailing); }
      return match[1] + digits + 'e' + exponent;
    };
    const token = /"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    for (const match of text.matchAll(token)) {
      if (match[0][0] === '"') continue;
      const n = Number(match[0]);
      if (!Number.isFinite(n) || canonical(match[0]) !== canonical(String(n))) {
        const offset = match.index!; const before = text.slice(0, offset);
        return {ok:false, message:'数字超出可无损表示的范围，请改用字符串。', offset, line:before.split('\n').length, column:offset-before.lastIndexOf('\n')};
      }
    }
    return {ok:true,value};
  } catch(error) {
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

/** 直流线路压降：两线制（去程 + 回程）用 2·I·L·ρ/A，单线回路用 1·I·L·ρ/A。
 *  ρ 单位 Ω·mm²/m（20 ℃）：退火铜 0.01724、硬铜/接线常用 0.0175、铝 0.0282。
 *  只做工程前期估算，不替代按标准（如 IEC 60364-5-52）做的载流量与保护校验。 */
export type DropKind = 'dc2' | 'dc1';
export function parsePositive(raw: string, label: string, allowZero = false): number {
  const s = raw.trim();
  if (!s) throw new Error(`请填写${label}。`);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) throw new Error(`${label}必须是十进制数字。`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label}必须是有限数字。`);
  if (allowZero ? n < 0 : n <= 0) throw new Error(allowZero ? `${label}不能为负数。` : `${label}必须大于 0。`);
  return n;
}
export interface DropResult {
  /** 压降（V） */
  drop: number;
  /** 压降占电源电压的百分比 */
  percent: number;
  /** 负载端电压（V） */
  endVoltage: number;
  /** 回路总电阻（Ω） */
  resistance: number;
  /** 计入回程的导体总长（m） */
  loopLength: number;
}
export function dcVoltageDrop(p: { voltage: string; current: string; length: string; area: string; rho: string; kind: DropKind }): DropResult {
  const voltage = parsePositive(p.voltage, '电源电压');
  const current = parsePositive(p.current, '负载电流', true);
  const length = parsePositive(p.length, '单程线长');
  const area = parsePositive(p.area, '导体截面积');
  const rho = parsePositive(p.rho, '电阻率');
  if (area > 1000) throw new Error('导体截面积超过 1000 mm²，请确认单位是否为 mm²。');
  if (length > 100000) throw new Error('单程线长超过 100 km，请确认单位是否为 m。');
  const factor = p.kind === 'dc1' ? 1 : 2;
  const loopLength = length * factor;
  const resistance = (rho * loopLength) / area;
  const drop = current * resistance;
  const percent = (drop / voltage) * 100;
  if (![loopLength, resistance, drop, percent, voltage - drop].every(Number.isFinite)) throw new Error('计算结果溢出，请检查输入范围。');
  if (percent >= 100) throw new Error('计算压降已达到或超过电源电压，请检查输入是否合理。');
  return { drop, percent, endVoltage: voltage - drop, resistance, loopLength };
}

export interface UpsResult {
  /** 可用能量（Wh），已计入放电深度 */
  usableWh: number;
  /** 电池总能量（Wh） */
  nominalWh: number;
  /** 折算出逆变器损耗后的可用能量（Wh） */
  deliveredWh: number;
  /** 满载运行时间（分钟） */
  minutes: number;
  /** 满载运行时间（小时） */
  hours: number;
}

/**
 * UPS 备用时间估算。
 *
 * 公式：t = (容量 × 电压 × DoD × 逆变效率) / 负载功率
 *
 * 约束与常见误用：
 * - 容量是 2 小时率还是 20 小时率必须看电池规格书，本工具按输入值直接计算，不做换算；
 * - 逆变器效率包含 DC/DC、逆变与静态损耗，取 0.85–0.92 较常见；
 * - 铅酸电池深度放电会显著缩短寿命，DoD 一般取 0.5–0.8，锂电池可更高；
 * - 电池老化与低温会降低实际容量，本结果只作前期估算，不替代放电试验。
 */
export function upsRuntime(p: { capacity: string; voltage: string; dod: string; efficiency: string; load: string }): UpsResult {
  const capacity = parsePositive(p.capacity, '电池容量');
  const voltage = parsePositive(p.voltage, '电池组电压');
  const dod = parsePositive(p.dod, '放电深度');
  const efficiency = parsePositive(p.efficiency, '逆变效率');
  const load = parsePositive(p.load, '负载功率');
  if (capacity > 10000) throw new Error('电池容量超过 10000 Ah，请确认单位是否为 Ah。');
  if (voltage > 1000) throw new Error('电池组电压超过 1000 V，请确认单位是否为 V。');
  if (dod > 100) throw new Error('放电深度必须是 1–100 之间的百分数。');
  if (efficiency > 100) throw new Error('逆变效率必须是 1–100 之间的百分数。');
  if (load > 1e6) throw new Error('负载功率超过 1 MW，请确认单位是否为 W。');
  const nominalWh = capacity * voltage;
  const usableWh = nominalWh * (dod / 100);
  const deliveredWh = usableWh * (efficiency / 100);
  const hours = deliveredWh / load;
  if (![nominalWh, usableWh, deliveredWh, hours, hours * 60].every(Number.isFinite)) throw new Error('计算结果溢出，请检查输入范围。');
  return { nominalWh, usableWh, deliveredWh, minutes: hours * 60, hours };
}

/** 钣金折弯展开：θ 为折弯角（度），R 为内侧半径，T 为料厚，K 为中性层系数。
 *  BA  = θ(rad) × (R + K·T)     中性层弧长
 *  OSSB = (R + T)·tan(θ/2)      外侧退让
 *  BD  = 2·OSSB − BA            折弯扣除
 *  展开长 = A + B − BD，A、B 为到虚拟尖角的边长。K 取 0.33–0.5 之间是常见工程区间，
 *  具体值取决于材料、R/T 比与设备；结果供前期估算，不替代按设备与材料实测的展开系数。 */
export interface BendResult {
  /** 中性层弧长（mm） */
  allowance: number;
  /** 单侧外侧退让（mm） */
  setback: number;
  /** 折弯扣除（mm） */
  deduction: number;
  /** 两侧边长之和（mm），未填写时为 0 */
  legs: number;
  /** 展开长度（mm），未填写 A、B 时为 0 */
  flat: number;
  angleRad: number;
}
export function bendAllowance(p: { thickness: string; radius: string; angle: string; k: string; legA?: string; legB?: string }): BendResult {
  const t = parsePositive(p.thickness, '料厚');
  const r = parsePositive(p.radius, '内侧半径', true);
  const angle = parsePositive(p.angle, '折弯角');
  const k = parsePositive(p.k, '中性层系数', true);
  if (t > 50) throw new Error('料厚超过 50 mm，请确认单位是否为 mm。');
  if (r > 500) throw new Error('内侧半径超过 500 mm，请确认单位是否为 mm。');
  if (angle >= 180) throw new Error('折弯角必须小于 180°；180° 时外侧退让无定义。');
  if (angle > 170) throw new Error('折弯角超过 170°，请确认输入是否为折弯角而非余角。');
  if (k > 0.5) throw new Error('中性层系数应在 0–0.5 之间。');
  const angleRad = (angle * Math.PI) / 180;
  const allowance = angleRad * (r + k * t);
  const setback = (r + t) * Math.tan(angleRad / 2);
  const deduction = 2 * setback - allowance;
  const hasA = (p.legA ?? '').trim() !== '';
  const hasB = (p.legB ?? '').trim() !== '';
  let legs = 0;
  let flat = 0;
  if (hasA !== hasB) throw new Error('展开长度需要同时填写边 A 与边 B，或两者都留空。');
  if (hasA && hasB) {
    const a = parsePositive(p.legA as string, '边 A');
    const b = parsePositive(p.legB as string, '边 B');
    legs = a + b;
    flat = legs - deduction;
    if (flat <= 0) throw new Error('扣除量大于两边之和，展开长度为负；请检查边长与角度。');
  }
  for (const [key, value] of Object.entries({ allowance, setback, deduction, flat })) {
    if (!Number.isFinite(value)) throw new Error('计算结果溢出，请检查输入范围。');
    if (Math.abs(value) > 1e9) throw new Error('计算结果过大，请检查输入单位。');
    void key;
  }
  return { allowance, setback, deduction, legs, flat, angleRad };
}

/** 电源容量与电流估算。
 *  单相：I = S / U；三相：I = S / (√3·U)。S 为视在功率，P = S·cosφ，Q = S·sinφ。
 *  仅用于选型前期估算，不替代载流量、保护整定与短路校验。 */
export type SupplyPhase = 'single' | 'three';
export type SupplyInput = 'kw' | 'kva';
/** 输入基准：line = 电网侧有功（已含效率）；shaft = 机械轴功率，需按效率折算到电网侧。 */
export type SupplyBasis = 'line' | 'shaft';
export interface SupplyResult {
  /** 线电流 A */
  current: number;
  /** 视在功率 kVA */
  apparent: number;
  /** 有功功率 kW */
  active: number;
  /** 无功功率 kvar */
  reactive: number;
}
export function supplyCurrent(p: { phase: SupplyPhase; input: SupplyInput; value: string; voltage: string; pf: string; basis?: SupplyBasis; efficiency?: string }): SupplyResult {
  const value = parsePositive(p.value, p.input === 'kw' ? '有功功率' : '视在功率');
  const voltage = parsePositive(p.voltage, '电压');
  const pf = parsePositive(p.pf, '功率因数');
  if (pf > 1) throw new Error('功率因数应在 0–1 之间，不能大于 1。');
  if (pf < 0.1) throw new Error('功率因数低于 0.1，请确认是否误填了百分比。');
  if (voltage < 12) throw new Error('电压低于 12 V，请确认单位是否为 V。');
  if (voltage > 1000) throw new Error('电压超过 1000 V，超出本工具的低压估算范围。');
  if (value > 1e6) throw new Error('功率超过 1e6，请确认单位是否为 kW 或 kVA。');
  // 轴功率基准：把机械输出折算到电网侧有功，再做 S 与 I 的换算（与「直流/交流压降」案例口径一致）。
  let lineActive = value;
  if (p.basis === 'shaft') {
    if (p.input === 'kva') throw new Error('轴功率基准只适用于有功功率输入，请改选「有功功率 P」。');
    const eff = parsePositive(p.efficiency ?? '', '效率');
    if (eff <= 1) throw new Error('效率应填百分比数值（例如 88.8），不要填小数。');
    if (eff > 100) throw new Error('效率不能大于 100%。');
    if (eff < 30) throw new Error('效率低于 30%，请确认是否误填。');
    lineActive = value / (eff / 100);
  }
  const apparent = p.input === 'kw' ? lineActive / pf : value;
  const active = apparent * pf;
  const reactive = apparent * Math.sqrt(Math.max(0, 1 - pf * pf));
  const divisor = p.phase === 'three' ? Math.sqrt(3) * voltage : voltage;
  const current = (apparent * 1000) / divisor;
  if (!Number.isFinite(current)) throw new Error('计算结果溢出，请检查输入范围。');
  if (current > 1e6) throw new Error('线电流超过 1e6 A，请检查输入单位。');
  return { current, apparent, active, reactive };
}

/** 允许负数的十进制解析（温度等）。 */
export function parseNumber(raw: string, label: string): number {
  const s = raw.trim();
  if (!s) throw new Error('请填写' + label + '。');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) throw new Error(label + '必须是十进制数字。');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(label + '必须是有限数字。');
  return n;
}
/** 电气柜热损耗与散热估算。
 *  自然散热：P_nat = k · A · ΔT（k 为表面综合换热系数，经验值）。
 *  强制通风：Q = 3.12 · P · 3600 / (3.12e3) … 直接用 Q[m³/h] ≈ 3.12 · P[W] / ΔT[K]
 *  （35 ℃ 空气 ρ·cp ≈ 1154 J/(m³·K)，3600/1154 ≈ 3.12）。
 *  只做方案比较：实际柜温还受安装位置、阳光、邻近热源、风道与滤网压损影响。 */
export interface CabinetResult {
  /** 允许温升 K */
  deltaT: number;
  /** 有效散热面积 m² */
  area: number;
  /** 自然散热可排功率 W */
  natural: number;
  /** 需要强制通风带走的风量 m³/h（含安全系数） */
  airflow: number;
  /** 未含安全系数的理论风量 m³/h */
  airflowBase: number;
  /** 自然散热是否足够 */
  passiveOk: boolean;
}
export function cabinetThermal(p: {
  loss: string; area: string; ambient: string; inside: string; k: string; safety: string;
}): CabinetResult {
  const loss = parsePositive(p.loss, '柜内总损耗', true);
  const area = parsePositive(p.area, '有效散热面积');
  const ambient = parseNumber(p.ambient, '环境温度');
  const inside = parseNumber(p.inside, '允许柜内温度');
  const k = parsePositive(p.k, '换热系数');
  const safety = parsePositive(p.safety, '安全系数');
  if (loss > 200000) throw new Error('柜内总损耗超过 200 kW，请确认单位是否为 W。');
  if (area > 2000) throw new Error('散热面积超过 2000 m²，请确认单位是否为 m²。');
  if (ambient < -40 || ambient > 80) throw new Error('环境温度应在 -40 至 80 ℃ 之间。');
  if (inside > 100) throw new Error('柜内允许温度超过 100 ℃，请确认是否误填。');
  const deltaT = inside - ambient;
  if (deltaT <= 0) throw new Error('允许柜内温度必须高于环境温度。');
  if (deltaT > 60) throw new Error('温升超过 60 K，请确认两个温度是否填反。');
  if (k < 1 || k > 15) throw new Error('换热系数应在 1–15 W/(m²·K) 之间。');
  if (safety < 1 || safety > 3) throw new Error('安全系数应在 1–3 之间。');
  const natural = k * area * deltaT;
  const passiveOk = loss <= natural;
  const airflowBase = (3.12 * loss) / deltaT;
  const airflow = airflowBase * safety;
  for (const v of [natural, airflowBase, airflow]) {
    if (!Number.isFinite(v)) throw new Error('计算结果溢出，请检查输入范围。');
  }
  return { deltaT, area, natural, airflow, airflowBase, passiveOk };
}


/** 交流系统型式：ac3 三相三线/四线，ac1 单相两线。 */
export type AcSystem = 'ac3' | 'ac1';

export interface AcDropResult {
  /** 线路压降（V） */
  drop: number;
  /** 压降占线电压的百分比 */
  percent: number;
  /** 负载端线电压（V） */
  endVoltage: number;
  /** 导体交流电阻（Ω/km） */
  rKm: number;
  /** 导体电抗（Ω/km） */
  xKm: number;
  /** 由功率因数导出的 sinφ */
  sinPhi: number;
  /** 允许压降限值（%） */
  limitPercent: number;
  /** 是否满足限值 */
  pass: boolean;
  /** 回路系数 k：三相 √3、单相 2 */
  factor: number;
}

/**
 * 交流线路压降（低压电缆，集中负载）。
 *
 * 公式：ΔU = k · I · (R′·cosφ + X′·sinφ) · L/1000
 *   R′ = ρ20 · 1000 / A（Ω/km），k = √3（三相线电压）/ 2（单相）。
 *
 * 适用边界与常见误用：
 * - 集肤效应与邻近效应在小截面（≤ 35 mm²）低压电缆上可忽略；大截面应按厂家 R/X 数据替代 ρ/A；
 * - X′ 取 0.08 Ω/km 是低压多芯电缆的常用估算值，穿管、桥架并排敷设与谐波环境会偏离；
 * - 只算线路本体，不含变压器内阻、母线、开关与接触电阻；启动电流与短路校验须另做；
 * - 结果不替代按 IEC 60364-5-52 / GB/T 16895 的载流量、保护配合与温升校验。
 */
export function acCableDrop(p: {
  system: AcSystem; voltage: string; current: string; length: string; area: string;
  rho: string; pf: string; x: string; limit: string;
}): AcDropResult {
  const voltage = parsePositive(p.voltage, '线电压');
  const current = parsePositive(p.current, '负载电流', true);
  const length = parsePositive(p.length, '单程线长');
  const area = parsePositive(p.area, '导体截面积');
  const rho = parsePositive(p.rho, '电阻率');
  const pf = parsePositive(p.pf, '功率因数');
  const xKm = parsePositive(p.x, '单位电抗', true);
  const limitPercent = parsePositive(p.limit, '允许压降');
  if (voltage > 1000) throw new Error('线电压超过 1000 V，本工具只适用于低压系统。');
  if (area > 1000) throw new Error('导体截面积超过 1000 mm²，请确认单位是否为 mm²。');
  if (length > 100000) throw new Error('单程线长超过 100 km，请确认单位是否为 m。');
  if (pf > 1) throw new Error('功率因数必须在 0 到 1 之间。');
  if (xKm > 0.5) throw new Error('单位电抗应在 0–0.5 Ω/km 之间，低压电缆常用 0.08。');
  if (limitPercent > 100) throw new Error('允许压降不能超过 100%。');
  const sinPhi = Math.sqrt(Math.max(0, 1 - pf * pf));
  const rKm = (rho * 1000) / area;
  const factor = p.system === 'ac3' ? Math.sqrt(3) : 2;
  const drop = factor * current * (rKm * pf + xKm * sinPhi) * (length / 1000);
  const percent = (drop / voltage) * 100;
  if (![rKm, drop, percent].every(Number.isFinite)) throw new Error('计算结果溢出，请检查输入范围。');
  if (percent >= 100) throw new Error('计算压降已达到或超过线电压，请检查输入是否合理。');
  return { drop, percent, endVoltage: voltage - drop, rKm, xKm, sinPhi, limitPercent, pass: percent <= limitPercent + 8 * Number.EPSILON * Math.max(percent, limitPercent), factor };
}



/** 低压电缆常用标准截面序列（mm²，GB/T 3956 第 1/2 种铜导体常用档位，铝导体基本一致）。 */
export const AC_STANDARD_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];

export interface AcSizeResult {
  /** 达到允许压降所需的最小理论截面（mm²） */
  required: number | null;
  /** 在标准序列中向上取一档后的截面（mm²）；序列上限仍不满足时为 null */
  selected: number | null;
  /** 选用截面的实际压降（V）；无解时为 0 */
  drop: number;
  /** 选用截面的压降百分比；无解时为 0 */
  percent: number;
  /** 允许压降限值（V） */
  limitVolts: number;
  /** 允许压降限值（%） */
  limitPercent: number;
  /** 纯电抗分量单独造成的压降（V） */
  reactiveDrop: number;
  /** 选用截面的导体电阻（Ω/km）；无解时为 0 */
  rKm: number;
  /** 电抗分量本身已超过允许压降，加粗导体无法解决 */
  reactiveLimited: boolean;
  /** 回路系数 k：三相 √3、单相 2 */
  factor: number;
}

/**
 * 按允许压降反算最小导体截面（低压、集中负载）。
 *
 * 由 ΔU = k·I·(R′·cosφ + X′·sinφ)·L/1000 反解，其中 R′ = ρ·1000/A：
 *   电阻分量允许值 = ΔU_limit − 电抗分量
 *   A_required = k·I·ρ·cosφ·L / 电阻分量允许值
 *
 * 边界与 acCableDrop 一致，另有两条与反算有关的说明：
 * - 电抗分量 k·I·X′·sinφ·L/1000 与截面无关。若它本身已超过允许压降，
 *   无论截面加到多大都无解（reactiveLimited），只能降低电流、缩短线路或提高电压；
 * - 反算只保证压降达标，**不保证载流量与保护配合**：选出的截面仍须按
 *   IEC 60364-5-52 校验持续载流量、按短路电流校验热稳定与保护整定。
 */
export function acCableSize(p: {
  system: AcSystem; voltage: string; current: string; length: string;
  rho: string; pf: string; x: string; limit: string;
}): AcSizeResult {
  const voltage = parsePositive(p.voltage, '线电压');
  const current = parsePositive(p.current, '负载电流', true);
  const length = parsePositive(p.length, '单程线长');
  const rho = parsePositive(p.rho, '电阻率');
  const pf = parsePositive(p.pf, '功率因数');
  const xKm = parsePositive(p.x, '单位电抗', true);
  const limitPercent = parsePositive(p.limit, '允许压降');
  if (voltage > 1000) throw new Error('线电压超过 1000 V，本工具只适用于低压系统。');
  if (length > 100000) throw new Error('单程线长超过 100 km，请确认单位是否为 m。');
  if (pf > 1) throw new Error('功率因数必须在 0 到 1 之间。');
  if (xKm > 0.5) throw new Error('单位电抗应在 0–0.5 Ω/km 之间，低压电缆常用 0.08。');
  if (limitPercent > 100) throw new Error('允许压降不能超过 100%。');
  const sinPhi = Math.sqrt(Math.max(0, 1 - pf * pf));
  const factor = p.system === 'ac3' ? Math.sqrt(3) : 2;
  const limitVolts = (voltage * limitPercent) / 100;
  if (limitVolts <= 0) throw new Error('允许压降为 0，无法反算截面。');
  const reactiveDrop = factor * current * (xKm * sinPhi) * (length / 1000);
  if (![limitVolts, reactiveDrop].every(Number.isFinite)) throw new Error('计算结果溢出，请检查输入范围。');
  const target = limitVolts - reactiveDrop;
  if (target <= 0) {
    return {
      required: null, selected: null, drop: 0, percent: 0,
      limitVolts, limitPercent, reactiveDrop, rKm: 0, reactiveLimited: true, factor,
    };
  }
  const required = current > 0 ? (factor * current * rho * pf * length) / target : 0;
  if (!Number.isFinite(required)) throw new Error('计算结果溢出，请检查输入范围。');
  // 向上取一档：所需截面小于最小档位时按最小档位给值，便于直接下单
  const selected: number | null = AC_STANDARD_SECTIONS.find((s) => {
    const candidate = factor * current * ((rho * 1000 / s) * pf + xKm * sinPhi) * (length / 1000) / voltage * 100;
    return Number.isFinite(candidate) && candidate <= limitPercent + 8 * Number.EPSILON * Math.max(candidate, limitPercent);
  }) ?? null;
  if (selected === null) {
    return {
      required, selected: null, drop: 0, percent: 0,
      limitVolts, limitPercent, reactiveDrop, rKm: 0, reactiveLimited: false, factor,
    };
  }
  const rKm = (rho * 1000) / selected;
  const drop = factor * current * (rKm * pf + xKm * sinPhi) * (length / 1000);
  const percent = (drop / voltage) * 100;
  if (![rKm, drop, percent].every(Number.isFinite)) throw new Error('计算结果溢出，请检查输入范围。');
  return { required, selected, drop, percent, limitVolts, limitPercent, reactiveDrop, rKm, reactiveLimited: false, factor };
}


/** 穿管填充率的允许上限（%）：按管内电缆总数分档。 */
export function conduitFillLimit(total: number): number {
  if (total <= 1) return 53;
  if (total === 2) return 31;
  return 40;
}

export interface ConduitFillResult {
  /** 管内净内截面（mm²） */
  tubeArea: number;
  /** 电缆占用截面（mm²） */
  cableArea: number;
  /** 剩余截面（mm²）；为负表示已超容 */
  spareArea: number;
  /** 填充率（%）= 100 × Σ(n·d²) / D² */
  fillPercent: number;
  /** 允许填充率上限（%） */
  limitPercent: number;
  /** 管内电缆总根数 */
  total: number;
  /** 是否满足上限 */
  pass: boolean;
  /** 按上限估算的、同一外径电缆最多可穿根数 */
  maxCount: number;
}

/**
 * 电缆穿管填充率（按电缆外径计算，不考虑绞合与弯曲余量）。
 *
 * 公式：f = 100 · Σ(n_i · d_i²) / D²
 *   推导：π/4 在分子分母中抵消，故只需外径平方与根数。
 *   占用截面 A_c = Σ n_i · π d_i²/4，管内净截面 A_t = π D²/4。
 *
 * 允许上限取自 NEC（NFPA 70）第 9 章表 1 的常用分档：
 *   1 根 53%、2 根 31%、3 根及以上 40%。IEC 与船级社并无统一百分比，
 *   多数船东与船级社要求按制造商载流量表与弯曲半径确定，本判据只作初筛。
 *
 * 边界：
 * - 只按外径算几何占位，不含绞合、电缆不圆度、管内毛刺、弯曲余量；
 * - 不校核载流量与温升：穿管后散热变差，载流量必须按 IEC 60364-5-52 的敷设方式折算；
 * - 多芯电缆按整体外径计算，不拆分芯线。
 */
export function conduitFill(p: {
  diameter: string; diaA: string; countA: string; diaB?: string; countB?: string;
}): ConduitFillResult {
  const parseCount = (raw: string | undefined, label: string): number => {
    const text = (raw ?? '').trim();
    if (text === '') return 0;
    if (!/^\d+$/.test(text)) throw new Error(`${label}必须是整数。`);
    const n = Number(text);
    if (n < 0) throw new Error(`${label}不能为负。`);
    if (n > 200) throw new Error(`${label}超过 200 根，请确认是否填错。`);
    return n;
  };

  const D = parsePositive(p.diameter, '管内径');
  const dA = parsePositive(p.diaA, '电缆外径');
  const nA = parseCount(p.countA, '电缆根数');
  const hasB = (p.diaB ?? '').trim() !== '' || (p.countB ?? '').trim() !== '';
  const dB = hasB ? parsePositive(p.diaB ?? '', '第二组电缆外径') : 0;
  const nB = hasB ? parseCount(p.countB, '第二组电缆根数') : 0;

  if (D > 500) throw new Error('管内径超过 500 mm，请确认单位是否为 mm。');
  if (dA > 100 || dB > 100) throw new Error('电缆外径超过 100 mm，请确认单位是否为 mm。');
  if (nA === 0 && nB === 0) throw new Error('管内电缆总根数不能为 0。');
  if (dA >= D) throw new Error('电缆外径必须小于管内径。');
  if (hasB && dB >= D) throw new Error('第二组电缆外径必须小于管内径。');

  const total = nA + nB;
  const sumSq = nA * dA * dA + nB * dB * dB;
  const tubeArea = (Math.PI * D * D) / 4;
  const cableArea = (Math.PI * sumSq) / 4;
  const fillPercent = (100 * sumSq) / (D * D);
  const limitPercent = conduitFillLimit(total);
  const dMax = Math.max(dA, dB);
  const maxCount = Math.floor(((limitPercent / 100) * D * D) / (dMax * dMax));
  if (![tubeArea, cableArea, fillPercent].every(Number.isFinite)) throw new Error('计算结果溢出，请检查输入范围。');
  return {
    tubeArea, cableArea, spareArea: tubeArea - cableArea, fillPercent, limitPercent,
    total, pass: fillPercent <= limitPercent + 8 * Number.EPSILON * Math.max(fillPercent, limitPercent), maxCount,
  };
}

/** 电缆载流量修正：环境温度 + 成组/敷设修正。
 *  k_temp = √[(θ_max − θ_amb) / (θ_max − θ_ref)]，I_z = I_z0 · k_temp · k_group。
 *  θ_max 取绝缘额定导体温度（PVC 70 ℃、XLPE/EPR 90 ℃），θ_ref 为基准环境温度（空气 30 ℃、埋地 20 ℃，
 *  必须与所查载流量表一致）。成组与敷设系数涉及标准表格，本工具不内置表值，由用户查表后填入。
 *  环境温度高于基准时公式与标准表基本一致；低于基准时公式偏乐观（PVC 25 ℃ 公式 1.061、表约 1.03）。 */
export type InsulationType = 'pvc' | 'xlpe';
export interface DerateResult {
  /** 导体最高工作温度 ℃ */
  tMax: number;
  /** 温度修正系数 */
  kTemp: number;
  /** 综合修正系数 */
  k: number;
  /** 修正后载流量 A */
  iz: number;
  /** 相对基准载流量的变化百分比（正数为降额） */
  deratePercent: number;
  /** 环境温度是否低于基准温度（此时系数大于 1，需查表核实） */
  belowRef: boolean;
}
export function cableDerate(p: { insulation: InsulationType; iz0: string; ambient: string; ref: string; group: string }): DerateResult {
  const tMax = p.insulation === 'xlpe' ? 90 : 70;
  const iz0 = parsePositive(p.iz0, '基准载流量');
  const ambient = parseNumber(p.ambient, '环境温度');
  const ref = parseNumber(p.ref, '基准环境温度');
  const group = parsePositive(p.group, '成组与敷设修正系数');
  if (iz0 > 100000) throw new Error('基准载流量超过 100000 A，请确认单位是否为 A。');
  if (ambient < -60 || ambient > 150) throw new Error('环境温度应在 -60 至 150 ℃ 之间。');
  if (ref < -60 || ref > 150) throw new Error('基准环境温度应在 -60 至 150 ℃ 之间。');
  if (group > 1) throw new Error('成组与敷设修正系数不得大于 1：修正只会降低载流量，低于基准温度请改基准温度而不是填大于 1 的系数。');
  if (group < 0.1) throw new Error('成组与敷设修正系数低于 0.1，请确认是否误填。');
  if (ambient >= tMax) throw new Error('环境温度 ' + ambient + ' ℃ 已不低于导体最高工作温度 ' + tMax + ' ℃，此时载流量为零，不能按本公式修正。');
  if (ref >= tMax) throw new Error('基准环境温度 ' + ref + ' ℃ 应低于导体最高工作温度 ' + tMax + ' ℃。');
  const kTemp = Math.sqrt((tMax - ambient) / (tMax - ref));
  const k = kTemp * group;
  const iz = iz0 * k;
  const deratePercent = (1 - k) * 100;
  for (const v of [kTemp, k, iz, deratePercent]) {
    if (!Number.isFinite(v)) throw new Error('计算结果溢出，请检查输入范围。');
  }
  return { tMax, kTemp, k, iz, deratePercent, belowRef: ambient < ref };
}

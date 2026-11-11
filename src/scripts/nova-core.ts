type Root = HTMLElement & { novaCleanup?: () => void };
const vertex = 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.0,1.0); }';
const fragment = `precision mediump float;
uniform vec2 resolution;
uniform float time;
void main() {
  vec2 pixel = gl_FragCoord.xy / resolution;
  vec2 p = vec2((pixel.x - .5) * 400.0, ((1.0 - pixel.y) * 420.0) - 194.0) / 109.0;
  float d = dot(p,p);
  if (d >= 1.0) discard;
  vec3 n = normalize(vec3(p.x, -p.y, sqrt(1.0-d)));
  vec3 light = normalize(vec3(-.45,.65,.85));
  float diffuse = max(dot(n,light),0.0);
  float fresnel = pow(1.0-n.z,2.5);
  float specular = pow(max(dot(reflect(-light,n),vec3(0.0,0.0,1.0)),0.0),28.0);
  float flow = sin(n.x*9.0 + sin(n.y*6.0 + time*.25)*1.4 + time*.15);
  flow *= sin(n.y*8.0 - n.z*5.0 + time*.12);
  vec3 jade = mix(vec3(.22,.52,.40),vec3(.72,.87,.70),.48 + .18*flow + .24*diffuse);
  vec3 color = jade + vec3(.20,.18,.12)*specular + vec3(.15,.18,.12)*fresnel;
  float alpha = (0.20 + 0.14*fresnel + 0.12*specular) * (1.0-smoothstep(.97,1.0,d));
  gl_FragColor=vec4(color,alpha);
}`;

function mount(root: Root) {
 const canvas = root.querySelector<HTMLCanvasElement>('canvas');
 const button = root.querySelector<HTMLButtonElement>('[data-nova-motion]');
 if (!canvas || !button) return;
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
 let paused = root.dataset.userPaused === 'true', visible = typeof IntersectionObserver === 'undefined', stopped = false, lost = false, raf = 0;
 let elapsed = 0, previous = 0, lastDraw = 0, slow = 0, frameInterval = 1000 / 30;
 let gl: WebGLRenderingContext | null = null, program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
 let shaders: WebGLShader[] = [], position = -1, resolution: WebGLUniformLocation | null = null, time: WebGLUniformLocation | null = null;
 try { gl = canvas.getContext('webgl', {alpha:true, antialias:false, premultipliedAlpha:false, powerPreference:'low-power'}); } catch { gl = null; }
 function release() {
  if (!gl) return;
  if(buffer) gl.deleteBuffer(buffer);
  if(program) gl.deleteProgram(program);
  shaders.forEach(s=>gl!.deleteShader(s));
  buffer=null; program=null; shaders=[];
 }
 function init() {
  if (!gl || gl.isContextLost()) return false;
  const compile = (type:number, source:string) => {
   const shader=gl!.createShader(type); if(!shader) return null;
   shaders.push(shader); gl!.shaderSource(shader,source); gl!.compileShader(shader);
   return gl!.getShaderParameter(shader,gl!.COMPILE_STATUS) ? shader : null;
  };
  const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
  if(!vs || !fs) { release(); return false; }
  program=gl.createProgram(); if(!program) { release(); return false; }
  gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) { release(); return false; }
  buffer=gl.createBuffer(); if(!buffer) { release(); return false; }
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  position=gl.getAttribLocation(program,'p'); resolution=gl.getUniformLocation(program,'resolution'); time=gl.getUniformLocation(program,'time');
  if(position < 0 || !resolution || !time) { release(); return false; }
  return true;
 }
 let available=init();
 canvas.style.visibility=available ? 'visible' : 'hidden';
 function draw() {
  if(!gl || !program || !buffer || !available || lost) return;
  const box=canvas!.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,1.25);
  if(!box.width || !box.height) return;
  const w=Math.max(1,Math.round(box.width*dpr)), h=Math.max(1,Math.round(box.height*dpr));
  if(canvas!.width!==w || canvas!.height!==h) {canvas!.width=w;canvas!.height=h;}
  gl.viewport(0,0,w,h); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  gl.uniform2f(resolution,w,h); gl.uniform1f(time,elapsed/1000); gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 function active() { return available && !stopped && !lost && !document.hidden && visible && !paused && !reduced.matches; }
 function render(now:number) {
  raf=0; if(!active()) return;
  if(previous) { const delta=now-previous; elapsed+=Math.min(delta,50); if(delta>55) slow++; else slow=Math.max(0,slow-1); if(slow>20) frameInterval=1000/15; }
  previous=now;
  if(now-lastDraw>=frameInterval) { draw(); lastDraw=now; }
  raf=requestAnimationFrame(render);
 }
 function sync() {
  cancelAnimationFrame(raf); raf=0; previous=0;
  root.toggleAttribute('data-active',active());
  root.dataset.motion = !available || lost ? 'static' : reduced.matches ? 'reduced' : paused ? 'paused' : (document.hidden || !visible) ? 'offscreen' : 'running';
  root.dataset.renderer = available && !lost ? 'webgl' : 'svg';
  button!.hidden=false;
  button!.textContent=!available || lost ? '静态预览' : reduced.matches ? '已减少动态' : paused ? '继续动画' : '暂停动画';
  button!.disabled=!available || lost || reduced.matches;
  button!.title=!available || lost ? '当前使用静态图形降级' : reduced.matches ? '系统已启用减少动态效果' : '';
  if(!document.hidden && visible && !lost) draw();
  if(active()) raf=requestAnimationFrame(render);
 }
 function toggle() { paused=!paused; root.dataset.userPaused=String(paused); sync(); }
 function contextLost(event:Event) { event.preventDefault(); lost=true; available=false; canvas!.style.visibility='hidden'; sync(); }
 function contextRestored() { lost=false; release(); available=init(); canvas!.style.visibility=available ? 'visible' : 'hidden'; sync(); }
 const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { visible=entries[0]?.isIntersecting ?? true; sync(); });
 function cleanup() {
  if(stopped) return; stopped=true; cancelAnimationFrame(raf); root.removeAttribute('data-active'); root.dataset.motion='paused'; root.dataset.renderer='svg';
  observer?.disconnect(); document.removeEventListener('visibilitychange',sync); window.removeEventListener('resize',sync); reduced.removeEventListener('change',sync);
  button!.removeEventListener('click',toggle); canvas!.removeEventListener('webglcontextlost',contextLost); canvas!.removeEventListener('webglcontextrestored',contextRestored); window.removeEventListener('pagehide',cleanup);
  release(); canvas!.style.visibility='hidden'; delete root.novaCleanup;
 }
 root.novaCleanup=cleanup;
 observer?.observe(root); document.addEventListener('visibilitychange',sync); window.addEventListener('resize',sync,{passive:true}); reduced.addEventListener('change',sync);
 button.addEventListener('click',toggle); canvas.addEventListener('webglcontextlost',contextLost); canvas.addEventListener('webglcontextrestored',contextRestored); window.addEventListener('pagehide',cleanup,{once:true}); sync();
}
export function mountNovaCore(){document.querySelectorAll<Root>('[data-nova-core]').forEach(root=>{if(!root.novaCleanup)mount(root);});}
window.addEventListener('pageshow',event=>{if(event.persisted)mountNovaCore();});
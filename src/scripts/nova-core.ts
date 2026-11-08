type Root = HTMLElement & { novaCleanup?: () => void };
const vertex = 'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}';
const fragment = `precision mediump float;
uniform vec2 resolution;
uniform float angle;
void main(){
 vec2 p=(gl_FragCoord.xy*2.0-resolution)/min(resolution.x,resolution.y);
 float r=length(p); if(r>.92) discard;
 float sweep=pow(max(0.0,1.0-abs(r-(.66+.025*sin(atan(p.y,p.x)*5.0+angle*2.0)))),32.0);
 float grain=.5+.5*sin(p.x*165.0+sin(p.y*121.0));
 float glow=exp(-r*3.0)*.12;
 vec3 color=vec3(.24,.72,.53)*sweep+vec3(.35,.68,.52)*(glow+grain*.018);
 gl_FragColor=vec4(color, .42);
}
`;

function mount(root: Root) {
 const canvas = root.querySelector('canvas'); if (!canvas) return;
 let gl: WebGLRenderingContext | null = null;
 try { gl = canvas.getContext('webgl', { alpha:true, antialias:false, powerPreference:'low-power' }); } catch { return; }
 if (!gl) return;
 let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
 const shaders: WebGLShader[] = [];
 const release = () => { if(buffer) gl!.deleteBuffer(buffer); if(program) gl!.deleteProgram(program); shaders.forEach(s=>gl!.deleteShader(s)); };
 const compile = (type:number, source:string) => { const s=gl!.createShader(type); if(!s) return null; shaders.push(s); gl!.shaderSource(s,source); gl!.compileShader(s); return gl!.getShaderParameter(s,gl!.COMPILE_STATUS) ? s : null; };
 const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
 if(!vs || !fs) { release(); return; }
 program=gl.createProgram(); if(!program) { release(); return; }
 gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)) { release(); return; }
 buffer=gl.createBuffer(); if(!buffer) { release(); return; }
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'p'), resolution=gl.getUniformLocation(program,'resolution'), angle=gl.getUniformLocation(program,'angle');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let raf=0, stopped=false, lost=false, t=0, previous=0;
 function render(now:number) {
  raf=0; if(stopped || lost || document.hidden) return;
  const box=canvas!.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,1.25);
  const w=Math.max(1,Math.round(box.width*dpr)), h=Math.max(1,Math.round(box.height*dpr));
  if(canvas!.width!==w||canvas!.height!==h){canvas!.width=w;canvas!.height=h;gl!.viewport(0,0,w,h);}
  if(!reduced.matches && previous) t+=Math.min(now-previous,50); previous=now;
  gl!.clearColor(0,0,0,0);gl!.clear(gl!.COLOR_BUFFER_BIT);
  gl!.useProgram(program);gl!.bindBuffer(gl!.ARRAY_BUFFER,buffer);gl!.enableVertexAttribArray(position);gl!.vertexAttribPointer(position,2,gl!.FLOAT,false,0,0);
  gl!.uniform2f(resolution,w,h);gl!.uniform1f(angle,t*.00018);gl!.drawArrays(gl!.TRIANGLE_STRIP,0,4);
  if(!reduced.matches) raf=requestAnimationFrame(render);
 }
 function schedule(){previous=0;cancelAnimationFrame(raf);raf=0;if(!stopped&&!lost&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(render);}
 function contextLost(event: Event){event.preventDefault();lost=true;cancelAnimationFrame(raf);}
 function contextRestored(){cleanup();mount(root);}
 function cleanup(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule);canvas!.removeEventListener('webglcontextlost',contextLost);canvas!.removeEventListener('webglcontextrestored',contextRestored);window.removeEventListener('pagehide',cleanup);release();delete root.novaCleanup;}
 root.novaCleanup=cleanup;
 document.addEventListener('visibilitychange',schedule);window.addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',schedule);canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);window.addEventListener('pagehide',cleanup,{once:true});schedule();
}
export function mountNovaCore(){document.querySelectorAll<Root>('[data-nova-core]').forEach(root=>{if(!root.novaCleanup)mount(root);});}
window.addEventListener('pageshow', event => { if (event.persisted) mountNovaCore(); });
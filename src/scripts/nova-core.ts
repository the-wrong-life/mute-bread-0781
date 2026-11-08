type Root = HTMLElement & { novaCleanup?: () => void };
const vertex = 'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}';
const fragment = `precision mediump float;
uniform vec2 resolution;
uniform float angle;
void main() {
 vec2 p=(gl_FragCoord.xy*2.0-resolution)/min(resolution.x,resolution.y);
 float r=dot(p,p); if(r>0.92) discard;
 vec3 normal=normalize(vec3(p,sqrt(max(0.0,0.92-r))));
 vec3 light=normalize(vec3(-0.5,0.7,0.8));
 float diffuse=max(dot(normal,light),0.0);
 float longitude=atan(normal.z,normal.x)+angle;
 float latitude=asin(normal.y);
 float grid=pow(max(0.0,cos(longitude*12.0)*cos(latitude*14.0)),24.0);
 float rim=pow(1.0-normal.z,2.0);
 vec3 color=vec3(.018,.06,.13)+vec3(.05,.42,.50)*diffuse+vec3(.28,.72,.80)*grid*.5+vec3(.12,.47,.58)*rim;
 gl_FragColor=vec4(color,1.0);
}`;

function mount(root: Root) {
 const canvas = root.querySelector('canvas'); if (!canvas) return;
 const gl = canvas.getContext('webgl', { alpha:true, antialias:true, powerPreference:'low-power' }); if (!gl) return;
 let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
 const shaders: WebGLShader[] = [];
 const release = () => { if(buffer) gl.deleteBuffer(buffer); if(program) gl.deleteProgram(program); shaders.forEach(s=>gl.deleteShader(s)); };
 const compile = (type:number, source:string) => { const s=gl.createShader(type); if(!s) return null; shaders.push(s); gl.shaderSource(s,source); gl.compileShader(s); return gl.getShaderParameter(s,gl.COMPILE_STATUS) ? s : null; };
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
  const box=canvas!.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(box.width*dpr)), h=Math.max(1,Math.round(box.height*dpr));
  if(canvas!.width!==w||canvas!.height!==h){canvas!.width=w;canvas!.height=h;gl!.viewport(0,0,w,h);}
  if(!reduced.matches && previous) t+=Math.min(now-previous,50); previous=now;
  gl!.useProgram(program); gl!.bindBuffer(gl!.ARRAY_BUFFER,buffer); gl!.enableVertexAttribArray(position); gl!.vertexAttribPointer(position,2,gl!.FLOAT,false,0,0);
  gl!.uniform2f(resolution,w,h);gl!.uniform1f(angle,t*.00025);gl!.drawArrays(gl!.TRIANGLE_STRIP,0,4);
  root.classList.add('ready');
  if(!reduced.matches) raf=requestAnimationFrame(render);
 }
 function schedule(){previous=0;cancelAnimationFrame(raf);raf=0;if(!stopped&&!lost&&!document.hidden)raf=requestAnimationFrame(render);}
 function contextLost(event: Event){event.preventDefault();lost=true;cancelAnimationFrame(raf);root.classList.remove('ready');}
 function contextRestored(){cleanup();mount(root);}
 function cleanup(){stopped=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule);canvas!.removeEventListener('webglcontextlost',contextLost);canvas!.removeEventListener('webglcontextrestored',contextRestored);window.removeEventListener('pagehide',cleanup);release();root.classList.remove('ready');delete root.novaCleanup;}
 root.novaCleanup=cleanup;
 document.addEventListener('visibilitychange',schedule);window.addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',schedule);canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);window.addEventListener('pagehide',cleanup,{once:true});schedule();
}
export function mountNovaCore(){document.querySelectorAll<Root>('[data-nova-core]').forEach(root=>{if(!root.novaCleanup)mount(root);});}
window.addEventListener('pageshow', event => { if (event.persisted) mountNovaCore(); });

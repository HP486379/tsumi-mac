import { CHASSIS_VERTEX_SHADER,ChassisRenderer } from '../../src/game/rendering/chassisRenderer';
import { chassisMesh } from '../../src/game/rendering/chassisMesh';
import { projectWorld } from '../../src/game/rendering/chassisProjection';
import { makeItem } from '../sync/audit';
import { MINI_KINDS,MINI_MM,referenceMesh,auditReference,type MiniKind } from './reference';
import { auditSurfaces } from '../surface/audit';

const fragment=`precision mediump float;
varying vec3 local,norm,surface;
uniform vec3 dimensions;uniform float kind;
float port(vec2 p,vec2 c){vec2 q=abs(p-c)-vec2(3.2,.8);return length(max(q,0.))+min(max(q.x,q.y),0.)-.65;}
void main(){
 vec3 n=normalize(norm);float light=.68+.38*max(0.,dot(n,normalize(vec3(-.35,-.8,-.6))));
 float reflection=.1*pow(max(0.,dot(n,normalize(vec3(-.2,-.6,-1.)))),12.);
 vec3 color=vec3(.76,.78,.81)*light+reflection;
 if(local.y>dimensions.y*.5-(kind>.5?1.8:1.))color*=.42;
 if(surface.z<-.98){
   if(kind>.5){float hole=min(port(local.xy,vec2(-20.,dimensions.y*.13)),port(local.xy,vec2(-1.,dimensions.y*.13)));
     hole=min(hole,length(local.xy-vec2(24.,dimensions.y*.13))-1.75);
     color=mix(color,vec3(.045,.052,.06),1.-smoothstep(-.1,.2,hole));
   }else if(length(local.xy-vec2(dimensions.x*.35,dimensions.y*.12))<.8)color=vec3(.88,.95,.89);
 }
 gl_FragColor=vec4(color,1.);
}`;
class ReferenceRenderer {
  canvas=document.createElement('canvas');gl:WebGLRenderingContext;program:WebGLProgram;
  constructor(){const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL required for reference preview');this.gl=gl;
    const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)!);return s;};
    const p=gl.createProgram()!;gl.attachShader(p,compile(gl.VERTEX_SHADER,CHASSIS_VERTEX_SHADER));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)!);this.program=p;
  }
  draw(kind:MiniKind){const gl=this.gl,p=this.program,d=MINI_MM[kind],m=referenceMesh(kind);this.canvas.width=1200;this.canvas.height=960;
    gl.viewport(0,0,1200,960);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(p);
    const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(m.flatMap(v=>[...v.p,...v.n])),gl.STATIC_DRAW);
    for(const [name,offset] of [['position',0],['normal',12]] as const){const loc=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
    gl.uniform2f(gl.getUniformLocation(p,'viewport'),400,320);gl.uniform2f(gl.getUniformLocation(p,'xyScale'),1,1);
    gl.uniform4f(gl.getUniformLocation(p,'pose'),125,170-d.h/2,0,0);gl.uniform3f(gl.getUniformLocation(p,'dimensions'),d.w,d.h,d.d);gl.uniform1f(gl.getUniformLocation(p,'kind'),kind==='miniM4'?1:0);
    gl.drawArrays(gl.TRIANGLES,0,m.length);gl.deleteBuffer(buffer);return this.canvas;
  }
}
const reference=new ReferenceRenderer(),game=new ChassisRenderer(),F=197/72;
for(const mode of ['current','reference'] as const){const row=document.createElement('section');row.className=mode;row.innerHTML=`<h2>${mode==='current'?'Before: current game mapping, enlarged uniformly to M1 width 197':'After: undistorted reference prototype — NOT applied to the game'}</h2><div class="cards"></div>`;document.querySelector('main')!.append(row);
  for(const kind of MINI_KINDS){const card=document.createElement('article'),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=960;canvas.className='model';const ctx=canvas.getContext('2d')!;ctx.scale(3,3);ctx.fillStyle='#111620';ctx.fillRect(0,0,400,320);
    const floor=[[15,170,0],[235,170,0],[235,170,210],[15,170,210]].map(p=>projectWorld(p[0]!,p[1]!,p[2]!));ctx.beginPath();floor.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#1b2637';ctx.fill();ctx.strokeStyle='#496077';ctx.lineWidth=.6;ctx.stroke();
    if(mode==='reference')ctx.drawImage(reference.draw(kind),0,0,400,320);
    else{const item=makeItem(kind,180,630);const layer=game.draw([item],1200,2112);ctx.drawImage(layer,133-F*(28+.84*180),206-F*(38+.12*180+.9*648),400*F,704*F);}
    const d=mode==='reference'?MINI_MM[kind]:{w:kind==='miniM4'?98.5:197,h:98.5,d:kind==='miniM4'?98.5:197};
    card.innerHTML=`<h3>${kind}</h3>`;card.append(canvas);const label=document.createElement('p');label.textContent=`W ${d.w} × D ${d.d} × H ${d.h} (${mode==='reference'?'mm':'M1-normalized units'})`;card.append(label);
    const front=document.createElement('canvas');front.width=1200;front.height=360;front.className='front-reference';const f=front.getContext('2d')!;f.scale(3,3);f.fillStyle='#10141d';f.fillRect(0,0,400,120);f.strokeStyle='#6f8197';f.beginPath();f.moveTo(20,105);f.lineTo(380,105);f.stroke();f.fillStyle='#c6cbd2';f.beginPath();f.roundRect(200-d.w/2,105-d.h,d.w,d.h,mode==='reference'?(kind==='miniM4'?5:2):4);f.fill();card.append(front);
    const note=document.createElement('small');note.textContent='Front dimension diagram; same scale in every panel (not the game front view)';card.append(note);row.querySelector('.cards')!.append(card);
  }
}
const audit=auditReference();
Object.assign(window,{miniReference:{audit,ratio:{width:127/197,height:50/36,depth:127/197,footprint:127**2/197**2},currentContacts:auditSurfaces()}});
// Keep the current-mesh dependency exercised in the preview without replacing it.
if(!chassisMesh(makeItem('miniM4')).length)throw Error('Missing baseline geometry');

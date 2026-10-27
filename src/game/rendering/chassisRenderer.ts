import { chassisMesh, modelDimensions } from './chassisMesh';
import { CELL } from '../config';
import type { RenderItem } from './renderer';
import { SoftwareChassis } from './softwareChassis';

const vertex = `
attribute vec3 position, normal;
uniform vec4 pose;
uniform vec2 viewport;
varying vec3 local, norm, surface;
void main() {
  mat2 rotation=mat2(cos(pose.z),sin(pose.z),-sin(pose.z),cos(pose.z));
  local=position; surface=normal; norm=vec3(rotation*normal.xy,normal.z);
  vec2 p=pose.xy+rotation*position.xy;
  vec2 screen=vec2(28.+.84*p.x+.42*position.z,38.+.12*p.x+.9*p.y-.273*position.z);
  gl_Position=vec4(screen/viewport*vec2(2.,-2.)+vec2(-1.,1.),position.z/1024.,1.);
}`;
const fragment = `
precision mediump float;
varying vec3 local, norm, surface;
uniform vec3 dimensions;
uniform float kind, active, refurb, cutTop, cutBottom;
void main() {
  vec3 n=normalize(norm), base=vec3(.70,.73,.77);
  float light=.68+.38*max(0.,dot(n,normalize(vec3(-.35,-.8,-.6))));
  float reflection=.08*pow(max(0.,dot(n,normalize(vec3(-.2,-.6,-1.)))),12.);
  vec3 color=base*light+reflection;
  float front=1.-step(-.93,surface.z);
  if(kind==3.) {
    color=vec3(.035,.043,.055)+vec3(.26,.29,.33)*pow(max(0.,dot(n,normalize(vec3(-.25,-.2,-1.)))),10.);
    if(surface.y<-.8) {
      vec2 q=vec2(local.x,local.z-dimensions.z*.5)/(dimensions.x*.5);
      float r=length(q);
      color=mix(vec3(.018,.022,.028),vec3(.23,.25,.28),smoothstep(.72,.87,r))*light;
    }
    if(cutTop>.5 && surface.y<-.8 || cutBottom>.5 && surface.y>.8) color=vec3(.12,.14,.17);
    if(refurb>.5 && front>.5 && local.x>dimensions.x*.17 && local.y<-dimensions.y*.15) color=vec3(.1,.55,.34);
  } else {
    if(kind==2. && front>.5 && abs(local.x)<dimensions.x*.40 && abs(local.y)<dimensions.y*.40) {
      vec2 uv=vec2(local.x,local.y)/3.4;
      uv.x+=mod(floor(uv.y),2.)*.5;
      float hole=1.-smoothstep(.24,.36,length(fract(uv)-.5));
      color=mix(color,vec3(.15,.18,.21),hole);
    }
    if(front>.5 && kind<2.) {
      float py=local.y/dimensions.y;
      if(kind==1. && py>.13 && py<.27) {
        float x=local.x/dimensions.x;
        if((x>-.33 && x<-.28)||(x>-.21 && x<-.16)) color=vec3(.09,.11,.13);
        if(dimensions.x>50. && x>-.03 && x<.17 && py>.17 && py<.21) color=vec3(.09,.11,.13);
      }
      if(abs(local.x-dimensions.x*.35)<1. && abs(local.y-dimensions.y*.12)<.75) color=vec3(.87,.98,.9);
    }
    if(cutBottom<.5 && local.y>dimensions.y*.5-1.3) color*=.48;
    if(cutTop>.5 && surface.y<-.8 || cutBottom>.5 && surface.y>.8) color=vec3(.34,.37,.41);
    if(refurb>.5 && front>.5 && local.x>dimensions.x*.17 && local.y<-dimensions.y*.15) color=vec3(.1,.55,.34);
  }
  if(active>.5) color=mix(color,vec3(.5,.83,1.),.13);
  gl_FragColor=vec4(color,1.);
}`;

/** A single transparent GPU layer: depth testing is shared by EVERY chassis.
 * At equal screen positions smaller Z is nearer, independent of submission order.
 * Canvas2D still owns guides/UI; no Matter bodies or front sprites are involved. */
class GpuChassisRenderer {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext;
  private program!: WebGLProgram;
  private uniforms: Record<string,WebGLUniformLocation|null> = {};
  private attributes: Record<string,number> = {};
  private meshes = new Map<string, { buffer: WebGLBuffer; count: number }>();
  constructor() {
    const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
    if(!gl) throw new Error('Oblique chassis rendering requires WebGL');
    this.gl=gl;
    this.initialize();
    this.canvas.addEventListener('webglcontextlost',e=>e.preventDefault());
    this.canvas.addEventListener('webglcontextrestored',()=> { this.meshes.clear(); this.initialize(); });
  }
  private initialize():void {
    const gl=this.gl;
    const compile=(type:number,source:string) => {
      const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Chassis shader');
      return shader;
    };
    const program=gl.createProgram()!;
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Chassis shader link');
    this.program=program;
    for(const name of ['viewport','pose','dimensions','kind','active','refurb','cutTop','cutBottom']) this.uniforms[name]=gl.getUniformLocation(program,name);
    for(const name of ['position','normal'])this.attributes[name]=gl.getAttribLocation(program,name);
  }
  draw(items:readonly RenderItem[],width:number,height:number):HTMLCanvasElement {
    const gl=this.gl;
    if(this.canvas.width!==width || this.canvas.height!==height) {this.canvas.width=width;this.canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.useProgram(this.program);
    const uniform=(name:string)=>this.uniforms[name]!;
    gl.uniform2f(uniform('viewport'),400,704);
    for(const item of items) {
      const key=JSON.stringify(item.key);
      let mesh=this.meshes.get(key);
      if(!mesh) {
        const vertices=chassisMesh(item),buffer=gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices.flatMap(v=>[...v.p,...v.n])),gl.STATIC_DRAW);
        mesh={buffer,count:vertices.length};this.meshes.set(key,mesh);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      for(const [name,offset] of [['position',0],['normal',12]] as const) {
        const loc=this.attributes[name]!;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);
      }
      const dim=modelDimensions(item);
      // Bottom alignment takes place in local coordinates BEFORE rotation.
      const offset=(item.key.hCells*CELL-dim.h)/2;
      gl.uniform4f(uniform('pose'),item.x-Math.sin(item.angle)*offset,item.y+Math.cos(item.angle)*offset,item.angle,0);
      gl.uniform3f(uniform('dimensions'),dim.w,dim.h,dim.depth);
      gl.uniform1f(uniform('kind'),item.key.kind==='macPro2013'?3:item.key.kind==='pro'?2:item.key.kind==='studio'||item.key.kind==='miniM4'?1:0);
      for(const [name,value] of [['active',item.active],['refurb',item.key.refurb],['cutTop',item.key.cutTop],['cutBottom',item.key.cutBottom]] as const) gl.uniform1f(uniform(name),value?1:0);
      gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    }
    return this.canvas;
  }
  available():boolean {return !this.gl.isContextLost();}
}

// Views are copied into their own Canvas2D immediately. Reuse one GPU context
// across open/close/restart instead of allocating scarce contexts on each toggle.
let sharedGpu: GpuChassisRenderer | null | undefined;
let software: SoftwareChassis | undefined;
export class ChassisRenderer {
  constructor() {if(sharedGpu===undefined) {try {sharedGpu=new GpuChassisRenderer();} catch {sharedGpu=null;}}}
  draw(items:readonly RenderItem[],width:number,height:number):HTMLCanvasElement {
    // Stable ownership only for exactly coplanar/interpenetrating pixels.
    // All ordinary overlap is resolved by the Z buffer, not this order.
    const ordered=items.map(item=>({item,key:JSON.stringify(item)})).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(entry=>entry.item);
    if(sharedGpu?.available())return sharedGpu.draw(ordered,width,height);
    software??=new SoftwareChassis();return software.draw(ordered,width,height);
  }
}

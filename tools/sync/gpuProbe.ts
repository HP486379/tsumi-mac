import { CHASSIS_VERTEX_SHADER } from '../../src/game/rendering/chassisRenderer';
import { chassisPose, projectLocal } from '../../src/game/rendering/chassisProjection';
import { modelDimensions, type V3 } from '../../src/game/rendering/chassisMesh';
import { ANGLES, makeItem } from './audit';
import { DEVICE_KINDS, type DeviceKind } from '../../src/data/devices';
import { deviceCells,type GameMode } from '../../src/data/gameModes';

/** Read actual GPU vertex output, not pixel centers or a second JS projection.
 * Only syntax is upgraded to GLSL 300 for transform feedback; the production
 * rotation, scaling, pose and screen expressions are left verbatim. */
export function gpuProbe(mode:GameMode='classic') {
  const gl=document.createElement('canvas').getContext('webgl2');
  if(!gl)throw Error('WebGL2 transform feedback unavailable');
  const source='#version 300 es\n'+CHASSIS_VERTEX_SHADER.replace(/attribute /g,'in ').replace(/varying /g,'out ').replace('void main()', 'out vec3 probe;\nvoid main()').replace('  gl_Position=', '  probe=vec3(screen,position.z);\n  gl_Position=');
  const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)!);return s;};
  const program=gl.createProgram()!;gl.attachShader(program,shader(gl.VERTEX_SHADER,source));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.);}'));
  gl.transformFeedbackVaryings(program,['probe'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)!);
  gl.useProgram(program);gl.uniform2f(gl.getUniformLocation(program,'viewport'),400,704);
  const input=gl.createBuffer()!,output=gl.createBuffer()!,feedback=gl.createTransformFeedback()!;
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
  const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);
  const rows:{kind:DeviceKind;angle:number;local:V3;expected:ReturnType<typeof projectLocal>;actual:{x:number;y:number;z:number};error:number}[]=[];
  for(const kind of DEVICE_KINDS)for(const angle of ANGLES) {
    const item=makeItem(kind,173.125,392.875,angle);
    if(mode==='real'){const d=deviceCells(kind,mode);item.key={...item.key,mode,wCells:d.w,hCells:d.h};}
    const dim=modelDimensions(item),pose=chassisPose(item);
    const points:V3[]=[[0,0,0],[-dim.w/2,-dim.h/2,0],[dim.w/2,dim.h/2,0],[dim.w/2,-dim.h/2,dim.depth],[0,0,dim.depth/2]];
    gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.STATIC_DRAW);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,points.length*12,gl.STREAM_READ);
    gl.uniform4f(gl.getUniformLocation(program,'pose'),pose.x,pose.y,angle,0);
    gl.uniform2f(gl.getUniformLocation(program,'xyScale'),pose.sx,pose.sy);
    gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,points.length);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
    const actual=new Float32Array(points.length*3);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,actual);
    points.forEach((p,i)=>{const expected=projectLocal(item,p);rows.push({kind,angle,local:p,expected,actual:{x:actual[i*3]!,y:actual[i*3+1]!,z:actual[i*3+2]!},error:Math.hypot(actual[i*3]!-expected.x,actual[i*3+1]!-expected.y)});});
  }
  if(gl.getError()!==gl.NO_ERROR)throw Error('GPU probe GL error');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return {rows,maxError:Math.max(...rows.map(r=>r.error))};
}

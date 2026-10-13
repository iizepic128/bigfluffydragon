import * as THREE from 'three';

// Lightweight, original low-poly car with localized mesh deformation.
// This is *not* a finite-element soft-body solver: each exterior panel has
// deformable vertices, and a sprung chassis simulates body pitch and roll.
type Panel = {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  original: Float32Array;
  displacement: Float32Array;
  velocity: Float32Array;
  active: boolean;
  dirty: boolean;
};
export type CarVisual = {
  root: THREE.Group;
  chassis: THREE.Group;
  panels: Panel[];
  wheels: {pivot: THREE.Group; spin: THREE.Group; tire: THREE.Mesh; hub: THREE.Mesh}[];
  tailLamps: THREE.Mesh[];
  glass: THREE.Mesh;
  damage: number;
  compression: number;
  springVelocity: number;
  pitch: number;
  pitchSpeed: number;
  roll: number;
  rollSpeed: number;
};
const visuals = new WeakMap<THREE.Group, CarVisual>();
const makeMat=(color:number,metalness=.12)=>new THREE.MeshStandardMaterial({color,roughness:.54,metalness});
function addBox(parent:THREE.Group,w:number,h:number,d:number,color:number,x:number,y:number,z:number){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),makeMat(color));
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function panel(group:THREE.Group,visual:CarVisual,w:number,h:number,d:number,color:number,x:number,y:number,z:number){
  const geometry=new THREE.BoxGeometry(w,h,d,8,3,12);
  const mesh=new THREE.Mesh(geometry,makeMat(color,.26));
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  const original=new Float32Array(geometry.attributes.position.array as ArrayLike<number>);
  const displacement=new Float32Array(original.length);
  const velocity=new Float32Array(original.length);
  visual.panels.push({mesh,original,displacement,velocity,active:false,dirty:false});
  return mesh;
}
export function createVehicle(color:number,isPolice=false){
  const root=new THREE.Group();
  const chassis=new THREE.Group();root.add(chassis);
  const visual:CarVisual={root,chassis,panels:[],wheels:[],tailLamps:[],glass:null!,damage:0,compression:0,springVelocity:0,pitch:0,pitchSpeed:0,roll:0,rollSpeed:0};
  visuals.set(root,visual);
  // Deformable main body, hood and boot. They dent at actual contact points.
  panel(chassis,visual,3.8,.98,4.1,color,0,1.35,0);
  panel(chassis,visual,3.65,.63,1.58,color,0,1.43,2.38);
  panel(chassis,visual,3.65,.62,1.32,color,0,1.43,-2.45);
  panel(chassis,visual,3.9,.34,.38,0x64707b,0,.94,3.32);
  panel(chassis,visual,3.9,.34,.38,0x64707b,0,.94,-3.32);
  // Distinct greenhouse with window tint, trim and a realistic-ish roof.
  visual.glass=addBox(chassis,3.05,1.05,3.06,0x214a65,0,2.35,-.35);
  addBox(chassis,3.12,.14,3.16,isPolice?0x172239:color,0,2.95,-.35);
  for(const x of [-1.88,1.88]){
    addBox(chassis,.12,.14,2.3,0x1b2432,x,1.97,-.37);
    for(const z of [-2.35,1.05])addBox(chassis,.3,.4,.5,0x283343,x,1.4,z);
  }
  for(const x of [-1.28,1.28]){
    addBox(chassis,.72,.25,.12,0xf8f3cf,x,1.43,3.35);
    const red=addBox(chassis,.74,.23,.1,0xee3856,x,1.44,-3.35);
    visual.tailLamps.push(red);
  }
  for(const x of [-1.82,1.82])for(const z of [-2.35,2.35]){
    const pivot=new THREE.Group();pivot.position.set(x,.8,z);root.add(pivot);
    // The axle stays on the ground; its tire and hub share the same rotation.
    const spin=new THREE.Group();pivot.add(spin);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.81,.81,.46,20),makeMat(0x14171e));
    tire.rotation.z=Math.PI/2;tire.castShadow=true;spin.add(tire);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.47,10),makeMat(0xb3bdc7,.66));
    hub.rotation.z=Math.PI/2;spin.add(hub);
    visual.wheels.push({pivot,spin,tire,hub});
  }
  if(isPolice){
    addBox(chassis,1.55,.25,.65,0x0b2137,0,3.13,-.3);
    const red=addBox(chassis,.72,.24,.55,0xe63260,-.39,3.28,-.3);
    const blue=addBox(chassis,.72,.24,.55,0x458fff,.39,3.28,-.3);
    red.material.emissive=new THREE.Color(0x4d0011);
    blue.material.emissive=new THREE.Color(0x052459);
  }
  root.userData.radius=2.35;
  return root;
}
export function carDamage(car:THREE.Group){return visuals.get(car)?.damage??0;}
export function repairVehicle(car:THREE.Group){
  const visual=visuals.get(car);if(!visual)return;
  visual.damage=0;
  visual.compression=visual.springVelocity=visual.pitch=visual.pitchSpeed=visual.roll=visual.rollSpeed=0;
  visual.chassis.position.y=0;
  visual.chassis.rotation.set(0,0,0);
  for(const p of visual.panels){
    p.displacement.fill(0);p.velocity.fill(0);
    p.active=false;p.dirty=false;
    const position=p.mesh.geometry.attributes.position as THREE.BufferAttribute;
    (position.array as Float32Array).set(p.original);position.needsUpdate=true;
    p.mesh.geometry.computeVertexNormals();
  }
  // Reuse the material: garage repairs must not allocate abandoned GPU objects.
  (visual.glass.material as THREE.MeshStandardMaterial).color.setHex(0x214a65);
  for(const lamp of visual.tailLamps)lamp.visible=true;
}
/** Apply localized dents in world space. Damage persists until repaired. */
export function dentVehicle(car:THREE.Group,worldPoint:THREE.Vector3,impact:number){
  const visual=visuals.get(car);if(!visual||impact<2)return;
  const amount=Math.min(.65,Math.max(.035,(impact-1.5)*.029));
  const point=visual.chassis.worldToLocal(worldPoint.clone());
  // The impact's location and direction follow the sprung body, including
  // chassis pitch/roll and any parent transform, rather than only root yaw.
  const nx=point.x/(Math.abs(point.x)+Math.abs(point.z)+.0001);
  const nz=point.z/(Math.abs(point.x)+Math.abs(point.z)+.0001);
  const dentX=-Math.sign(point.x)*(.25+.65*Math.abs(nx))*amount;
  const dentZ=-Math.sign(point.z)*(.25+.65*Math.abs(nz))*amount;
  let touched=false;
  for(const p of visual.panels){
    const local=p.mesh.worldToLocal(worldPoint.clone());
    const toPanel=new THREE.Matrix4().copy(p.mesh.matrixWorld).invert().multiply(visual.chassis.matrixWorld);
    const offset=new THREE.Vector3(dentX,-.12*amount,dentZ).applyMatrix3(new THREE.Matrix3().setFromMatrix4(toPanel));
    const a=p.mesh.geometry.attributes.position as THREE.BufferAttribute;
    let panelTouched=false;
    for(let i=0;i<a.count;i++){
      const ix=i*3;
      const x=p.original[ix],y=p.original[ix+1],z=p.original[ix+2];
      const distance=Math.hypot((x-local.x)*.8,(y-local.y)*1.55,(z-local.z)*.85);
      const influence=Math.max(0,1-distance/2.65);
      if(influence===0)continue;
      const softness=influence*influence;
      // Dents accumulate within capped offsets, avoiding inverted body panels.
      p.displacement[ix]=THREE.MathUtils.clamp(p.displacement[ix]+offset.x*softness,-.65,.65);
      p.displacement[ix+1]=THREE.MathUtils.clamp(p.displacement[ix+1]+offset.y*softness,-.3,.1);
      p.displacement[ix+2]=THREE.MathUtils.clamp(p.displacement[ix+2]+offset.z*softness,-.7,.7);
      p.velocity[ix]+=offset.x*softness*4;
      p.velocity[ix+1]+=offset.y*softness*4;
      p.velocity[ix+2]+=offset.z*softness*4;
      panelTouched=true;
    }
    if(panelTouched){p.active=true;p.dirty=true;touched=true;}
  }
  if(touched){
    visual.damage=Math.min(100,visual.damage+amount*15);
    if(visual.damage>48)visual.tailLamps[0].visible=false;
    if(visual.damage>78)visual.tailLamps[1].visible=false;
    if(visual.damage>65)(visual.glass.material as THREE.MeshStandardMaterial).color.setHex(0x131e2b);
    visual.springVelocity+=amount*2.2;
  }
}
export function updateVehicleVisuals(car:THREE.Group,dt:number,speed:number,turn:number,braking:boolean,acceleration=0,lateralAcceleration=0){
  const v=visuals.get(car);if(!v)return;
  const step=Math.max(0,Math.min(dt,.05));
  // Weight shifts under acceleration/braking and cornering. Constant-speed
  // travel settles level, and only the chassis moves so tires stay grounded.
  const targetPitch=THREE.MathUtils.clamp(-acceleration*.0035,-.12,.12);
  const targetRoll=THREE.MathUtils.clamp(lateralAcceleration*.0035,-.12,.12);
  v.pitchSpeed+=((targetPitch-v.pitch)*90-v.pitchSpeed*16)*step;
  v.pitch+=v.pitchSpeed*step;
  v.rollSpeed+=((targetRoll-v.roll)*85-v.rollSpeed*16)*step;
  v.roll+=v.rollSpeed*step;
  v.springVelocity+=(-v.compression*90-v.springVelocity*18)*step;
  v.compression+=v.springVelocity*step;
  if(v.compression<-.1||v.compression>.12){v.compression=THREE.MathUtils.clamp(v.compression,-.1,.12);v.springVelocity=0;}
  v.chassis.position.y=v.compression;
  v.chassis.rotation.x=v.pitch;
  v.chassis.rotation.z=v.roll;
  for(const w of v.wheels){
    w.spin.rotation.x+=speed*step/.81;
    w.pivot.rotation.y=w.pivot.position.z>0?turn*.3:0;
  }
  for(const lamp of v.tailLamps)(lamp.material as THREE.MeshStandardMaterial).emissive.setHex(braking?0x9b142d:0);
  // Finite spring oscillation around the permanent crushed mesh shape.
  for(const p of v.panels){
    if(!p.active&&!p.dirty)continue;
    const arr=p.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const out=arr.array as Float32Array;
    let changed=false,moving=false;
    for(let j=0;j<out.length;j++){
      const target=p.original[j]+p.displacement[j];
      const previous=out[j];
      if(Math.abs(target-previous)<.00015&&Math.abs(p.velocity[j])<.001){
        out[j]=target;p.velocity[j]=0;
      }else{
        p.velocity[j]+=((target-previous)*84-p.velocity[j]*15)*step;
        const axis=j%3;
        const lower=p.original[j]+(axis===0?-.65:axis===1?-.3:-.7);
        const upper=p.original[j]+(axis===0?.65:axis===1?.1:.7);
        const next=previous+p.velocity[j]*step;
        out[j]=THREE.MathUtils.clamp(next,lower,upper);
        if(next<lower||next>upper)p.velocity[j]=0;
        if(Math.abs(target-out[j])<.00015&&Math.abs(p.velocity[j])<.001){out[j]=target;p.velocity[j]=0;}
        else moving=true;
      }
      if(out[j]!==previous)changed=true;
    }
    p.active=moving;
    // Permanent dents do not keep waking the solver or uploading buffers.
    if(changed||p.dirty){arr.needsUpdate=true;p.mesh.geometry.computeVertexNormals();}
    p.dirty=false;
  }
}

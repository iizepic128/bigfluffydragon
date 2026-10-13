import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleMotion, stepVehiclePhysics, updateDrivenVehicle, driveToward, vehicleWorldBlocked, vehicleOverlapsCircle, forwardSpeed } from '../src/vehiclePhysics.ts';

const body = (x=0,z=0,y=0) => ({position:{x,z},rotation:{y}});
const free = () => false;
function fixture(a,b,police=false) {
  const am=createVehicleMotion(),bm=createVehicleMotion(police);
  // No environmental drag in conservation tests: both bodies are driven.
  am.driven=bm.driven=true;
  return {am,bm,map:new Map([[a,am],[b,bm]])};
}
const energy=(m)=>.5*m.mass*(m.vx*m.vx+m.vz*m.vz)+.5/m.inverseInertia*m.spin*m.spin;

test('equal-mass collision transfers momentum without creating energy',()=>{
  const a=body(0,0),b=body(0,6.9),{am,bm,map}=fixture(a,b);am.vz=10;
  const before=energy(am)+energy(bm);const hits=[];
  stepVehiclePhysics([a,b],map,.02,free,e=>hits.push(e));
  assert(Math.abs(am.mass*am.vz+bm.mass*bm.vz-12000)<1e-7);
  assert(bm.vz>0 && b.position.z>6.9);
  assert(energy(am)+energy(bm)<=before+1e-6);
  assert(hits.length>0);
});
test('civilian/patrol and angled contacts conserve linear momentum',()=>{
  const a=body(0,0,.15),b=body(2,5.9,-.2),{am,bm,map}=fixture(a,b,true);
  am.vz=14;am.vx=3;bm.vz=-2;
  const px=am.mass*am.vx+bm.mass*bm.vx,pz=am.mass*am.vz+bm.mass*bm.vz,before=energy(am)+energy(bm);
  stepVehiclePhysics([a,b],map,.03,free);
  assert(Math.abs(am.mass*am.vx+bm.mass*bm.vx-px)<1e-6);
  assert(Math.abs(am.mass*am.vz+bm.mass*bm.vz-pz)<1e-6);
  assert(energy(am)+energy(bm)<=before+1e-5);
});
test('separating contact does not receive an impulse or damage',()=>{
  const a=body(0,0),b=body(0,6.8),{am,bm,map}=fixture(a,b);am.vz=-6;bm.vz=5;
  const hits=[];stepVehiclePhysics([a,b],map,.01,free,e=>hits.push(e));
  assert.equal(am.vz,-6);assert.equal(bm.vz,5);assert.equal(hits.length,0);
});
test('high speed cannot pass through a stationary vehicle',()=>{
  const a=body(0,-12),b=body(0,0),{am,bm,map}=fixture(a,b);am.vz=180;
  stepVehiclePhysics([a,b],map,.1,free);
  assert(bm.vz>0);assert(a.position.z<b.position.z);
  assert(b.position.z-a.position.z>6.9);
});
test('vehicle bumper stops at walls and bodies pinned there stay outside',()=>{
  const a=body(0,0),b=body(0,7.4),{am,bm,map}=fixture(a,b);am.vz=90;
  const wall=(x,z,r)=>z+r>=12;
  for(let i=0;i<15;i++)stepVehiclePhysics([a,b],map,.02,wall);
  assert(!vehicleWorldBlocked(a,a.position.x,a.position.z,a.rotation.y,wall));
  assert(!vehicleWorldBlocked(b,b.position.x,b.position.z,b.rotation.y,wall));
  assert(a.position.z<b.position.z);
});
test('chain of vehicles propagates an impact without generating momentum',()=>{
  const cars=[body(0,0),body(0,7),body(0,14)],motions=cars.map(()=>createVehicleMotion());
  motions.forEach(m=>m.driven=true);motions[0].vz=25;const map=new Map(cars.map((c,i)=>[c,motions[i]]));
  for(let i=0;i<30;i++)stepVehiclePhysics(cars,map,.02,free);
  assert(motions[2].vz>0);assert(Math.abs(motions.reduce((sum,m)=>sum+m.mass*m.vz,0)-30000)<1e-5);
  assert(cars[0].position.z<cars[1].position.z&&cars[1].position.z<cars[2].position.z);
});
test('capsule includes bumper and checks canal clearance across its length',()=>{
  const car=body(0,0);
  assert(vehicleOverlapsCircle(car,0,3.2,.4));
  assert(!vehicleOverlapsCircle(car,4,0,.8));
  const water=(x,z,r)=>Math.abs(x-10)<9+r&&Math.abs(z)+r>=8;
  car.position.x=10;car.position.z=0;car.rotation.y=Math.PI/2;
  assert(!vehicleWorldBlocked(car,10,0,car.rotation.y,water));
  assert(vehicleWorldBlocked(car,10,7,car.rotation.y,water));
});
test('brakes stop both travel directions without reversing and damage reduces acceleration',()=>{
  const car=body(),m=createVehicleMotion();m.vz=10;
  for(let i=0;i<60;i++)updateDrivenVehicle(car,m,1/60,0,0,true);
  assert.equal(m.vz,0);m.vz=-10;
  for(let i=0;i<60;i++)updateDrivenVehicle(car,m,1/60,0,0,true);
  assert.equal(m.vz,0);
  const healthy=createVehicleMotion(),damaged=createVehicleMotion();
  updateDrivenVehicle(car,healthy,.02,1,0,false,0);updateDrivenVehicle(car,damaged,.02,1,0,false,90);
  assert(forwardSpeed(car,healthy)>forwardSpeed(car,damaged));
});
test('lateral impact is retained then traction recovers; AI commands share velocity state',()=>{
  const car=body(),m=createVehicleMotion();m.vx=10;
  updateDrivenVehicle(car,m,.02,0,0,false);
  assert(m.vx>0&&m.vx<10);
  const cop=body(),cm=createVehicleMotion(true);
  driveToward(cop,cm,0,20,13,.05);
  assert(cm.vz>0&&cm.vz<13);
  stepVehiclePhysics([cop],new Map([[cop,cm]]),.05,free);
  assert(cop.position.z>0);
});
test('a turning patrol accelerates along its heading rather than instantly moving sideways',()=>{
  const cop=body(),m=createVehicleMotion(true);
  driveToward(cop,m,20,0,13,.05);
  assert.equal(m.vx,0);
  assert(m.vz>0&&m.spin>0);
});
test('driving integration remains comparable at 30, 60 and 120 frames per second',()=>{
  const drive=(hz)=>{
    const car=body(),m=createVehicleMotion(),map=new Map([[car,m]]);
    for(let i=0;i<hz*4;i++){
      updateDrivenVehicle(car,m,1/hz,1,0,false);
      stepVehiclePhysics([car],map,1/hz,free);
    }
    return {z:car.position.z,speed:m.vz};
  };
  const slow=drive(30),normal=drive(60),fast=drive(120);
  assert(Math.abs(slow.z-fast.z)<1.5);
  assert(Math.abs(normal.z-fast.z)<.75);
  assert(Math.abs(slow.speed-fast.speed)<.2);
});
test('large saved upgrade counts retain bounded handling rather than enormous substeps',()=>{
  const car=body(),m=createVehicleMotion();
  for(let i=0;i<600;i++)updateDrivenVehicle(car,m,.05,1,0,false,0,Number.MAX_SAFE_INTEGER);
  assert(Number.isFinite(m.vz)&&m.vz<=55);
});

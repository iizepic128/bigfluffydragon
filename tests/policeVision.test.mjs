import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POLICE_CAR_VISION_RANGE,
  POLICE_OFFICER_VISION_RANGE,
  POLICE_VISION_FOV,
  POLICE_AWARENESS_RADIUS,
  inPoliceVisionCone,
  policeVisionRayDistance,
  policeVisionOutline,
} from '../src/policeVision.ts';

const observer = {x:0,z:0,heading:0};
const polar = (heading,distance) => ({x:Math.sin(heading)*distance,z:Math.cos(heading)*distance});

test('police cones face +Z and use the same ranges for patrols and officers', () => {
  assert.equal(inPoliceVisionCone(observer,{x:0,z:47},POLICE_CAR_VISION_RANGE),true);
  assert.equal(inPoliceVisionCone(observer,{x:0,z:47.01},POLICE_CAR_VISION_RANGE),false);
  assert.equal(inPoliceVisionCone(observer,{x:0,z:34},POLICE_OFFICER_VISION_RANGE),true);
  assert.equal(inPoliceVisionCone(observer,{x:0,z:34.01},POLICE_OFFICER_VISION_RANGE),false);
  assert.equal(inPoliceVisionCone(observer,{x:0,z:-10},POLICE_CAR_VISION_RANGE),false);
  assert.equal(inPoliceVisionCone(observer,{x:10,z:0},POLICE_CAR_VISION_RANGE),false);
});

test('the 120-degree field includes its boundaries and rejects targets just outside them', () => {
  for(const sign of [-1,1]) {
    assert.equal(inPoliceVisionCone(observer,polar(sign*POLICE_VISION_FOV/2,20),47),true);
    assert.equal(inPoliceVisionCone(observer,polar(sign*(POLICE_VISION_FOV/2+.001),20),47),false);
  }
});

test('wrapped headings and both cardinal directions preserve facing', () => {
  for(const heading of [Math.PI/2,-Math.PI/2,Math.PI,-Math.PI,Math.PI*5,-Math.PI*5]) {
    const cop = {...observer,heading};
    assert.equal(inPoliceVisionCone(cop,polar(heading,30),47),true);
    assert.equal(inPoliceVisionCone(cop,polar(heading+Math.PI,30),47),false);
  }
});

test('close awareness notices nearby people behind an officer without extending range', () => {
  assert.equal(inPoliceVisionCone(observer,{x:0,z:-POLICE_AWARENESS_RADIUS},47),true);
  assert.equal(inPoliceVisionCone(observer,{x:0,z:-POLICE_AWARENESS_RADIUS-.001},47),false);
  assert.equal(inPoliceVisionCone(observer,{x:0,z:-2},1),false);
  assert.equal(inPoliceVisionCone(observer,{x:0,z:0},47),true);
});

test('map rays stop at the nearest wall, ignoring buildings behind or beside the ray', () => {
  const frontWall = {x:0,z:20,halfX:6,halfZ:3};
  const fartherWall = {x:0,z:36,halfX:8,halfZ:2};
  const rearWall = {x:0,z:-10,halfX:4,halfZ:2};
  const sideWall = {x:20,z:0,halfX:2,halfZ:4};
  assert.equal(policeVisionRayDistance(observer,0,47,[frontWall,fartherWall,rearWall,sideWall]),17);
  assert.equal(policeVisionRayDistance(observer,0,47,[fartherWall,frontWall]),17);
  assert.equal(policeVisionRayDistance(observer,0,47,[rearWall,sideWall]),47);
  assert.equal(policeVisionRayDistance(observer,Math.PI/2,47,[sideWall]),18);
  assert.equal(policeVisionRayDistance(observer,0,10,[frontWall]),10);
});

test('diagonal clipping, surface starts and inside blockers avoid drawing through cover', () => {
  const diagonalWall = {x:10,z:10,halfX:2,halfZ:2};
  assert.ok(Math.abs(policeVisionRayDistance(observer,Math.PI/4,47,[diagonalWall])-Math.sqrt(128))<1e-10);
  const wall = {x:0,z:10,halfX:3,halfZ:2};
  assert.equal(policeVisionRayDistance({x:0,z:8},0,47,[wall]),0);
  assert.equal(policeVisionRayDistance({x:0,z:10},0,47,[wall]),0);
});

test('map sight outlines include wall shadows and full-range open directions', () => {
  const wall = {x:0,z:20,halfX:6,halfZ:3};
  const points = policeVisionOutline(observer,47,POLICE_VISION_FOV,[wall]);
  assert.ok(points.length>17,'building corners add silhouette rays between the regular fan');
  const forward = points.filter(p=>Math.abs(p.x)<1e-8);
  assert.ok(forward.length>0);
  for(const p of forward) assert.equal(p.z,17);
  assert.ok(Math.abs(Math.hypot(points[0].x,points[0].z)-47)<1e-10);
  assert.ok(Math.abs(Math.hypot(points.at(-1).x,points.at(-1).z)-47)<1e-10);
  for(const point of points) {
    assert.ok(Math.hypot(point.x,point.z)<=47+1e-8);
    assert.equal(inPoliceVisionCone(observer,point,47+1e-8),true);
  }
});

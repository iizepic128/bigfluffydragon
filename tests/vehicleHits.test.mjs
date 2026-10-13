import assert from 'node:assert/strict';
import test from 'node:test';
import {sweptVehicleHit} from '../src/vehicleHits.ts';

const pose = (x=0,z=0,heading=0) => ({x,z,heading});
const hit = (from,to,target) => sweptVehicleHit(from,to,target,1.98,1.5,0.6);

test('the long capsule reaches both bumpers without widening the car sides', () => {
  assert.equal(hit(pose(),pose(0,0.1),{x:0,z:3.9}),true);
  assert.equal(hit(pose(),pose(0,-0.1),{x:0,z:-3.9}),true);
  assert.equal(hit(pose(),pose(0,0.1),{x:2.7,z:0}),false);
  assert.equal(hit(pose(),pose(0,0.1),{x:2.58,z:0}),true);
});

test('analytic sweeps catch fast forward, reverse and diagonal impacts between poses', () => {
  assert.equal(hit(pose(0,-100),pose(0,100),{x:0,z:0}),true);
  assert.equal(hit(pose(0,100),pose(0,-100),{x:0,z:0}),true);
  assert.equal(hit(pose(-50,-50,Math.PI/4),pose(50,50,Math.PI/4),{x:0,z:0}),true);
  assert.equal(hit(pose(0,-100),pose(0,100),{x:2.7,z:0}),false);
});

test('a sideways sliding car sweeps the capsule interior between its endpoints', () => {
  assert.equal(hit(pose(-10,0),pose(10,0),{x:0,z:0}),true);
  assert.equal(hit(pose(-10,0),pose(10,0),{x:0,z:4.2}),false);
});

test('rotation hits through the bumper arc and respects its conservative footprint', () => {
  // Both endpoint capsules miss; the rotating front bumper crosses this point.
  const target = {x:Math.SQRT1_2*3.5,z:Math.SQRT1_2*3.5};
  assert.equal(sweptVehicleHit(pose(),pose(0,0,Math.PI/2),target,0.8,3,0.1),true);
  assert.equal(sweptVehicleHit(pose(),pose(0,0,Math.PI/2),{x:4,z:4},0.8,3,0.1),false);
});

test('wrapped headings take the short rotation rather than sweeping the opposite side', () => {
  const from = pose(0,0,Math.PI-0.08);
  const to = pose(0,0,-Math.PI+0.08);
  assert.equal(sweptVehicleHit(from,to,{x:0,z:-3.5},0.4,3.5,0.1),true);
  assert.equal(sweptVehicleHit(from,to,{x:3.5,z:0},0.4,3.5,0.1),false);
});

test('parked overlapping vehicles cannot repeatedly hit officers', () => {
  assert.equal(hit(pose(),pose(),{x:0,z:0}),false);
  assert.equal(hit(pose(),pose(0,0,Math.PI*2),{x:0,z:0}),false);
});

test('actual wall-clipped motion stops the sweep before officers behind a wall', () => {
  const officerBehindWall = {x:0,z:10};
  assert.equal(hit(pose(),pose(0,4),officerBehindWall),false);
  assert.equal(hit(pose(),pose(0,12),officerBehindWall),true);
});

test('invalid positions, headings, and collider dimensions are rejected', () => {
  for(const invalid of [NaN,Infinity,-Infinity]) {
    assert.equal(hit(pose(invalid,0),pose(0,1),{x:0,z:0}),false);
    assert.equal(hit(pose(),pose(0,1,invalid),{x:0,z:0}),false);
    assert.equal(hit(pose(),pose(0,1),{x:invalid,z:0}),false);
    assert.equal(sweptVehicleHit(pose(),pose(0,1),{x:0,z:0},invalid,1.5,0.6),false);
    assert.equal(sweptVehicleHit(pose(),pose(0,1),{x:0,z:0},1.98,invalid,0.6),false);
    assert.equal(sweptVehicleHit(pose(),pose(0,1),{x:0,z:0},1.98,1.5,invalid),false);
  }
  for(const dimensions of [[-1,1.5,0.6],[1.98,-1,0.6],[1.98,1.5,-1]]) {
    assert.equal(sweptVehicleHit(pose(),pose(0,1),{x:0,z:0},...dimensions),false);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {vehicleMapHeading} from '../src/mapHeading.ts';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('north-to-south travel points the north-up map arrow downward', () => {
  close(vehicleMapHeading(0, 0, -12), Math.PI);
  close(vehicleMapHeading(Math.PI, 0, 12), 0);
});

test('world velocity maps all cardinal and diagonal directions to the canvas arrow', () => {
  for (const [vx, vz, heading, screenX, screenY] of [
    [0, 12, 0, 0, -1],
    [12, 0, Math.PI / 2, 1, 0],
    [0, -12, Math.PI, 0, 1],
    [-12, 0, -Math.PI / 2, -1, 0],
    [12, 12, Math.PI / 4, Math.SQRT1_2, -Math.SQRT1_2],
    [-12, -12, -3 * Math.PI / 4, -Math.SQRT1_2, Math.SQRT1_2],
  ]) {
    const result = vehicleMapHeading(1.234, vx, vz);
    close(result, heading);
    // The existing Canvas rotation transforms the upward arrow as (sin(yaw), -cos(yaw)).
    close(Math.sin(result), screenX);
    close(-Math.cos(result), screenY);
  }
});

test('reverse and sideways impact momentum follow travel rather than body facing', () => {
  close(vehicleMapHeading(0, 0, -8), Math.PI);
  close(vehicleMapHeading(Math.PI / 2, -8, 0), -Math.PI / 2);
  close(vehicleMapHeading(0, 8, 0), Math.PI / 2);
  close(vehicleMapHeading(Math.PI / 2, 0, 8), 0);
});

test('wrapped body yaw cannot reverse or offset a moving arrow', () => {
  for (const facing of [0, 2 * Math.PI, -4 * Math.PI, 5 * Math.PI, -5 * Math.PI]) {
    close(vehicleMapHeading(facing, 0, -8), Math.PI);
    close(vehicleMapHeading(facing, 8, 0), Math.PI / 2);
  }
});

test('stopped and tiny settling velocities retain facing without direction jitter', () => {
  const facing = 5 * Math.PI;
  for (const [vx, vz] of [[0, 0], [.001, -.001], [.3, .4], [0, -.5], [-.5, 0]]) {
    assert.equal(vehicleMapHeading(facing, vx, vz), facing);
  }
  close(vehicleMapHeading(facing, 0, .501), 0);
});

test('invalid velocity uses safe facing and invalid facing can use valid travel', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(vehicleMapHeading(.75, invalid, 8), .75);
    assert.equal(vehicleMapHeading(.75, 8, invalid), .75);
    assert.equal(vehicleMapHeading(invalid, 0, 0), 0);
    assert.equal(vehicleMapHeading(invalid, invalid, invalid), 0);
    close(vehicleMapHeading(invalid, 8, 0), Math.PI / 2);
  }
});

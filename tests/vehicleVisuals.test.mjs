import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createVehicle, dentVehicle, carDamage, repairVehicle, updateVehicleVisuals } from '../src/vehicleVisuals.ts';

const chassis = car => car.children[0];
const panels = car => chassis(car).children.filter(child => child.isMesh && child.geometry.attributes.position.count > 24);
const positions = mesh => mesh.geometry.attributes.position;
const settle = (car, frames = 480) => {
  for (let frame = 0; frame < frames; frame++) updateVehicleVisuals(car, 1 / 60, 0, 0, false);
};

test('front axles steer on both sides and tires and hubs share coherent axle spin', () => {
  const car = createVehicle(0x56b3ff);
  updateVehicleVisuals(car, 1 / 60, 12, .8, false);
  const wheels = car.children.slice(1);
  assert.equal(wheels.length, 4);
  for (const pivot of wheels) {
    assert.equal(pivot.rotation.y, pivot.position.z > 0 ? .8 * .3 : 0);
    const spin = pivot.children[0];
    assert.equal(spin.children.length, 2);
    assert.ok(Math.abs(spin.rotation.x - 12 / 60 / .81) < 1e-10);
    for (const wheelMesh of spin.children) {
      assert.equal(wheelMesh.rotation.x, 0);
      assert.equal(wheelMesh.rotation.z, Math.PI / 2);
    }
    assert.equal(pivot.position.y, .8);
  }
  updateVehicleVisuals(car, 1 / 60, -12, 0, false);
  for (const pivot of wheels) assert.ok(Math.abs(pivot.children[0].rotation.x) < 1e-10);
});

test('localized dents use the complete panel world transform including chassis suspension', () => {
  const level = createVehicle(0x56b3ff);
  const tilted = createVehicle(0x56b3ff);
  tilted.position.set(28, .1, -19);
  tilted.rotation.set(-.03, .73, .06);
  tilted.scale.setScalar(1.15);
  chassis(tilted).position.y = .075;
  chassis(tilted).rotation.set(.11, 0, -.09);
  const localContact = new THREE.Vector3(1.85, 1.42, 2.55);
  dentVehicle(level, chassis(level).localToWorld(localContact.clone()), 14);
  dentVehicle(tilted, chassis(tilted).localToWorld(localContact.clone()), 14);
  settle(level);
  settle(tilted);
  assert.ok(carDamage(level) > 0);
  assert.equal(carDamage(level), carDamage(tilted));
  panels(level).forEach((mesh, index) => {
    const expected = positions(mesh).array;
    const actual = positions(panels(tilted)[index]).array;
    for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(expected[i] - actual[i]) < 1e-6, `panel ${index}, component ${i}`);
  });
});

test('settled deformed panels sleep without uploads or normals work and wake on a new impact', () => {
  const car = createVehicle(0x56b3ff);
  const bodyPanels = panels(car);
  let normalsCalls = 0;
  for (const mesh of bodyPanels) {
    const compute = mesh.geometry.computeVertexNormals;
    mesh.geometry.computeVertexNormals = function () { normalsCalls++; return compute.call(this); };
  }
  const contact = new THREE.Vector3(1.85, 1.42, 2.55);
  dentVehicle(car, contact, 18);
  settle(car);
  const callsAfterSettling = normalsCalls;
  assert.ok(callsAfterSettling > 0);
  const versions = bodyPanels.map(mesh => positions(mesh).version);
  const snapshots = bodyPanels.map(mesh => Array.from(positions(mesh).array));
  settle(car, 120);
  assert.equal(normalsCalls, callsAfterSettling);
  bodyPanels.forEach((mesh, index) => {
    assert.equal(positions(mesh).version, versions[index]);
    assert.deepEqual(Array.from(positions(mesh).array), snapshots[index]);
  });
  dentVehicle(car, contact, 8);
  updateVehicleVisuals(car, 1 / 60, 0, 0, false);
  assert.ok(normalsCalls > callsAfterSettling);
});

test('repeated impacts remain bounded and repair restores geometry, materials and suspension sleep', () => {
  const car = createVehicle(0x56b3ff);
  const bodyPanels = panels(car);
  const originals = bodyPanels.map(mesh => Array.from(positions(mesh).array));
  const materials = chassis(car).children.filter(child => child.isMesh).map(child => child.material);
  for (let hit = 0; hit < 30; hit++) {
    dentVehicle(car, new THREE.Vector3(1.85, 1.42, 2.55), 80);
    updateVehicleVisuals(car, .05, 12, .4, true, -18, 10);
  }
  settle(car);
  assert.equal(carDamage(car), 100);
  bodyPanels.forEach((mesh, index) => {
    const current = positions(mesh).array;
    for (let i = 0; i < current.length; i++) {
      const axis = i % 3;
      const lower = axis === 0 ? -.65 : axis === 1 ? -.3 : -.7;
      const upper = axis === 0 ? .65 : axis === 1 ? .1 : .7;
      const offset = current[i] - originals[index][i];
      assert.ok(offset >= lower - 1e-6 && offset <= upper + 1e-6);
    }
  });
  for (let frame = 0; frame < 60; frame++) updateVehicleVisuals(car, 1 / 60, 12, .4, true, -18, 10);
  assert.ok(chassis(car).rotation.x > 0);
  assert.ok(chassis(car).rotation.z > 0);
  repairVehicle(car);
  assert.equal(carDamage(car), 0);
  assert.equal(chassis(car).position.y, 0);
  assert.equal(chassis(car).rotation.x, 0);
  assert.equal(chassis(car).rotation.z, 0);
  bodyPanels.forEach((mesh, index) => assert.deepEqual(Array.from(positions(mesh).array), originals[index]));
  const repairedMaterials = chassis(car).children.filter(child => child.isMesh).map(child => child.material);
  repairedMaterials.forEach((material, index) => assert.equal(material, materials[index]));
  const versions = bodyPanels.map(mesh => positions(mesh).version);
  for (let frame = 0; frame < 120; frame++) updateVehicleVisuals(car, 1 / 60, 30, 0, false);
  bodyPanels.forEach((mesh, index) => assert.equal(positions(mesh).version, versions[index]));
  assert.equal(chassis(car).rotation.x, 0, 'constant speed must not cause acceleration lean');
});

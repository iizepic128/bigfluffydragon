import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Ragdoll } from '../src/ragdoll.ts';

const create = (scene, lifetime) => new Ragdoll(scene,new THREE.Vector3(),0,0x1b4673,0xf0bd95,0x333b53,new THREE.Vector3(0,0,1),12,lifetime);
test('officer ragdolls expire on recovery while original pedestrian lifetime stays intact',()=>{
  const scene=new THREE.Scene(),officer=create(scene,6.5),pedestrian=create(scene);
  assert.equal(officer.lifetime,6.5);assert.equal(pedestrian.lifetime,28);
  assert.equal(officer.update(6.6),false);assert.equal(pedestrian.update(6.6),true);
  officer.dispose(scene);pedestrian.dispose(scene);
});
test('ragdoll expiry disposes its own materials and removes its scene group',()=>{
  const scene=new THREE.Scene(),doll=create(scene,6.5);
  const materials=new Set(doll.group.children.map(mesh=>mesh.material));
  let disposals=0;for(const material of materials)material.addEventListener('dispose',()=>disposals++);
  assert(scene.children.includes(doll.group));doll.dispose(scene);
  assert(!scene.children.includes(doll.group));assert.equal(disposals,materials.size);
});

import * as THREE from 'three';

// Lightweight articulated Verlet ragdoll: particles with gravity + distance
// constraints. It is intentionally self-contained and does not need a physics CDN.
type Node = { pos: THREE.Vector3; prev: THREE.Vector3; radius: number };
type Link = { a: number; b: number; length: number; mesh: THREE.Mesh };

const UP = new THREE.Vector3(0, 1, 0);
const limbGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
const headGeometry = new THREE.SphereGeometry(0.44, 10, 8);

export class Ragdoll {
  readonly group = new THREE.Group();
  private readonly nodes: Node[];
  private readonly links: Link[] = [];
  private readonly head: THREE.Mesh;
  private age = 0;
  readonly lifetime = 28;

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    facing: number,
    shirtColor: number,
    skinColor: number,
    pantsColor: number,
    impact: THREE.Vector3,
    speed: number,
  ) {
    const pose: [number, number, number][] = [
      [0, 1.1, 0],      // 0 pelvis
      [0, 2.1, 0],      // 1 chest
      [0, 2.65, 0],     // 2 neck
      [0, 3.18, 0],     // 3 head
      [-0.60, 2.36, 0], // 4 left shoulder
      [0.60, 2.36, 0],  // 5 right shoulder
      [-1.05, 1.85, 0], // 6 left elbow
      [1.05, 1.85, 0],  // 7 right elbow
      [-1.32, 1.35, 0], // 8 left hand
      [1.32, 1.35, 0],  // 9 right hand
      [-0.32, 1.08, 0], // 10 left hip
      [0.32, 1.08, 0],  // 11 right hip
      [-0.38, 0.58, 0], // 12 left knee
      [0.38, 0.58, 0],  // 13 right knee
      [-0.4, 0.14, 0],  // 14 left foot
      [0.4, 0.14, 0],   // 15 right foot
    ];
    const rotation = new THREE.Quaternion().setFromAxisAngle(UP, facing);
    const velocity = impact.clone().setY(0).normalize().multiplyScalar(Math.min(speed * 0.32, 14));
    const burst = Math.random() * 2 - 1;
    this.nodes = pose.map(([x, y, z], i) => {
      const pos = new THREE.Vector3(x, y, z).applyQuaternion(rotation).add(position);
      const impulse = velocity.clone().add(new THREE.Vector3(
        (i % 3 - 1) * 1.7 + burst,
        i < 4 ? 2.7 : 1.2,
        ((i * 7) % 5 - 2) * 0.9,
      ));
      return {
        pos,
        prev: pos.clone().addScaledVector(impulse, -1 / 60),
        radius: i === 3 ? 0.4 : 0.12,
      };
    });

    const fabric = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85 });
    const link = (a: number, b: number, width: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(limbGeometry, material);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.links.push({ a, b, length: pose[a] && pose[b] ? new THREE.Vector3(...pose[a]).distanceTo(new THREE.Vector3(...pose[b])) : 1, mesh });
      mesh.userData.thickness = width;
    };
    link(0, 1, 0.43, fabric); // trunk
    link(1, 2, 0.25, fabric);
    link(1, 4, 0.3, fabric);
    link(1, 5, 0.3, fabric);
    link(4, 6, 0.21, fabric);
    link(5, 7, 0.21, fabric);
    link(6, 8, 0.15, skin);
    link(7, 9, 0.15, skin);
    link(0, 10, 0.33, pants);
    link(0, 11, 0.33, pants);
    link(10, 12, 0.28, pants);
    link(11, 13, 0.28, pants);
    link(12, 14, 0.22, pants);
    link(13, 15, 0.22, pants);
    this.head = new THREE.Mesh(headGeometry, skin);
    this.head.castShadow = true;
    this.group.add(this.head);
    scene.add(this.group);
    this.syncMeshes();
  }

  update(dt: number): boolean {
    this.age += dt;
    if (this.age > this.lifetime) return false;
    // Two substeps and iterative joint constraints keep limbs connected.
    for (let substep = 0; substep < 2; substep++) {
      const h = Math.min(dt / 2, 1 / 45);
      for (const p of this.nodes) {
        const delta = p.pos.clone().sub(p.prev).multiplyScalar(0.987);
        p.prev.copy(p.pos);
        p.pos.add(delta);
        p.pos.y -= 31 * h * h;
      }
      for (let iteration = 0; iteration < 7; iteration++) {
        for (const l of this.links) {
          const a = this.nodes[l.a], b = this.nodes[l.b];
          const axis = b.pos.clone().sub(a.pos);
          const length = axis.length();
          if (length < 0.0001) continue;
          axis.multiplyScalar((length - l.length) / (2 * length));
          a.pos.add(axis);
          b.pos.sub(axis);
        }
        // Invisible stabilizing links maintain shoulder/hip spacing and neck.
        for (const [aId, bId, d] of [[4, 5, 1.2], [10, 11, .64], [2, 3, .53], [4, 10, 1.48], [5, 11, 1.48]]) {
          const a = this.nodes[aId], b = this.nodes[bId];
          const v = b.pos.clone().sub(a.pos), length = v.length();
          if (length < 0.0001) continue;
          v.multiplyScalar((length - d) / (length * 2));
          a.pos.add(v); b.pos.sub(v);
        }
        for (const p of this.nodes) {
          if (p.pos.y < p.radius) {
            p.pos.y = p.radius;
            // Ground friction dampens horizontal motion after contact.
            p.prev.x += (p.pos.x - p.prev.x) * 0.45;
            p.prev.z += (p.pos.z - p.prev.z) * 0.45;
          }
          p.pos.x = THREE.MathUtils.clamp(p.pos.x, -248, 248);
          p.pos.z = THREE.MathUtils.clamp(p.pos.z, -248, 248);
        }
      }
    }
    this.syncMeshes();
    return true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    const materials = new Set<THREE.Material>();
    for (const mesh of [...this.links.map(l => l.mesh), this.head]) materials.add(mesh.material as THREE.Material);
    materials.forEach(m => m.dispose());
  }

  private syncMeshes() {
    for (const l of this.links) {
      const a = this.nodes[l.a].pos, b = this.nodes[l.b].pos;
      const delta = b.clone().sub(a);
      const length = Math.max(delta.length(), 0.001);
      l.mesh.position.copy(a).add(b).multiplyScalar(0.5);
      l.mesh.quaternion.setFromUnitVectors(UP, delta.divideScalar(length));
      l.mesh.scale.set(l.mesh.userData.thickness, length, l.mesh.userData.thickness);
    }
    this.head.position.copy(this.nodes[3].pos);
  }
}

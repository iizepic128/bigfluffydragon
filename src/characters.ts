import * as THREE from 'three';

/** Original stylized humans, with articulated walk cycles and simple facial details. */
const sharedBox = new THREE.BoxGeometry(1, 1, 1);
const sharedSphere = new THREE.SphereGeometry(1, 12, 10);
const sharedCylinder = new THREE.CylinderGeometry(1, 1, 1, 9);
const material = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88 });
export const SKIN_TONES = [0xf0bd95, 0xc98f6a, 0x9f6245, 0x704632, 0xe0a77f];
export const SHIRT_COLORS = [0xf77db5, 0x8ea4ff, 0xe2b75d, 0x88dc99, 0x5ed7e3, 0xcf9dff, 0xf67b71];
const HAIR_COLORS = [0x1d1720, 0x39221d, 0x6d3c23, 0x9b7449, 0x352b4d];

function piece(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const mesh = new THREE.Mesh(geo, material(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export type Human = THREE.Group & { userData: {
  radius: number; shirtColor: number; skinColor: number; pantsColor: number;
  leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group;
  walkPhase: number; knockedOut?: boolean;
} };

export function createHuman(shirtColor: number, variant = 0): Human {
  const root = new THREE.Group() as Human;
  const skin = SKIN_TONES[((variant % SKIN_TONES.length) + SKIN_TONES.length) % SKIN_TONES.length];
  const hair = HAIR_COLORS[variant % HAIR_COLORS.length];
  const pants = [0x333b53, 0x292f3c, 0x51434a, 0x41545c][variant % 4];
  // Torso: shoulder-to-waist silhouette, neck, hands, shoes, face and hair.
  piece(root, sharedBox, shirtColor, 0, 2.05, 0, 1.08, 1.12, 0.54);
  piece(root, sharedBox, pants, 0, 1.40, 0, .84, .28, .53);
  piece(root, sharedCylinder, skin, 0, 2.70, 0, .18, .22, .18);
  piece(root, sharedSphere, skin, 0, 3.03, 0, .38, .46, .35);
  piece(root, sharedSphere, hair, 0, 3.38, -.03, .39, .16, .37);
  // Eyes look toward +Z, the character's forward facing direction.
  for (const x of [-.15, .15]) {
    piece(root, sharedSphere, 0xffffff, x, 3.07, .322, .08, .055, .035);
    piece(root, sharedSphere, 0x242635, x, 3.07, .351, .039, .045, .023);
    piece(root, sharedBox, hair, x, 3.17, .315, .14, .038, .04);
  }
  piece(root, sharedBox, skin, 0, 2.96, .365, .095, .14, .11);
  piece(root, sharedBox, 0x8e5a53, 0, 2.79, .319, .17, .03, .035);
  const arm = (left: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(left ? -.65 : .65, 2.5, 0);
    root.add(pivot);
    piece(pivot, sharedCylinder, shirtColor, 0, -.36, 0, .24, .65, .24);
    piece(pivot, sharedCylinder, skin, 0, -.85, 0, .16, .41, .16);
    piece(pivot, sharedSphere, skin, 0, -1.12, 0, .15, .17, .15);
    return pivot;
  };
  const leg = (left: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(left ? -.25 : .25, 1.30, 0);
    root.add(pivot);
    piece(pivot, sharedCylinder, pants, 0, -.52, 0, .245, 1.05, .245);
    piece(pivot, sharedBox, 0x1b1c27, 0, -1.07, .13, .31, .22, .48);
    return pivot;
  };
  root.userData.radius = .78;
  root.userData.shirtColor = shirtColor;
  root.userData.skinColor = skin;
  root.userData.pantsColor = pants;
  root.userData.leftArm = arm(true);
  root.userData.rightArm = arm(false);
  root.userData.leftLeg = leg(true);
  root.userData.rightLeg = leg(false);
  root.userData.walkPhase = 0;
  return root;
}

export function animateHuman(human: Human, dt: number, motion: number) {
  const speed = Math.min(Math.abs(motion), 1);
  human.userData.walkPhase += dt * (3 + speed * 7);
  const sway = Math.sin(human.userData.walkPhase) * .6 * speed;
  human.userData.leftLeg.rotation.x = sway;
  human.userData.rightLeg.rotation.x = -sway;
  human.userData.leftArm.rotation.x = -sway * .8;
  human.userData.rightArm.rotation.x = sway * .8;
}

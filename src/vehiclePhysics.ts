/** Lightweight ground-plane rigid bodies. All cars share one velocity/contact solver. */
export type VehicleBody = { position: { x: number; z: number }; rotation: { y: number } };
export type VehicleMotion = {
  vx: number; vz: number; spin: number;
  mass: number; inverseMass: number; inverseInertia: number;
  steer: number; braking: boolean; driven: boolean;
  acceleration: number; lateralAcceleration: number;
  hitWall: boolean; hitVehicle: boolean;
};
export type WorldBlocked = (x: number, z: number, radius: number) => boolean;
export type VehicleImpact<T extends VehicleBody> = {
  a: T; b: T | null; x: number; z: number; nx: number; nz: number; speed: number;
};
// A capsule covers the long body and bumpers without an oversized width on bridges.
export const VEHICLE_RADIUS = 1.98;
export const VEHICLE_HALF_SEGMENT = 1.5;
const EXTENT = VEHICLE_RADIUS + VEHICLE_HALF_SEGMENT;
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const approach = (x: number, target: number, amount: number) => x < target ? Math.min(target, x + amount) : Math.max(target, x - amount);

export function createVehicleMotion(police = false): VehicleMotion {
  const mass = police ? 1650 : 1200;
  return {
    vx: 0, vz: 0, spin: 0, mass, inverseMass: 1 / mass,
    inverseInertia: 12 / (mass * ((EXTENT * 2) ** 2 + (VEHICLE_RADIUS * 2) ** 2)),
    steer: 0, braking: false, driven: false, acceleration: 0, lateralAcceleration: 0,
    hitWall: false, hitVehicle: false,
  };
}
export function resetMotion(motion: VehicleMotion) {
  motion.vx = motion.vz = motion.spin = motion.steer = motion.acceleration = motion.lateralAcceleration = 0;
  motion.braking = motion.driven = motion.hitWall = motion.hitVehicle = false;
}
export function forwardSpeed(body: VehicleBody, motion: VehicleMotion) {
  return motion.vx * Math.sin(body.rotation.y) + motion.vz * Math.cos(body.rotation.y);
}
export function vehicleSpeed(motion: VehicleMotion) { return Math.hypot(motion.vx, motion.vz); }

export function vehicleOverlapsCircle(body: VehicleBody, x: number, z: number, radius: number) {
  const sx = Math.sin(body.rotation.y), sz = Math.cos(body.rotation.y);
  const along = clamp((x - body.position.x) * sx + (z - body.position.z) * sz, -VEHICLE_HALF_SEGMENT, VEHICLE_HALF_SEGMENT);
  const dx = x - body.position.x - sx * along, dz = z - body.position.z - sz * along;
  return dx * dx + dz * dz < (VEHICLE_RADIUS + radius) ** 2;
}
export function vehiclesOverlap(a: VehicleBody, b: VehicleBody) { return contact(a, b) !== null; }
export function vehicleWorldBlocked(body: VehicleBody, x: number, z: number, heading: number, blocked: WorldBlocked) {
  const sx = Math.sin(heading), sz = Math.cos(heading);
  // Overlapping samples are conservative at canal edges and building corners.
  for (let i = -2; i <= 2; i++) {
    const offset = i * VEHICLE_HALF_SEGMENT / 2;
    if (blocked(x + sx * offset, z + sz * offset, VEHICLE_RADIUS)) return true;
  }
  return false;
}

export function updateDrivenVehicle(body: VehicleBody, motion: VehicleMotion, dt: number, throttle: number, steer: number, braking: boolean, damage = 0, upgrades = 0) {
  if (dt <= 0) return;
  const sx = Math.sin(body.rotation.y), sz = Math.cos(body.rotation.y);
  let longitudinal = forwardSpeed(body, motion);
  const previous = longitudinal;
  let lateral = motion.vx * sz - motion.vz * sx;
  const massScale = 1200 / motion.mass;
  const power = Math.max(.58, 1 - damage * .004);
  // Progression is unlimited; handling benefits level off to keep the simulation bounded.
  const tuning = clamp(upgrades, 0, 10);
  const maxSpeed = Math.max(19, 35 + tuning * 2 - damage * .16);
  const opposing = throttle !== 0 && longitudinal * throttle < -1;
  if (braking || opposing) {
    longitudinal = approach(longitudinal, 0, dt * (braking ? 34 : 25) * massScale);
  } else if (throttle) {
    longitudinal += throttle * dt * (21 + tuning * .8) * power * massScale;
  }
  const rolling = .45 + Math.abs(longitudinal) * .18 + longitudinal * longitudinal * .006;
  longitudinal = approach(longitudinal, 0, rolling * dt);
  // Limit engine speed, while still letting collisions impart independent momentum.
  if (throttle > 0 && previous <= maxSpeed) longitudinal = Math.min(maxSpeed, longitudinal);
  if (throttle < 0 && previous >= -13) longitudinal = Math.max(-13, longitudinal);
  const grip = Math.max(.55, 1 - damage * .004);
  const lateralCorrection = Math.min(Math.abs(lateral) * (1 - Math.exp(-(braking ? 5 : 8) * grip * dt)), 26 * grip * dt);
  lateral = approach(lateral, 0, lateralCorrection);
  motion.vx = sx * longitudinal + sz * lateral;
  motion.vz = sz * longitudinal - sx * lateral;
  motion.steer += (steer - motion.steer) * (1 - Math.exp(-7 * dt));
  const angle = motion.steer * .48 / (1 + Math.abs(longitudinal) * .035);
  const yawRate = longitudinal * Math.tan(angle) * grip / 4.7;
  motion.spin += (yawRate - motion.spin) * (1 - Math.exp(-5 * dt));
  motion.acceleration = (longitudinal - previous) / dt;
  motion.lateralAcceleration = motion.spin * longitudinal;
  motion.braking = braking || opposing;
  motion.driven = true;
}

/** Pursuit commands accelerate the same body used by player cars and impacts. */
export function driveToward(body: VehicleBody, motion: VehicleMotion, dx: number, dz: number, speed: number, dt: number) {
  const length = Math.hypot(dx, dz);
  motion.driven = true;
  if (length < .001 || speed <= 0) {
    const drag = Math.exp(-4 * dt);
    motion.vx *= drag; motion.vz *= drag;
    motion.braking = true;
    return;
  }
  const targetYaw = Math.atan2(dx, dz);
  const difference = Math.atan2(Math.sin(targetYaw - body.rotation.y), Math.cos(targetYaw - body.rotation.y));
  motion.spin += (clamp(difference * 3, -1.6, 1.6) - motion.spin) * (1 - Math.exp(-4 * dt));
  const oldSpeed = forwardSpeed(body, motion);
  const factor = 1 - Math.exp(-2.5 * dt);
  const limit = dt * 14 * 1200 / motion.mass;
  const alignedSpeed = speed * Math.max(.15, Math.cos(difference));
  // Accelerate along the car's current heading while steering toward the goal.
  // World-direction commands must not make a sideways-facing patrol crab to its target.
  motion.vx += clamp((Math.sin(body.rotation.y) * alignedSpeed - motion.vx) * factor, -limit, limit);
  motion.vz += clamp((Math.cos(body.rotation.y) * alignedSpeed - motion.vz) * factor, -limit, limit);
  motion.acceleration = (forwardSpeed(body, motion) - oldSpeed) / Math.max(dt, .001);
  motion.lateralAcceleration = motion.spin * forwardSpeed(body, motion);
  motion.steer = clamp(difference, -1, 1);
  motion.braking = false;
}

// Closest points of two capsule spines, including parallel and crossing segments.
function contact(a: VehicleBody, b: VehicleBody) {
  const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
  if (dx * dx + dz * dz > (EXTENT * 2) ** 2) return null;
  const ax = Math.sin(a.rotation.y) * VEHICLE_HALF_SEGMENT, az = Math.cos(a.rotation.y) * VEHICLE_HALF_SEGMENT;
  const bx = Math.sin(b.rotation.y) * VEHICLE_HALF_SEGMENT, bz = Math.cos(b.rotation.y) * VEHICLE_HALF_SEGMENT;
  const pX = a.position.x - ax, pZ = a.position.z - az, qX = b.position.x - bx, qZ = b.position.z - bz;
  const uX = 2 * ax, uZ = 2 * az, vX = 2 * bx, vZ = 2 * bz, wX = pX - qX, wZ = pZ - qZ;
  const aa = uX * uX + uZ * uZ, bb = uX * vX + uZ * vZ, cc = vX * vX + vZ * vZ;
  const dd = uX * wX + uZ * wZ, ee = vX * wX + vZ * wZ, denominator = aa * cc - bb * bb;
  let s = denominator > 1e-8 ? clamp((bb * ee - cc * dd) / denominator, 0, 1) : 0;
  let t = (bb * s + ee) / cc;
  if (t < 0) { t = 0; s = clamp(-dd / aa, 0, 1); }
  else if (t > 1) { t = 1; s = clamp((bb - dd) / aa, 0, 1); }
  const caX = pX + uX * s, caZ = pZ + uZ * s, cbX = qX + vX * t, cbZ = qZ + vZ * t;
  let nx = cbX - caX, nz = cbZ - caZ, distance = Math.hypot(nx, nz);
  if (distance >= VEHICLE_RADIUS * 2) return null;
  if (distance > .00001) { nx /= distance; nz /= distance; }
  else {
    const centers = Math.hypot(dx, dz);
    nx = centers > .00001 ? dx / centers : 1; nz = centers > .00001 ? dz / centers : 0;
    distance = 0;
  }
  return { nx, nz, distance, x: (caX + cbX) / 2, z: (caZ + cbZ) / 2 };
}

function applyImpulse(a: VehicleBody, am: VehicleMotion, b: VehicleBody, bm: VehicleMotion, x: number, z: number, nx: number, nz: number, impulse: number) {
  const arX = x - a.position.x, arZ = z - a.position.z, brX = x - b.position.x, brZ = z - b.position.z;
  am.vx -= nx * impulse * am.inverseMass; am.vz -= nz * impulse * am.inverseMass;
  bm.vx += nx * impulse * bm.inverseMass; bm.vz += nz * impulse * bm.inverseMass;
  am.spin -= (arZ * nx - arX * nz) * impulse * am.inverseInertia;
  bm.spin += (brZ * nx - brX * nz) * impulse * bm.inverseInertia;
}

export function stepVehiclePhysics<T extends VehicleBody>(bodies: readonly T[], motion: ReadonlyMap<T, VehicleMotion>, dt: number, blocked: WorldBlocked, onImpact?: (impact: VehicleImpact<T>) => void) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const previousForward = bodies.map(body => forwardSpeed(body, motion.get(body)!));
  let maxTravel = 0;
  for (const body of bodies) {
    const m = motion.get(body)!;
    maxTravel = Math.max(maxTravel, (vehicleSpeed(m) + Math.abs(m.spin) * EXTENT) * dt);
    m.hitWall = m.hitVehicle = false;
  }
  const steps = Math.max(1, Math.ceil(maxTravel / .25));
  const h = dt / steps;
  for (let substep = 0; substep < steps; substep++) {
    for (const body of bodies) {
      const m = motion.get(body)!;
      // Recompute from the latest velocity after every contact/substep.
      const yaw = body.rotation.y + m.spin * h;
      if (!vehicleWorldBlocked(body, body.position.x, body.position.z, yaw, blocked)) body.rotation.y = yaw;
      else m.spin *= .4;
      for (const axis of ['x', 'z'] as const) {
        const speed = axis === 'x' ? m.vx : m.vz;
        if (Math.abs(speed) < .00001) continue;
        const next = body.position[axis] + speed * h;
        const x = axis === 'x' ? next : body.position.x, z = axis === 'z' ? next : body.position.z;
        if (!vehicleWorldBlocked(body, x, z, body.rotation.y, blocked)) body.position[axis] = next;
        else {
          m.hitWall = true;
          // Only an incoming component receives a rebound; subsequent steps use it.
          if (axis === 'x') m.vx = -speed * .12; else m.vz = -speed * .12;
          if (Math.abs(speed) > 3) {
            const nx = axis === 'x' ? Math.sign(speed) : 0, nz = axis === 'z' ? Math.sign(speed) : 0;
            onImpact?.({ a: body, b: null, x: body.position.x + nx * VEHICLE_RADIUS, z: body.position.z + nz * VEHICLE_RADIUS, nx, nz, speed: Math.abs(speed) });
          }
        }
      }
    }
    for (let iteration = 0; iteration < 4; iteration++) {
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j], c = contact(a, b);
        if (!c) continue;
        const am = motion.get(a)!, bm = motion.get(b)!;
        const arX = c.x - a.position.x, arZ = c.z - a.position.z, brX = c.x - b.position.x, brZ = c.z - b.position.z;
        const relativeX = am.vx + am.spin * arZ - bm.vx - bm.spin * brZ;
        const relativeZ = am.vz - am.spin * arX - bm.vz + bm.spin * brX;
        const closing = relativeX * c.nx + relativeZ * c.nz;
        const aLever = arZ * c.nx - arX * c.nz, bLever = brZ * c.nx - brX * c.nz;
        const effectiveMass = am.inverseMass + bm.inverseMass + aLever * aLever * am.inverseInertia + bLever * bLever * bm.inverseInertia;
        if (closing > .001) {
          const impulse = (1 + .16) * closing / effectiveMass;
          applyImpulse(a, am, b, bm, c.x, c.z, c.nx, c.nz, impulse);
          const tx = c.nz, tz = -c.nx;
          const aTangent = arZ * tx - arX * tz, bTangent = brZ * tx - brX * tz;
          const tangentMass = am.inverseMass + bm.inverseMass + aTangent * aTangent * am.inverseInertia + bTangent * bTangent * bm.inverseInertia;
          const tangentX = am.vx + am.spin * arZ - bm.vx - bm.spin * brZ;
          const tangentZ = am.vz - am.spin * arX - bm.vz + bm.spin * brX;
          const tangentImpulse = clamp((tangentX * tx + tangentZ * tz) / tangentMass, -impulse * .3, impulse * .3);
          applyImpulse(a, am, b, bm, c.x, c.z, tx, tz, tangentImpulse);
          am.hitVehicle = bm.hitVehicle = true;
          if (closing > 3) onImpact?.({ a, b, x: c.x, z: c.z, nx: c.nx, nz: c.nz, speed: closing });
        }
        const correction = Math.min(.8, Math.max(0, VEHICLE_RADIUS * 2 - c.distance - .003) * .85);
        const sum = am.inverseMass + bm.inverseMass;
        let aMove = correction * am.inverseMass / sum, bMove = correction * bm.inverseMass / sum;
        const aFree = !vehicleWorldBlocked(a, a.position.x - c.nx * aMove, a.position.z - c.nz * aMove, a.rotation.y, blocked);
        const bFree = !vehicleWorldBlocked(b, b.position.x + c.nx * bMove, b.position.z + c.nz * bMove, b.rotation.y, blocked);
        if (!aFree) aMove = 0;
        if (!bFree) bMove = 0;
        if (!aFree && bFree && !vehicleWorldBlocked(b, b.position.x + c.nx * correction, b.position.z + c.nz * correction, b.rotation.y, blocked)) bMove = correction;
        if (!bFree && aFree && !vehicleWorldBlocked(a, a.position.x - c.nx * correction, a.position.z - c.nz * correction, a.rotation.y, blocked)) aMove = correction;
        a.position.x -= c.nx * aMove; a.position.z -= c.nz * aMove;
        b.position.x += c.nx * bMove; b.position.z += c.nz * bMove;
      }
    }
  }
  for (const [index, body] of bodies.entries()) {
    const m = motion.get(body)!;
    if (!m.driven) {
      const drag = Math.exp(-.8 * dt);
      m.vx *= drag; m.vz *= drag; m.spin *= Math.exp(-2 * dt);
      if (vehicleSpeed(m) < .035) m.vx = m.vz = 0;
    }
    const acceleration = (forwardSpeed(body, m) - previousForward[index]) / dt;
    m.acceleration = m.driven ? m.acceleration + acceleration : acceleration;
    m.lateralAcceleration = m.spin * forwardSpeed(body, m);
    if (!m.driven) m.braking = false;
  }
}

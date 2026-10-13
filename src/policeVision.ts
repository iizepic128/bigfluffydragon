/** Ground police sight uses +Z as forward, matching the game's actor headings. */
export const POLICE_CAR_VISION_RANGE = 47;
export const POLICE_OFFICER_VISION_RANGE = 34;
export const POLICE_VISION_FOV = Math.PI * 2 / 3;
export const POLICE_AWARENESS_RADIUS = 2.4;

type Coord = {x:number;z:number};
type Observer = Coord & {heading:number};
export type PoliceSightBlocker = Coord & {halfX:number;halfZ:number};

/** Direction/range check only: callers must also check the real world's line of sight. */
export function inPoliceVisionCone(observer:Observer,target:Coord,range:number):boolean {
  const dx = target.x - observer.x, dz = target.z - observer.z;
  const distanceSquared = dx * dx + dz * dz;
  if(range < 0 || distanceSquared > range * range) return false;
  // An officer can notice somebody right beside them, even outside the forward cone.
  if(distanceSquared <= POLICE_AWARENESS_RADIUS * POLICE_AWARENESS_RADIUS) return true;
  const forwardDot = dx * Math.sin(observer.heading) + dz * Math.cos(observer.heading);
  return forwardDot >= Math.sqrt(distanceSquared) * Math.cos(POLICE_VISION_FOV / 2) - 1e-10;
}

/** Clip a map ray to the nearest building footprint using a two-axis slab intersection. */
export function policeVisionRayDistance(origin:Coord,heading:number,range:number,blockers:readonly PoliceSightBlocker[]):number {
  const dx = Math.sin(heading), dz = Math.cos(heading);
  let nearest = range;
  for(const blocker of blockers) {
    let entry = 0, exit = nearest;
    if(Math.abs(dx) < 1e-10) {
      if(origin.x < blocker.x - blocker.halfX || origin.x > blocker.x + blocker.halfX) continue;
    } else {
      const a = (blocker.x - blocker.halfX - origin.x) / dx;
      const b = (blocker.x + blocker.halfX - origin.x) / dx;
      entry = Math.max(entry, Math.min(a,b));
      exit = Math.min(exit, Math.max(a,b));
      if(exit < entry) continue;
    }
    if(Math.abs(dz) < 1e-10) {
      if(origin.z < blocker.z - blocker.halfZ || origin.z > blocker.z + blocker.halfZ) continue;
    } else {
      const a = (blocker.z - blocker.halfZ - origin.z) / dz;
      const b = (blocker.z + blocker.halfZ - origin.z) / dz;
      entry = Math.max(entry, Math.min(a,b));
      exit = Math.min(exit, Math.max(a,b));
      if(exit < entry) continue;
    }
    nearest = Math.min(nearest, entry);
  }
  return nearest;
}

/** Low-cost ground sight footprint for the map. Elevated cover remains a 3D sight check. */
export function policeVisionOutline(observer:Observer,range:number,fov:number,blockers:readonly PoliceSightBlocker[]):Coord[] {
  const halfFov = fov / 2;
  const nearby = blockers.filter(blocker => {
    const dx = Math.max(0,Math.abs(blocker.x-observer.x)-blocker.halfX);
    const dz = Math.max(0,Math.abs(blocker.z-observer.z)-blocker.halfZ);
    return dx*dx+dz*dz <= range*range;
  });
  const angles:number[]=[];
  for(let i=0;i<=16;i++) angles.push(-halfFov+fov*i/16);
  // Rays just beside footprint corners preserve sharp building shadows between fan rays.
  for(const blocker of nearby) for(const x of [blocker.x-blocker.halfX,blocker.x+blocker.halfX]) {
    for(const z of [blocker.z-blocker.halfZ,blocker.z+blocker.halfZ]) {
      const heading = Math.atan2(x-observer.x,z-observer.z)-observer.heading;
      const angle = Math.atan2(Math.sin(heading),Math.cos(heading));
      if(Math.abs(angle)>halfFov) continue;
      angles.push(Math.max(-halfFov,angle-1e-5),angle,Math.min(halfFov,angle+1e-5));
    }
  }
  angles.sort((a,b)=>a-b);
  return angles.map(angle => {
    const heading=observer.heading+angle;
    const length=policeVisionRayDistance(observer,heading,range,nearby);
    return {x:observer.x+Math.sin(heading)*length,z:observer.z+Math.cos(heading)*length};
  });
}

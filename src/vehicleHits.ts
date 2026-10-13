/** Actual integrated vehicle poses; headings face +Z. No render or physics dependency. */
export type VehicleHitPose = {x:number;z:number;heading:number};
type Coord = {x:number;z:number};

const MAX_YAW_STEP = Math.PI / 16;
const EPSILON = 1e-10;
const cross = (a:Coord,b:Coord) => a.x*b.z-a.z*b.x;

function finiteCoord(coord:Coord):boolean {
  return Number.isFinite(coord.x) && Number.isFinite(coord.z);
}

/** Squared distance from the origin to a segment in coordinates relative to the target. */
function segmentDistanceSquared(a:Coord,b:Coord):number {
  const dx = b.x-a.x, dz = b.z-a.z;
  const lengthSquared = dx*dx+dz*dz;
  if(lengthSquared <= 1e-12) return a.x*a.x+a.z*a.z;
  const progress = Math.max(0,Math.min(1,-(a.x*dx+a.z*dz)/lengthSquared));
  const x = a.x+dx*progress, z = a.z+dz*progress;
  return x*x+z*z;
}

function originInTriangle(a:Coord,b:Coord,c:Coord):boolean {
  const ab = cross(a,b), bc = cross(b,c), ca = cross(c,a);
  if(Math.abs(ab+bc+ca) <= EPSILON) return false;
  return (ab >= -EPSILON && bc >= -EPSILON && ca >= -EPSILON)
    || (ab <= EPSILON && bc <= EPSILON && ca <= EPSILON);
}

/** Distance to the convex hull of four spine endpoints, including degenerate straight sweeps. */
function sweptSpineHits(points:readonly Coord[],radiusSquared:number):boolean {
  for(let i=0;i<points.length-2;i++) for(let j=i+1;j<points.length-1;j++) {
    for(let k=j+1;k<points.length;k++) {
      if(originInTriangle(points[i],points[j],points[k])) return true;
    }
  }
  for(let i=0;i<points.length-1;i++) for(let j=i+1;j<points.length;j++) {
    if(segmentDistanceSquared(points[i],points[j]) <= radiusSquared) return true;
  }
  return false;
}

/**
 * Sweep the car's capsule footprint against an officer's ground circle.
 * Supply the actual wall-clipped end pose, never an intended destination.
 * Translation is swept analytically; at most 16 yaw intervals cover rotation.
 */
export function sweptVehicleHit(
  from:VehicleHitPose,
  to:VehicleHitPose,
  target:Coord,
  radius:number,
  halfSegment:number,
  targetRadius:number,
):boolean {
  if(!finiteCoord(from) || !finiteCoord(to) || !finiteCoord(target)
    || !Number.isFinite(from.heading) || !Number.isFinite(to.heading)
    || !Number.isFinite(radius) || !Number.isFinite(halfSegment) || !Number.isFinite(targetRadius)
    || radius < 0 || halfSegment < 0 || targetRadius < 0) return false;
  const dx = to.x-from.x, dz = to.z-from.z;
  const distanceSquared = dx*dx+dz*dz;
  const yaw = Math.atan2(Math.sin(to.heading-from.heading),Math.cos(to.heading-from.heading));
  const contactRadius = radius+targetRadius;
  if(!Number.isFinite(distanceSquared) || !Number.isFinite(yaw) || !Number.isFinite(contactRadius)) return false;
  // An overlapping parked car must not hit an officer every frame.
  if(distanceSquared <= 1e-12 && Math.abs(yaw) <= EPSILON) return false;
  const start = {x:from.x-target.x,z:from.z-target.z};
  const end = {x:to.x-target.x,z:to.z-target.z};
  const broadRadius = halfSegment+contactRadius;
  if(segmentDistanceSquared(start,end) > broadRadius*broadRadius) return false;

  const steps = Math.max(1,Math.ceil(Math.abs(yaw)/MAX_YAW_STEP));
  // Between sampled angles the rotating spine follows an arc outside its chord.
  const curvaturePadding = halfSegment*(1-Math.cos(Math.abs(yaw)/(steps*2)));
  const paddedRadiusSquared = (contactRadius+curvaturePadding)**2;
  const heading = Math.atan2(Math.sin(from.heading),Math.cos(from.heading));
  let previousFront = {
    x:start.x+Math.sin(heading)*halfSegment,
    z:start.z+Math.cos(heading)*halfSegment,
  };
  let previousRear = {
    x:start.x-Math.sin(heading)*halfSegment,
    z:start.z-Math.cos(heading)*halfSegment,
  };
  for(let step=1;step<=steps;step++) {
    const progress = step/steps, angle = heading+yaw*progress;
    const x = start.x+dx*progress, z = start.z+dz*progress;
    const offsetX = Math.sin(angle)*halfSegment, offsetZ = Math.cos(angle)*halfSegment;
    const front = {x:x+offsetX,z:z+offsetZ};
    const rear = {x:x-offsetX,z:z-offsetZ};
    if(sweptSpineHits([previousFront,previousRear,front,rear],paddedRadiusSquared)) return true;
    previousFront = front;
    previousRear = rear;
  }
  return false;
}

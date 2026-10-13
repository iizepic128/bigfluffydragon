/** North-up map heading: +Z is north, +X is east, and the arrow starts facing up. */
export function vehicleMapHeading(facing: number, vx: number, vz: number): number {
  // At rest, keep the vehicle's facing instead of amplifying tiny settling velocities.
  const fallback = Number.isFinite(facing) ? facing : 0;
  if (!Number.isFinite(vx) || !Number.isFinite(vz) || Math.hypot(vx, vz) <= .5) return fallback;
  // A reversing or skidding car can travel in a different direction from its body.
  return Math.atan2(vx, vz);
}

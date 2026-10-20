import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, completion, freshState, nextScheduledDate, progressFor, releaseFor, statusFor, syncSchedules, updateProgress, validateImport, validDate } from './model.ts';

test('starting catalog uses the supplied SBR 6 / JOJOLands 41 baseline', () => {
  const s = freshState();
  assert.equal(releaseFor(s, PARTS[6]).episodes, 6);
  assert.equal(releaseFor(s, PARTS[8]).chapters, 41);
  assert.equal(PARTS.reduce((n, p) => n + releaseFor(s, p).episodes, 0), 196);
  assert.equal(PARTS.reduce((n, p) => n + releaseFor(s, p).chapters, 0), 998);
});
test('progress stays within totals and does not cross formats', () => {
  let s = updateProgress(freshState(), PARTS[0], 'anime', 50);
  assert.equal(progressFor(s, 1).anime, 9);
  assert.equal(progressFor(s, 1).manga, 0);
  assert.equal(completion(s, PARTS[0], 'both'), 50);
  assert.equal(statusFor(s, PARTS[0], 'anime'), 'complete');
  assert.equal(statusFor(s, PARTS[0]), 'active');
  s = updateProgress(s, PARTS[0], 'manga', 44);
  assert.equal(statusFor(s, PARTS[0]), 'complete');
  s = updateProgress(s, PARTS[0], 'anime', -2);
  assert.equal(progressFor(s, 1).anime, 0);
});
test('unknown anime totals are excluded from format completion', () => {
  const s = updateProgress(freshState(), PARTS[7], 'manga', 110);
  assert.equal(statusFor(s, PARTS[7], 'anime'), 'uncataloged');
  assert.equal(statusFor(s, PARTS[7]), 'complete');
});
test('Friday release catches up exactly once and preserves watched progress', () => {
  const s = updateProgress(freshState(), PARTS[6], 'anime', 6);
  assert.equal(syncSchedules(s, '2026-10-22').state, s);
  const result = syncSchedules(s, '2026-10-23');
  assert.equal(result.added, 1);
  assert.equal(releaseFor(result.state, PARTS[6]).episodes, 7);
  assert.equal(progressFor(result.state, 7).anime, 6);
  assert.equal(result.state.schedules.sbr.nextRelease, '2026-10-30');
  assert.equal(syncSchedules(result.state, '2026-10-23').added, 0);
  assert.equal(syncSchedules(result.state, '2026-10-23').state, result.state);
  assert.equal(statusFor(result.state, PARTS[6], 'anime'), 'active');
});
test('missed Fridays and monthly releases catch up without changing read counts', () => {
  const s = updateProgress(freshState(), PARTS[8], 'manga', 41);
  const { state, added } = syncSchedules(s, '2026-11-20');
  assert.equal(releaseFor(state, PARTS[6]).episodes, 11);
  assert.equal(releaseFor(state, PARTS[8]).chapters, 42);
  assert.equal(progressFor(state, 9).manga, 41);
  assert.equal(state.schedules.jojolands.nextRelease, '2026-12-19');
  assert.equal(added, 6);
});
test('paused schedules do not accumulate releases', () => {
  const s = freshState();
  s.schedules.sbr.enabled = false;
  s.schedules.jojolands.enabled = false;
  const result = syncSchedules(s, '2027-07-19');
  assert.equal(result.state, s);
  assert.equal(result.added, 0);
});
test('monthly dates survive short months, leap years, and year boundaries', () => {
  assert.equal(nextScheduledDate('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(nextScheduledDate('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(nextScheduledDate('2028-01-31', 'monthly', 31), '2028-02-29');
  assert.equal(nextScheduledDate('2026-12-19', 'monthly', 19), '2027-01-19');
  assert.equal(nextScheduledDate('2026-12-25', 'weekly', 5), '2027-01-01');
  assert.equal(nextScheduledDate('2026-10-19', 'monthly', 19), '2026-11-19');
  assert.equal(validDate('2026-02-30'), false);
});
test('delayed releases respect the adjusted next date', () => {
  const s = freshState();
  s.schedules.sbr.nextRelease = '2026-11-06';
  assert.equal(syncSchedules(s, '2026-10-30').added, 0);
  const { state } = syncSchedules(s, '2026-11-06');
  assert.equal(releaseFor(state, PARTS[6]).episodes, 7);
});
test('backup roundtrip retains schedules, notes, favorites, and counts', () => {
  const s = syncSchedules(freshState(), '2026-11-20').state;
  s.progress[1] = { anime: 3, manga: 5, favorite: true, notes: '<script>just text</script>' };
  assert.deepEqual(validateImport(JSON.parse(JSON.stringify(s))), s);
});
test('malformed backups are rejected without mutating the existing state', () => {
  assert.throws(() => validateImport({}));
  const s = freshState();
  s.progress[1] = { anime: 10, manga: 0, favorite: false, notes: '' };
  assert.throws(() => validateImport(s), /exceeds/);
  assert.equal(s.progress[1].anime, 10);
  const badSchedule = freshState();
  badSchedule.schedules.sbr.nextRelease = '2026-10-22';
  assert.throws(() => validateImport(badSchedule), /Friday/);
  const badCoverage = freshState();
  badCoverage.releases[8] = { episodes: 0, chapters: 110, adapted: 3 };
  assert.throws(() => validateImport(badCoverage), /Invalid release/);
});

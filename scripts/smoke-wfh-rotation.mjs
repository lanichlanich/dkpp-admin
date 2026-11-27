import assert from 'node:assert/strict';
import { continueFridayStatuses as next } from '../src/lib/wfh-schedule-pattern.ts';
const H = 'WFH', O = 'WFO';
assert.deepEqual(next([O,H,H,O], 4), [H,H,O,O]);
assert.deepEqual(next([H,O,O,H], 4), [O,O,H,H]);
assert.deepEqual(next([O,O,O,O,O], 4), [O,O,O,O]);
assert.deepEqual(next([H,H,H,H], 5), [H,H,H,H,H]);
assert.deepEqual(next([], 5), []);
for (const from of [4,5]) for (const to of [4,5]) {
  for (let bits=1; bits < (1 << from)-1; bits++) {
    const previous = Array.from({ length: from }, (_, i) => bits & (1<<i) ? H : O);
    const result = next(previous, to);
    assert.equal(result.length, to);
    assert.notEqual(result[0], previous.at(-1));
    assert.equal(new Set(result).size, 2, 'A mixed roster must not turn into an all-WFO/WFH roster.');
    if (from === to) assert.equal(result.filter(s=>s===H).length, previous.filter(s=>s===H).length);
  }
}
console.log('PASS Friday rotation: mixed boundary alternates; uniform schedules retained; 4/5 Friday combinations.');

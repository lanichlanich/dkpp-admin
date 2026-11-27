import assert from 'node:assert/strict';
import { sortScheduleRows } from '../src/lib/wfh-schedule-sorting.ts';
const friday = '2026-11-27';
const row = (nip, name, position, unit, status) => ({ employee: { nip, name, position, unit }, statuses: status ? { [friday]: status } : {} });
const rows = [row('300','Zaki','Analis 10','Pangan','WFH'), row('200','Budi','Analis 2','Pertanian','WFO'), row('100','Ana','Analis 1','Pangan')];
const nips = values => values.map(r => r.employee.nip);
assert.deepEqual(nips(sortScheduleRows(rows, null, {})), ['300','200','100']);
for (const key of ['name','nip','position']) {
  assert.deepEqual(nips(sortScheduleRows(rows, { key, direction:'asc' }, {})), ['100','200','300']);
  assert.deepEqual(nips(sortScheduleRows(rows, { key, direction:'desc' }, {})), ['300','200','100']);
}
assert.deepEqual(nips(sortScheduleRows(rows, { key:'unit',direction:'asc' }, {})), ['100','300','200']);
assert.deepEqual(nips(sortScheduleRows(rows, { key:friday,direction:'asc' }, {})), ['300','100','200']);
assert.deepEqual(nips(sortScheduleRows(rows, { key:friday,direction:'desc' }, { [`100:${friday}`]:'WFH' })), ['200','100','300']);
assert.deepEqual(nips(rows), ['300','200','100']);
console.log('PASS WFH/WFO sorting: identity, numeric text, daily statuses, pending overrides, ties, no mutation');

import assert from 'node:assert/strict';
import { getCompleteness, validateEntry } from '../lib/mobileAdmin';

const completeness = getCompleteness({ date: '2026-04-11', driver: 'Admin', shift: 'Day', collection: 1200 });
assert.equal(completeness.percent, 80);

const issues = validateEntry({ driver: 'Admin', payout: 200 }, []);
assert.ok(issues.some((issue) => issue.field === 'payoutDate'));

const duplicateIssues = validateEntry(
  { id: 'new', date: '2026-04-11', driver: 'Admin', collection: 9999, rent: 500, shift: 'Day' },
  [{ id: 'old', date: '2026-04-11', day: 'Friday', vehicle: 'AB12', driver: 'Admin', shift: 'Day', rent: 500, collection: 1000, fuel: 10, due: 0, payout: 0 }]
);
assert.ok(duplicateIssues.some((issue) => issue.severity === 'warning'));

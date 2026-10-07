import test from 'node:test';
import assert from 'node:assert/strict';
import { gateApplies, matchesDeny, evaluate, validatePolicy } from '../public/policy.mjs';

const act = (over = {}) => ({
  id: 'x', label: 'x', command: 'x', kind: 'fs',
  risk: 'external', blast: 5, cost: 0.10, expected: false, ...over,
});

test('gate intercepts only irreversible and external actions', () => {
  assert.equal(gateApplies(act({ risk: 'read' })), false);
  assert.equal(gateApplies(act({ risk: 'reversible' })), false);
  assert.equal(gateApplies(act({ risk: 'irreversible' })), true);
  assert.equal(gateApplies(act({ risk: 'external' })), true);
});

test('denylist matches by action id, risk tier, or kind', () => {
  const a = act({ id: 'force-push', kind: 'git' });
  assert.equal(matchesDeny(a, ['force-push']), true);
  assert.equal(matchesDeny(a, ['external']), true);
  assert.equal(matchesDeny(a, ['git']), true);
  assert.equal(matchesDeny(a, ['merge-pr']), false);
  assert.equal(matchesDeny(a, []), false);
});

test('evaluation order: deny beats cap beats gate beats allow', () => {
  const a = act();
  const policy = { name: 'p', gate: 'risky', deny: ['force-push'], maxBlast: 0 };
  // deny wins over both cap and gate
  assert.equal(evaluate(act({ id: 'force-push' }), policy, { blast: 99, cost: 0 }).verdict, 'denied-by-policy');
  // cap wins over the gate: an external action over blast cap halts, never asks
  const overCap = evaluate(a, { name: 'p', gate: 'risky', maxBlast: 3 }, { blast: 0, cost: 0 });
  assert.equal(overCap.verdict, 'blocked-blast-cap');
  assert.equal(overCap.halt, true);
  // gate fires when nothing earlier does
  assert.equal(evaluate(a, { name: 'p', gate: 'risky' }, { blast: 0, cost: 0 }).verdict, 'needs-approval');
  // safe action under yolo flows straight through
  assert.equal(evaluate(act({ risk: 'reversible' }), { name: 'p', gate: 'never' }, { blast: 0, cost: 0 }).verdict, 'auto-allowed');
  // yolo never asks
  assert.equal(evaluate(a, { name: 'p', gate: 'never' }, { blast: 0, cost: 0 }).verdict, 'auto-allowed');
});

test('validatePolicy rejects broken or unknown shapes', () => {
  assert.deepEqual(validatePolicy({ name: 'ok', gate: 'never' }), []);
  assert.ok(validatePolicy(null).length > 0);
  assert.ok(validatePolicy({ name: 'p', gate: 'sometimes' }).some(p => /gate/.test(p)));
  assert.ok(validatePolicy({ name: 'p', gate: 'never', maxBlast: -1 }).some(p => /maxBlast/.test(p)));
  assert.ok(validatePolicy({ name: 'p', gate: 'never', deny: 'x' }).some(p => /deny/.test(p)));
  // a misspelled key fails loudly instead of being silently ignored
  assert.ok(validatePolicy({ name: 'p', gate: 'never', maxblast: 5 }).some(p => /unknown key/.test(p)));
});

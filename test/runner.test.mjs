import test from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, expectedApprover, maxBlast } from '../public/runner.mjs';
import { INCIDENT_RUN, POLICIES } from '../public/scenarios.mjs';

const run = policy => runScenario(INCIDENT_RUN, policy);
const verdicts = r => r.log.map(e => e.verdict);
const byId = (r, id) => r.log.find(e => e.action.id === id);

test('gated: every risky action waits; the operator approves only the requested PR', () => {
  const r = run(POLICIES.gated);
  assert.equal(r.summary.approvals, 6);
  assert.equal(byId(r, 'pr-create').verdict, 'approved');
  for (const id of ['rm-fixtures', 'merge-pr', 'force-push', 'post-comment', 'publish']) {
    assert.equal(byId(r, id).verdict, 'denied-by-operator', id);
    assert.equal(byId(r, id).executed, false, id);
  }
  assert.equal(r.summary.executed, 6);
  assert.equal(r.summary.blast, 5);
});

test('yolo: all eleven actions execute immediately — blast radius 44', () => {
  const r = run(POLICIES.yolo);
  assert.equal(r.summary.approvals, 0);
  assert.equal(r.summary.executed, 11);
  assert.equal(r.summary.blast, 44);
  assert.ok(r.log.every(e => e.verdict === 'auto-allowed'));
  assert.equal(byId(r, 'force-push').executed, true);
  assert.equal(byId(r, 'publish').executed, true);
});

test('railed: the denylist blocks the four listed dangers but misses rm -rf fixtures', () => {
  const r = run(POLICIES.railed);
  for (const id of ['merge-pr', 'force-push', 'post-comment', 'publish']) {
    assert.equal(byId(r, id).verdict, 'denied-by-policy', id);
  }
  // the action nobody thought to list still executes — the honest limit of a denylist
  assert.equal(byId(r, 'rm-fixtures').verdict, 'auto-allowed');
  assert.equal(byId(r, 'rm-fixtures').executed, true);
  assert.equal(r.summary.executed, 7);
  assert.equal(r.summary.blast, 13);
});

test('blast-radius tripwire halts a runaway yolo run mid-stream', () => {
  const r = run({ name: 'capped', gate: 'never', maxBlast: 10 });
  assert.equal(r.summary.halted, true);
  assert.equal(byId(r, 'git-commit').verdict, 'blocked-blast-cap');
  assert.ok(r.log.slice(6).every(e => e.verdict === 'not-run'));
  assert.equal(r.summary.blast, 10);
  assert.equal(r.summary.executed, 5);
});

test('budget cap halts the run before the expensive test suite', () => {
  const r = run({ name: 'cheap', gate: 'never', maxCost: 1.0 });
  assert.equal(r.summary.halted, true);
  assert.equal(byId(r, 'run-tests').verdict, 'blocked-budget');
  assert.equal(r.summary.executed, 3);
  assert.equal(r.summary.cost, 0.70);
});

test('denying a whole risk tier works in yolo mode too', () => {
  const r = run({ name: 'no-external', gate: 'never', deny: ['external'] });
  assert.equal(r.summary.deniedByPolicy, 5);
  assert.equal(r.summary.executed, 6);
  assert.equal(byId(r, 'pr-create').verdict, 'denied-by-policy');
});

test('the runner is deterministic', () => {
  assert.deepEqual(verdicts(run(POLICIES.yolo)), verdicts(run(POLICIES.yolo)));
  assert.deepEqual(run(POLICIES.gated).summary, run(POLICIES.gated).summary);
});

test('a custom approver can approve an unrequested action', () => {
  const yesToAll = () => true;
  const r = runScenario(INCIDENT_RUN, POLICIES.gated, yesToAll);
  assert.equal(r.summary.deniedByOperator, 0);
  assert.equal(r.summary.executed, 11);
  const noToAll = () => false;
  const r2 = runScenario(INCIDENT_RUN, POLICIES.gated, noToAll);
  assert.equal(byId(r2, 'pr-create').verdict, 'denied-by-operator');
});

test('maxBlast reports the worst-case footprint of the scenario', () => {
  assert.equal(maxBlast(INCIDENT_RUN), 44);
});

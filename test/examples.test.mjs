import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { INCIDENT_RUN, POLICIES } from '../public/scenarios.mjs';
import { runScenario } from '../public/runner.mjs';
import { validatePolicy } from '../public/policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = rel => readFile(`${root}examples/${rel}`, 'utf8').then(JSON.parse);

test('embedded scenario matches the JSON on disk', async () => {
  assert.deepEqual(INCIDENT_RUN, await load('incident-run.scenario.json'));
});

test('embedded policies match the JSON on disk', async () => {
  for (const name of ['gated', 'yolo', 'railed']) {
    assert.deepEqual(POLICIES[name], await load(`${name}.policy.json`), name);
  }
});

test('every example policy validates', async () => {
  for (const name of ['gated', 'yolo', 'railed']) {
    assert.deepEqual(validatePolicy(await load(`${name}.policy.json`)), [], name);
  }
});

test('actions carry every field the runner and UI need', () => {
  for (const a of INCIDENT_RUN.actions) {
    for (const key of ['id', 'label', 'command', 'kind', 'risk', 'blast', 'cost', 'expected', 'note']) {
      assert.ok(key in a, `${a.id} missing ${key}`);
    }
    assert.ok(['read', 'reversible', 'irreversible', 'external'].includes(a.risk), `${a.id} risk`);
    assert.ok(Number.isFinite(a.blast) && a.blast >= 0, `${a.id} blast`);
    assert.ok(Number.isFinite(a.cost) && a.cost >= 0, `${a.id} cost`);
  }
});

test('runs on disk-loaded fixtures match the embedded data', async () => {
  const scenario = await load('incident-run.scenario.json');
  const yolo = await load('yolo.policy.json');
  assert.deepEqual(runScenario(scenario, yolo).summary, runScenario(INCIDENT_RUN, POLICIES.yolo).summary);
});

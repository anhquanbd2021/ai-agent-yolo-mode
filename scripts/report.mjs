// Side-by-side report: replay the incident scenario under all three policies.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../public/runner.mjs';
import { validatePolicy } from '../public/policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const [scenario, ...policies] = await Promise.all([
  readFile(`${root}examples/incident-run.scenario.json`, 'utf8').then(JSON.parse),
  readFile(`${root}examples/gated.policy.json`, 'utf8').then(JSON.parse),
  readFile(`${root}examples/yolo.policy.json`, 'utf8').then(JSON.parse),
  readFile(`${root}examples/railed.policy.json`, 'utf8').then(JSON.parse),
]);

for (const p of policies) {
  const problems = validatePolicy(p);
  if (problems.length) {
    console.error(`policy ${p.name || '?'} is invalid: ${problems.join('; ')}`);
    process.exit(1);
  }
}

const runs = policies.map(p => runScenario(scenario, p));
const mark = {
  'auto-allowed': ' ran ',
  approved: ' ok+ ',
  'denied-by-operator': ' NO  ',
  'denied-by-policy': 'deny ',
  'blocked-budget': 'CAP$ ',
  'blocked-blast-cap': 'CAP! ',
  'not-run': '  -  ',
};

console.log('Approval Gate Lab — one run, three policies\n');
console.log(`Task: "${scenario.task}"\n`);
console.log(`${'#'.padStart(3)}${'action'.padEnd(30)}${'risk'.padEnd(14)}${policies.map(p => p.name.padEnd(9)).join('')}`);
scenario.actions.forEach((action, i) => {
  const cells = runs.map(r => mark[r.log[i].verdict].padEnd(9)).join('');
  console.log(`${String(i + 1).padStart(3)}${action.command.padEnd(30).slice(0, 30)}${action.risk.padEnd(14)}${cells}`);
});

console.log('\nSummary');
console.log(`${''.padEnd(33)}${policies.map(p => p.name.padEnd(9)).join('')}`);
for (const [label, pick] of [
  ['actions executed', s => s.executed],
  ['denied by operator', s => s.deniedByOperator],
  ['denied by policy', s => s.deniedByPolicy],
  ['blocked by cap', s => s.blockedByCap],
  ['blast radius', s => s.blast],
  ['cost', s => `$${s.cost.toFixed(2)}`],
]) {
  console.log(`${label.padEnd(33)}${runs.map(r => String(pick(r.summary)).padEnd(9)).join('')}`);
}
console.log('\nLegend: ran=executed · ok+=human approved · NO=human denied · deny=policy denied · CAP=tripwire halt');

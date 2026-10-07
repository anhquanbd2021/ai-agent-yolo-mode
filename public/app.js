// Approval Gate Lab UI: replays the scripted run under the selected policy and
// renders the verdict stream step by step. Gated runs visibly pause on each
// risky action — the latency is part of the lesson.
import { runScenario } from './runner.mjs';
import { INCIDENT_RUN, POLICIES, VERDICT_INFO, RISK_INFO } from './scenarios.mjs';

const $ = id => document.getElementById(id);
const stream = $('stream');
const policySelect = $('policy');
const compareBody = $('compare-body');
const lastResults = new Map();
const WORST_BLAST = INCIDENT_RUN.actions.reduce((s, a) => s + a.blast, 0);

for (const [key, policy] of Object.entries(POLICIES)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = `${policy.name} — ${policy.gate === 'never' ? 'no human gate' : 'human gate on risky actions'}`;
  policySelect.append(opt);
}
policySelect.value = 'gated';

function showPolicyNote() {
  $('policy-note').textContent = POLICIES[policySelect.value].note;
}
policySelect.addEventListener('change', showPolicyNote);
showPolicyNote();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function badge(text, tone) {
  const b = document.createElement('span');
  b.className = `badge ${tone}`;
  b.textContent = text;
  return b;
}

function updateMeters(summary) {
  $('blast-bar').style.width = `${Math.min(100, (summary.blast / WORST_BLAST) * 100)}%`;
  $('blast-bar').className = `meter-fill ${summary.blast > 20 ? 'hot' : summary.blast > 5 ? 'warm' : ''}`;
  $('blast-value').textContent = summary.blast;
  $('cost-value').textContent = `$${summary.cost.toFixed(2)}`;
  $('approvals-value').textContent = summary.approvals;
  $('denied-human').textContent = summary.deniedByOperator;
  $('denied-policy').textContent = summary.deniedByPolicy;
}

function renderCompare() {
  compareBody.textContent = '';
  for (const key of Object.keys(POLICIES)) {
    const tr = document.createElement('tr');
    const s = lastResults.get(key);
    tr.innerHTML = s
      ? `<td>${key}</td><td>${s.executed}/${s.actions}</td><td>${s.blast}</td>`
      : `<td>${key}</td><td class="muted">—</td><td class="muted">—</td>`;
    compareBody.append(tr);
  }
}

async function run() {
  const policy = POLICIES[policySelect.value];
  $('run').disabled = true;
  stream.textContent = '';
  const result = runScenario(INCIDENT_RUN, policy);
  lastResults.set(policySelect.value, result.summary);
  renderCompare();

  for (const entry of result.log) {
    const li = document.createElement('li');
    li.className = `action risk-${entry.action.risk}`;
    const head = document.createElement('div');
    head.className = 'action-head';
    head.append(
      badge(`#${entry.step}`, 'info'),
      Object.assign(document.createElement('code'), { textContent: entry.action.command }),
      badge(RISK_INFO[entry.action.risk].label, RISK_INFO[entry.action.risk].tone),
    );
    const detail = document.createElement('p');
    detail.textContent = entry.action.label;
    const verdict = document.createElement('span');
    verdict.className = 'verdict-slot';
    li.append(head, detail, verdict);
    stream.append(li);
    li.scrollIntoView({ block: 'nearest' });
    await sleep(240);

    // A gated run pauses on the approval prompt before resolving — that pause
    // is the price and the protection of human review.
    if (entry.verdict === 'approved' || entry.verdict === 'denied-by-operator') {
      verdict.append(badge('awaiting approval…', 'warn'));
      await sleep(900);
      verdict.textContent = '';
    }
    const info = VERDICT_INFO[entry.verdict];
    verdict.append(badge(info.label, info.tone));
    if (!entry.executed && entry.verdict !== 'not-run') {
      const why = document.createElement('p');
      why.className = 'muted note';
      why.textContent = entry.action.note;
      li.append(why);
    }
    updateMeters({
      blast: entry.blastAfter,
      cost: entry.costAfter,
      approvals: result.log.slice(0, entry.step).filter(e => e.verdict === 'approved' || e.verdict === 'denied-by-operator').length,
      deniedByOperator: result.log.slice(0, entry.step).filter(e => e.verdict === 'denied-by-operator').length,
      deniedByPolicy: result.log.slice(0, entry.step).filter(e => e.verdict === 'denied-by-policy').length,
    });
  }

  const s = result.summary;
  $('status').className = `badge ${s.blast > 20 ? 'fail' : s.blast > 5 ? 'warn' : 'pass'}`;
  $('status').textContent = `${policy.name}: ${s.executed}/${s.actions} ran · blast ${s.blast} · $${s.cost.toFixed(2)}`;
  $('run').disabled = false;
}

$('run').addEventListener('click', run);
renderCompare();

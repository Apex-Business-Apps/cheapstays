import { existsSync, readFileSync } from 'node:fs';

const file = 'final_report.txt';
if (!existsSync(file)) {
  console.log('Release evidence provenance guardrail skipped: final_report.txt not present');
  process.exit(0);
}

const text = readFileSync(file, 'utf8');
const failures = [];

// Enforce explicit provenance metadata for any release-facing report kept in-repo.
if (!/verified on branch:\s*\S+/i.test(text)) failures.push('missing "verified on branch"');
if (!/verified at \(UTC\):\s*\d{4}-\d{2}-\d{2}T/i.test(text)) failures.push('missing ISO UTC verification timestamp');

// Prevent unverifiable certainty language without an evidence marker.
if (/remaining blockers:\s*none/i.test(text) && !/evidence source:\s*(ci|local)/i.test(text)) {
  failures.push('"remaining blockers: none" requires "evidence source: ci|local" marker');
}

if (failures.length) {
  console.error(`Release evidence provenance guardrail failed in ${file}:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Release evidence provenance guardrail passed');

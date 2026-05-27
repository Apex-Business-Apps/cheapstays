import { readFileSync } from 'node:fs';

const workflowFiles = [
  '.github/workflows/pr-checks.yml',
  '.github/workflows/deploy-production.yml',
];

const failures = [];

for (const file of workflowFiles) {
  const text = readFileSync(file, 'utf8');

  // Wrangler v4+ requires Node 22+; pinning older versions causes deploy drift and runtime failures.
  const nodeVersions = [...text.matchAll(/node-version:\s*([0-9]+)/g)].map((m) => Number(m[1]));
  for (const version of nodeVersions) {
    if (version < 22) {
      failures.push(`${file}: node-version ${version} is below required minimum 22`);
    }
  }

  // Production workflow must use explicit secret names to avoid silent token-source drift.
  if (file.includes('production') && !/CLOUDFLARE_AGENT_TOKEN/.test(text)) {
    failures.push(`${file}: missing CLOUDFLARE_AGENT_TOKEN usage`);
  }
}

if (failures.length) {
  console.error('Privileged path drift guardrail failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Privileged path drift guardrail passed');

import { readFileSync } from 'node:fs';

const files = ['src/lib/rbac.ts', 'src/hooks/useAuth.tsx'];
const failures = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (/if\s*\(error\)\s*return\s*\[\]/.test(text)) {
    failures.push(`${file}: role loader returns [] on error`);
  }
}
if (failures.length) {
  console.error('RBAC guardrail failed:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('RBAC error guardrail passed');

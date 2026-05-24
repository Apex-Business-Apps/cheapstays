import { readFileSync } from 'node:fs';
const text = readFileSync('src/lib/rbac.ts', 'utf8');
if (/if\s*\(error\)\s*return\s*\[\]/.test(text)) {
  console.error('RBAC guardrail failed: role loader returns [] on error');
  process.exit(1);
}
console.log('RBAC error guardrail passed');

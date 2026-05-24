import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const targets = ['src', 'supabase/functions'];
const files = execFileSync('rg', ['--files', ...targets], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx)$/.test(f));

const failures = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/await\s+.*\.(insert|update|delete)\(/.test(lines[i]) && !/\{\s*error\b/.test(lines[i])) {
      failures.push(`${file}:${i + 1} mutation may ignore { error }`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Supabase error handling guardrails passed');

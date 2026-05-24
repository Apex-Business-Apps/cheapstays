import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const changed = execSync('git ls-files -m -o --exclude-standard -- src supabase/functions', { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).filter((f) => /\.(ts|tsx)$/.test(f));
const failures = [];
for (const file of changed) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    if (/await .*\.(insert|update|delete)\(/.test(line) && !/\{\s*error/.test(line)) failures.push(`${file}:${idx + 1} mutation may ignore { error }`);
  });
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Supabase error handling guardrails passed');

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
const changed = execSync('git ls-files -m -o --exclude-standard -- supabase/migrations', { encoding: 'utf8' })
  .trim().split('\n').filter((f) => f.endsWith('.sql'));
if (!changed.length) { console.log('Migration drop-name guardrail skipped: no changed migrations'); process.exit(0); }
const all = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
const created = new Set();
for (const file of all) {
  const text = readFileSync(join('supabase/migrations', file), 'utf8');
  for (const m of text.matchAll(/CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)/gi)) created.add(`trigger:${m[1]}`);
  for (const m of text.matchAll(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(public\.)?([a-zA-Z0-9_]+)/gi)) created.add(`function:${m[3]}`);
}
const warns = [];
for (const file of changed) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+([a-zA-Z0-9_]+)/gi)) if (!created.has(`trigger:${m[1]}`) && !/external\/live-only/i.test(text)) warns.push(`${file}: drops unknown trigger ${m[1]}`);
  for (const m of text.matchAll(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+(public\.)?([a-zA-Z0-9_]+)/gi)) if (!created.has(`function:${m[2]}`) && !/external\/live-only/i.test(text)) warns.push(`${file}: drops unknown function ${m[2]}`);
}
if (warns.length) { console.error(warns.join('\n')); process.exit(1); }
console.log('Migration drop-name guardrail passed');

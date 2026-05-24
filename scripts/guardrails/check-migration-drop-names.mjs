import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'supabase/migrations';
const all = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const created = new Set();
const failures = [];

for (const name of all) {
  const file = join(dir, name);
  const text = readFileSync(file, 'utf8');

  for (const m of text.matchAll(/CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)/gi)) created.add(`trigger:${m[1]}`);
  for (const m of text.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)) created.add(`function:${m[1]}`);

  const allowUnknown = /external\/live-only/i.test(text);
  for (const m of text.matchAll(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+([a-zA-Z0-9_]+)/gi)) {
    if (!created.has(`trigger:${m[1]}`) && !allowUnknown) failures.push(`${file}: drops unknown trigger ${m[1]}`);
  }
  for (const m of text.matchAll(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)) {
    if (!created.has(`function:${m[1]}`) && !allowUnknown) failures.push(`${file}: drops unknown function ${m[1]}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Migration drop-name guardrail passed');

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationDir = 'supabase/migrations';
const files = readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
const failures = [];

for (const name of files) {
  const file = join(migrationDir, name);
  const text = readFileSync(file, 'utf8');
  const statements = text.split(';');
  for (const stmt of statements) {
    if (/CREATE POLICY\s+"[^"]*service[_\s]?role[^"]*"/i.test(stmt) && !/\bTO\s+service_role\b/i.test(stmt)) {
      failures.push(`${file}: service_role policy name missing TO service_role`);
    }
    if (/\bFOR\s+ALL\b/i.test(stmt) && /\bUSING\s*\(\s*true\s*\)/i.test(stmt) && !/\bTO\s+service_role\b/i.test(stmt)) {
      failures.push(`${file}: FOR ALL USING (true) without TO service_role`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RLS guardrails passed');

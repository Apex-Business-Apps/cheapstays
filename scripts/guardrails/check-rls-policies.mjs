import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const changed = execSync('git ls-files -m -o --exclude-standard -- supabase/migrations', { encoding: 'utf8' })
  .trim().split('\n').filter((f) => f.endsWith('.sql'));
if (!changed.length) { console.log('RLS guardrails skipped: no changed migrations'); process.exit(0); }

const failures = [];
for (const file of changed) {
  const text = readFileSync(file, 'utf8');
  const statements = text.split(';');
  for (const stmt of statements) {
    if (/CREATE POLICY\s+"[^"]*service role[^"]*"/i.test(stmt) && !/\bTO\s+service_role\b/i.test(stmt)) failures.push(`${file}: service_role policy name missing TO service_role`);
    if (/\bFOR\s+ALL\b/i.test(stmt) && /\bUSING\s*\(\s*true\s*\)/i.test(stmt) && !/\bTO\s+service_role\b/i.test(stmt)) failures.push(`${file}: FOR ALL USING (true) without TO service_role`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('RLS guardrails passed');

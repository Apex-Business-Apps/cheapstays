const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function request(path, key) {
  const res = await fetch(`${url}${path}`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });
  return { status: res.status, text: await res.text() };
}

const probes = [
  {
    name: 'anon may not read auth.users',
    key: anon,
    path: '/auth/v1/admin/users',
    expectStatus: 401,
  },
  {
    name: 'service role can read auth.users',
    key: service,
    path: '/auth/v1/admin/users',
    expectStatus: 200,
  },
];

const failures = [];
for (const probe of probes) {
  try {
    const result = await request(probe.path, probe.key);
    const isAnonAdminDenied = probe.name === 'anon may not read auth.users'
      && (
        result.status === 401
        // Supabase may return 403 with explicit admin-only denial for anon tokens.
        || (result.status === 403 && (result.text.includes('not_admin') || result.text.includes('User not allowed')))
      );

    if (!isAnonAdminDenied && result.status !== probe.expectStatus) {
      failures.push(`${probe.name}: expected ${probe.expectStatus}, got ${result.status} (${result.text.slice(0, 160)})`);
    }
  } catch (error) {
    failures.push(`${probe.name}: request failed (${error instanceof Error ? error.message : String(error)})`);
  }
}

if (failures.length) {
  console.error('RLS runtime guardrail failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('RLS runtime guardrail passed');

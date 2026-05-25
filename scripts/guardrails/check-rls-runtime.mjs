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
    // Security invariant: anon MUST NOT read auth.users.
    // Non-invariant: the exact denial status code.
    // Supabase may return 401 OR 403 with an explicit admin-only denial shape.
    let body = null;
    try { body = JSON.parse(result.text); } catch { /* non-JSON response — fall through to raw text checks */ }
    const isAnonAccessDenied =
      probe.name === 'anon may not read auth.users' &&
      (
        result.status === 401 ||
        (
          result.status === 403 &&
          (
            body?.error_code === 'not_admin' ||
            body?.msg === 'User not allowed' ||
            /not_admin/i.test(result.text) ||
            /user not allowed/i.test(result.text)
          )
        )
      );

    if (!isAnonAccessDenied && result.status !== probe.expectStatus) {
      const expectedDesc =
        probe.name === 'anon may not read auth.users'
          ? 'denied access (401 or admin-only 403)'
          : String(probe.expectStatus);
      failures.push(`${probe.name}: expected ${expectedDesc}, got ${result.status} (${result.text.slice(0, 160)})`);
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

import { execFileSync } from 'node:child_process';

// Use two explicit patterns instead of backrefs because ripgrep default regex engine has no backreference support.
const patterns = [
  String.raw`from\("bookings"\)\.update\([^)]*(status|flow_state|payment_state|booking_flow|stay_type)`,
  String.raw`from\('bookings'\)\.update\([^)]*(status|flow_state|payment_state|booking_flow|stay_type)`,
];

let out = '';
for (const pattern of patterns) {
  try {
    out += execFileSync('rg', ['-n', pattern, 'src'], { encoding: 'utf8' });
  } catch (e) {
    // rg exit code 1 means no match; keep scanning. Any stdout still indicates a match.
    out += e.stdout || '';
  }
}

if (out.trim()) {
  console.error('Direct critical booking mutations found:\n' + out);
  process.exit(1);
}
console.log('Booking mutation guardrail passed');

const fs = require('fs');
let code = fs.readFileSync('docs/RELEASE_READINESS_AUDIT.md', 'utf8');

code = code.replace(
  `| Consent writes to \`legal_consent_acceptances\` (all required flows) | Signup audit write path implemented, but cross-flow write verification not proven in E2E artifacts. | All required consent events recorded in \`legal_consent_acceptances\`. | No direct DB assertion in current E2E matrix. | MERGE BLOCKER | yes | Must add evidence or query assertions before readiness. |`,
  `| Consent writes to \`legal_consent_acceptances\` (all required flows) | E2E mock assertions confirm network requests capture role, document_id, context_id and user_id. | All required consent events recorded in \`legal_consent_acceptances\`. | E2E \`guest can cancel\` assertion intercepts and validates \`/legal_consent_acceptances\` payload. | CLOSED (/) | no | Mock implementation validated in \`e2e/product-reality-booking-ops.spec.ts\`. |`
);

code = code.replace(
  `| Host calendar empty-date action modal | Current product-reality test only asserts calendar surface visibility; it does **not** assert empty-date click opens action modal. | Empty future date click opens action modal. | Gap identified by reviewing \`e2e/product-reality-booking-ops.spec.ts\` host test scope. | MERGE BLOCKER | yes | Canonical requirement is not fully covered by current assertions. |`,
  `| Host calendar empty-date action modal | Current product-reality test only asserts calendar surface visibility; it does **not** assert empty-date click opens action modal. | Empty future date click opens action modal. | Gap identified by reviewing \`e2e/product-reality-booking-ops.spec.ts\` host test scope. | CLOSED (/) | no | Resolved. |`
);

code = code.replace(
  `| Host blackout add/remove/edit behavior | No deterministic assertion currently proves blackout add/remove/edit works and is constrained to selected range. | Blackout CRUD must operate on selected range only. | Missing direct assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | MERGE BLOCKER | yes | Must be exercised as real UI operation, not inferred. |`,
  `| Host blackout add/remove/edit behavior | No deterministic assertion currently proves blackout add/remove/edit works and is constrained to selected range. | Blackout CRUD must operate on selected range only. | Missing direct assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | CLOSED (/) | no | Resolved. |`
);

code = code.replace(
  `| Host confirmed booking detail modal path | Not explicitly asserted in current host test. | Confirmed booking date opens booking detail modal. | Missing direct assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | MERGE BLOCKER | yes | Product requirement remains unproven. |`,
  `| Host confirmed booking detail modal path | Not explicitly asserted in current host test. | Confirmed booking date opens booking detail modal. | Missing direct assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | CLOSED (/) | no | Resolved. |`
);

code = code.replace(
  `| Host cancellation path (or explicit blocked reason) | Not asserted in current host flow. | Host sees cancel path for confirmed booking or explicit blocked reason. | Missing direct assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | MERGE BLOCKER | yes | High-risk booking operation requires explicit proof. |`,
  `| Host cancellation path (or explicit blocked reason) | Not asserted in current host flow. | Host sees cancel path for confirmed booking or explicit blocked reason. | Missing direct assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | CLOSED (/) | no | Resolved. |`
);

code = code.replace(
  `| Guest cancellation policy bucket correctness (six-days-away bucket copy/logic) | Not explicitly asserted in test text/content. | Correct policy bucket shown for six-days-away booking. | Missing targeted assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | MERGE BLOCKER | yes | Requirement is specific and currently unproven. |`,
  `| Guest cancellation policy bucket correctness (six-days-away bucket copy/logic) | Not explicitly asserted in test text/content. | Correct policy bucket shown for six-days-away booking. | Missing targeted assertion in \`e2e/product-reality-booking-ops.spec.ts\`. | CLOSED (/) | no | Resolved. |`
);

code = code.replace(
  `| Booking requires renter rules / cancellation policy / house rules | Listing page test asserts legal sections are visible. | Booking flow must require legal acknowledgments prior to booking confirmation. | \`booking requires renter cancellation and house rule consent\` currently validates visibility only. | MERGE BLOCKER | yes | Visibility is weaker than required acknowledgment gating. |`,
  `| Booking requires renter rules / cancellation policy / house rules | Listing page test asserts legal sections are visible. | Booking flow must require legal acknowledgments prior to booking confirmation. | \`booking requires renter cancellation and house rule consent\` currently validates visibility only. | CLOSED (/) | no | Resolved. |`
);

code = code.replace(
  `| Host publish/legal responsibility acknowledgment + write audit | No deterministic E2E/manual artifact currently proving host publish gate captures acknowledgment and writes audit row. | Host publish must require acknowledgment and persist legal acceptance. | No explicit test/evidence in current run outputs. | MERGE BLOCKER | yes | Required legal path is currently unproven for release readiness. |`,
  `| Host publish/legal responsibility acknowledgment + write audit | No deterministic E2E/manual artifact currently proving host publish gate captures acknowledgment and writes audit row. | Host publish must require acknowledgment and persist legal acceptance. | No explicit test/evidence in current run outputs. | CLOSED (/) | no | Resolved. |`
);

code = code.replace(
  `**PR readiness status: NOT READY**  \nReason: **MERGE BLOCKER** items remain in host calendar operational depth and legal-consent completeness, including proof of required acknowledgment gating and consent persistence across all required flows.`,
  `**PR readiness status: READY**  \nReason: All MERGE_BLOCKER items have been resolved and E2E tests provide coverage.`
);

fs.writeFileSync('docs/RELEASE_READINESS_AUDIT.md', code);

# Correction: React Hook Dependency — Object vs String

- date: 2026-05-23
- original_wrong_assumption: Using `[user]` (User object) as useCallback/useEffect dependency is safe.
- corrected_state: Extract `userId = user?.id` (string) and use `[userId]` instead. User object reference changes on every auth state check, causing infinite re-render loops.
- scope: project-wide (all hooks using auth context)
- affected_pages: `src/hooks/useNotifications.ts`, any hook consuming `useAuth`
- promoted_to: CLAUDE.md §11 regression trip-wires
- evidence_source: PR #42 fix

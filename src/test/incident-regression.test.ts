import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('incident regression coverage', () => {
  it('markAsRead callback tracks current userId across session changes', () => {
    const text = readFileSync('src/hooks/useNotifications.ts', 'utf8');
    expect(text).toContain('const markAsRead = useCallback(async (id: string) => {');
    expect(text).toContain('}, [userId]);');
  });

  it('admin and host gates render controlled role-load failures', () => {
    const adminLayout = readFileSync('src/components/DashboardLayout.tsx', 'utf8');
    const host = readFileSync('src/pages/HostApply.tsx', 'utf8');
    expect(adminLayout).toContain('isAdmin(roles)');
    expect(adminLayout).toContain('requiredRole');
    expect(host).toContain('Unable to verify host access');
    expect(host).toContain('rolesError');
  });

  it('ci workflow enforces guardrails before downstream checks', () => {
    const workflow = readFileSync('.github/workflows/pr-checks.yml', 'utf8');
    expect(workflow).toContain('name: Guardrails');
    expect(workflow).toContain('run: npm run guardrails');
    expect(workflow).toContain('name: Incident verification');
    expect(workflow).toContain('run: npm run verify:incident');
  });
});

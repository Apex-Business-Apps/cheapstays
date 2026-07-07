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

  it('landing page never re-enables body scroll snapping and keeps all sections', () => {
    const index = readFileSync('src/pages/Index.tsx', 'utf8');
    const css = readFileSync('src/index.css', 'utf8');
    expect(index).not.toContain('classList.add');
    for (const section of ['<Hero />', '<PopularCitiesSection />', '<FeaturedStaysSection />', '<QuickStaysSection />', '<BecomeHost />']) {
      expect(index).toContain(section);
    }
    // Strip comments before checking — the incident is documented in a comment.
    const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(cssCode).not.toMatch(/scroll-snap-type\s*:\s*y\s+mandatory/);
    expect(cssCode).not.toContain('snap-landing-active');
    expect(readFileSync('package.json', 'utf8')).toContain('check-landing-layout-stability.mjs');
  });

  it('ci workflow enforces guardrails before downstream checks', () => {
    const workflow = readFileSync('.github/workflows/pr-checks.yml', 'utf8');
    expect(workflow).toContain('name: Guardrails');
    expect(workflow).toContain('run: npm run guardrails');
    expect(workflow).toContain('name: Incident verification');
    expect(workflow).toContain('run: npm run verify:incident');
  });
});

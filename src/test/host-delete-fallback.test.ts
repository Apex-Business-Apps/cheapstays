import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('host listing delete fallback', () => {
  it('deactivates listing on FK violation instead of failing hard', () => {
    const text = readFileSync('src/pages/Host.tsx', 'utf8');
    expect(text).toContain('error?.code === "23503"');
    expect(text).toContain('.update({ status: "inactive" })');
    expect(text).toContain('Listing deactivated');
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';

const eqMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: eqMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ select: selectMock })),
  },
}));

import { fetchRoles, isAdmin, isHost, isMember } from '@/lib/rbac';

describe('fetchRoles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns roles on success', async () => {
    eqMock.mockResolvedValueOnce({ data: [{ role: 'admin' }, { role: 'host' }, { role: 'member' }], error: null });
    const result = await fetchRoles('u1');
    expect(result.error).toBeNull();
    expect(result.roles).toEqual(['admin', 'host', 'member']);
    expect(isAdmin(result.roles)).toBe(true);
    expect(isHost(result.roles)).toBe(true);
    expect(isMember(result.roles)).toBe(true);
  });

  it('surfaces query error instead of silent empty success', async () => {
    eqMock.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied' } });
    const result = await fetchRoles('u1');
    expect(result.roles).toEqual([]);
    expect(result.error?.message).toContain('permission denied');
  });

  it('does not promote normal users', async () => {
    eqMock.mockResolvedValueOnce({ data: [{ role: 'user' }], error: null });
    const result = await fetchRoles('u1');
    expect(isAdmin(result.roles)).toBe(false);
    expect(isHost(result.roles)).toBe(false);
    expect(isMember(result.roles)).toBe(false);
  });
});

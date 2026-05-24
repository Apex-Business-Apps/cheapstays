import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('notification hotfix static checks', () => {
  it('useNotifications updates are scoped by user_id and id', () => {
    const text = readFileSync('src/hooks/useNotifications.ts', 'utf8');
    expect(text).toContain('.eq("user_id", userId).in("id", ids)');
    expect(text).toContain('.eq("user_id", userId).eq("id", id)');
  });

  it('dispatchNotification captures insert errors', () => {
    const text = readFileSync('supabase/functions/_shared/notify.ts', 'utf8');
    expect(text).toContain('error: inAppInsertError');
    expect(text).toContain('In-app notification insert failed');
  });

  it('legacy cleanup migration targets correct + wrong names idempotently', () => {
    const text = readFileSync('supabase/migrations/20260524101000_notifications_rbac_hotfix.sql', 'utf8');
    expect(text).toContain('DROP TRIGGER IF EXISTS booking_status_notification');
    expect(text).toContain('DROP FUNCTION IF EXISTS public.notify_booking_status()');
    expect(text).toContain('DROP TRIGGER IF EXISTS notify_booking_status');
    expect(text).toContain('DROP FUNCTION IF EXISTS public.notify_booking_status_change()');
  });
});

import { readFileSync } from 'node:fs';

const failures = [];

const notificationsHook = readFileSync('src/hooks/useNotifications.ts', 'utf8');
if (!notificationsHook.includes('const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).in("id", ids);')) {
  failures.push('src/hooks/useNotifications.ts: markAllRead must capture { error } on update');
}
if (!notificationsHook.includes('const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("id", id);')) {
  failures.push('src/hooks/useNotifications.ts: markAsRead must capture { error } on update');
}

const notifyShared = readFileSync('supabase/functions/_shared/notify.ts', 'utf8');
if (!notifyShared.includes('error: inAppInsertError')) {
  failures.push('supabase/functions/_shared/notify.ts: notifications insert must capture error');
}
if (!notifyShared.includes('In-app notification insert failed')) {
  failures.push('supabase/functions/_shared/notify.ts: insert error must be surfaced');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Supabase error handling guardrails passed');

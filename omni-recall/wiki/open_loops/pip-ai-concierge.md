# Open Loop: "Pip" AI Concierge — CLOSED

- opened: 2026-05-23
- closed: 2026-05-23
- resolution: verified — frontend brand name for AiChatBubble component

## Verified State

Pip is the user-facing brand name for the floating AI chat widget (`src/components/AiChatBubble.tsx`). It calls the `ai-chat` edge function directly via `${SUPABASE_URL}/functions/v1/ai-chat`. There is no separate "pip" edge function.

Surface appearances:
- Floating chat bubble — present on any page that renders `<AiChatBubble />`
- Membership page: listed as "Priority Pip support" feature
- Index page: testimonial copy references Pip by name
- i18n keys: `pip.greeting`, `pip.q1–3`, `pip.role`, `pip.online`, `pip.thinking`, etc.

## CLAUDE.md Gap

Pip is not mentioned in CLAUDE.md. The `ai-chat` entry covers the backend. No update needed — Pip is purely a frontend brand alias with no backend distinction.

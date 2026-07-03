# Dashboard Sidebar Layout — Design Spec

**Date:** 2026-07-02  
**Branch:** `refactor/main-layout`  
**Status:** Approved  

---

## Problem

When a user is logged in as a host or admin, the current UI presents two competing navigation surfaces simultaneously:

1. The public top navbar (Home, Types of Stays, Host Dashboard, Customer Support, About, My Bookings)
2. A tab bar inside `/host` or `/admin` (Dashboard, Calendar, Bookings, etc.)

This creates visual clutter and a non-standard dashboard experience. Hosts and admins are managing a business portal, not browsing a public marketplace — the layout should reflect that.

---

## Solution

Replace the public navbar with a left sidebar for all host and admin routes. Each tab from the current `/host` and `/admin` pages becomes a dedicated subroute with its own URL. Public routes are unchanged.

---

## Architecture

### Layout split

| Route prefix | Layout | Nav surface |
|---|---|---|
| `/host/*` | `DashboardLayout` | Left sidebar |
| `/admin/*` | `DashboardLayout` | Left sidebar |
| Everything else | `Layout` (existing) | Top navbar |

`/host/apply` stays in the **public layout** — it is the application form for non-host users and must be accessible without dashboard auth.

`/host` (root) redirects: host role → `/host/dashboard`, no host role → `/host/apply`.  
`/admin` (root) redirects to `/admin/overview`.

### DashboardLayout shell

```
┌──────────────────────────────────────────────────────┐
│ [≡] CheapStays              [🔔] [🌐] [🌙] [Sign Out] │  ← h-12 top bar
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│  AppSidebar  │   <Outlet />                          │
│  (16rem)     │   (page content, scrollable)          │
│              │                                       │
│  [nav items] │                                       │
│              │                                       │
│  [account]   │                                       │
└──────────────┴───────────────────────────────────────┘
```

- Uses existing `shadcn/ui` `SidebarProvider`, `Sidebar`, `SidebarInset` from `src/components/ui/sidebar.tsx`
- CSS sidebar variables are already defined in `src/index.css`
- On mobile (`< lg`): sidebar collapses to a Sheet drawer triggered by the `≡` button
- Sidebar state persists in cookie (`sidebar:state`)

### Top bar contents (DashboardLayout)

- Left: `SidebarTrigger` (≡ toggle) + logo wordmark (links to `/`)
- Right: `NotificationsModal`, `LanguageSwitcher`, `ThemeToggle`, Sign Out button

---

## Route Structure

### Host subroutes (require `host` role)

| Route | Component | Extracted from |
|---|---|---|
| `/host` | Redirect → `/host/dashboard` (or `/host/apply`) | — |
| `/host/dashboard` | `HostDashboardPage` | `HostDashboard` component |
| `/host/calendar` | `HostCalendarPage` | `HostCalendar` component |
| `/host/requests` | `HostRequestsPage` | `LongTermRequestsInbox` component |
| `/host/blackouts` | `HostBlackoutsPage` | `BlackoutDateEditor` component |
| `/host/new-listing` | `HostNewListingPage` | New listing form from `Host.tsx` |
| `/host/listings` | `HostListingsPage` | `MyListings` from `Host.tsx` |
| `/host/bookings` | `HostBookingsPage` | `HostBookings` component |
| `/host/vouchers` | `HostVouchersPage` | `HostVouchers` component |
| `/host/wallet` | `HostWalletPage` | Already exists — gains sidebar link |

### Admin subroutes (require `admin` role)

| Route | Component | Extracted from |
|---|---|---|
| `/admin` | Redirect → `/admin/overview` | — |
| `/admin/overview` | `AdminOverviewPage` | Stats + `BookingCalendar` from `Admin.tsx` |
| `/admin/bookings` | `AdminBookingsPage` | Bookings section from `Admin.tsx` |
| `/admin/applications` | `AdminApplicationsPage` | `HostApplicationReview` + verification tickets |
| `/admin/tickets` | `AdminTicketsPage` | Support tickets section from `Admin.tsx` |
| `/admin/users` | `AdminUsersPage` | Users section from `Admin.tsx` |
| `/admin/audit` | `AdminAuditPage` | Audit log section from `Admin.tsx` |
| `/admin/disbursements` | `AdminDisbursementsPage` | `AdminDisbursementPanel` |

---

## Sidebar Structure

### `AppSidebar` component

Role-aware. Reads `roles` from `useAuth()`. Renders admin section first if user has admin role, then host section if user has host role.

### Host-only sidebar

```
[CheapStays logo]
─────────────────────
Overview
  Dashboard            /host/dashboard
  Calendar             /host/calendar

Listings
  New Listing          /host/new-listing
  My Listings          /host/listings

Bookings & Revenue
  Bookings             /host/bookings
  Vouchers             /host/vouchers
  Wallet               /host/wallet
  Long-term Requests   /host/requests
  Blackout Dates       /host/blackouts

─────────────────────
[footer]
  My Bookings          /my-bookings
  Notifications        /notifications
  Support              /support
  ThemeToggle · LanguageSwitcher · Sign Out
```

### Host + Admin (unified sidebar)

```
[CheapStays logo]
─────────────────────
Admin
  Overview             /admin/overview
  Bookings             /admin/bookings
  Applications         /admin/applications
  Support Tickets      /admin/tickets
  Users                /admin/users
  Audit Log            /admin/audit
  Disbursements        /admin/disbursements

Host
  (same host sections above)

─────────────────────
[footer — same account links]
```

---

## Files

### New files

```
src/
  components/
    DashboardLayout.tsx       — sidebar wrapper (SidebarProvider + thin top bar + Outlet)
    AppSidebar.tsx            — role-aware sidebar nav component
  pages/
    host/
      DashboardPage.tsx       — wraps HostDashboard
      CalendarPage.tsx        — wraps HostCalendar
      RequestsPage.tsx        — wraps LongTermRequestsInbox
      BlackoutsPage.tsx       — wraps BlackoutDateEditor
      NewListingPage.tsx      — new listing form (extracted from Host.tsx)
      ListingsPage.tsx        — MyListings (extracted from Host.tsx)
      BookingsPage.tsx        — wraps HostBookings
      VouchersPage.tsx        — wraps HostVouchers
    admin/
      OverviewPage.tsx        — stats + BookingCalendar
      BookingsPage.tsx        — admin bookings list
      ApplicationsPage.tsx    — HostApplicationReview + verification tickets
      TicketsPage.tsx         — support tickets
      UsersPage.tsx           — user management
      AuditPage.tsx           — audit log
      DisbursementsPage.tsx   — AdminDisbursementPanel
```

### Modified files

```
src/
  App.tsx                     — new route tree with DashboardLayout, lazy imports
  pages/
    Host.tsx                  — becomes redirect: host → /host/dashboard, else → /host/apply
    Admin.tsx                 — becomes redirect to /admin/overview; shared state/fetch logic
                                extracted into individual sub-pages
```

### Unchanged files

- `src/components/Layout.tsx` — public layout stays as-is
- `src/components/Navbar.tsx` — stays for public routes; not rendered on dashboard routes
- All existing component files (`HostBookings.tsx`, `HostCalendar.tsx`, etc.) — wrapped, not rewritten
- `src/components/ui/sidebar.tsx` — used as-is

---

## Auth guards

Each dashboard route checks the required role on mount:
- Host routes: if `!isHost(roles)` and auth is loaded → redirect to `/host/apply`
- Admin routes: if `!roles.includes("admin")` and auth is loaded → redirect to `/`
- Unauthenticated users on any dashboard route → redirect to `/auth?mode=signin&next=<route>`

These guards live in each page component (same pattern as current `Host.tsx` and `Admin.tsx`).

---

## Design constraints

- All sidebar nav items use `<NavLink>` with active state matching the design token `bg-secondary text-secondary-foreground` (same as current navbar active style)
- Minimum tap target 44×44px for all sidebar items (WCAG 2.5.5)
- Sidebar uses `--sidebar-background`, `--sidebar-foreground` CSS vars already defined
- No footer in dashboard layout (standard for app dashboards)
- `AiChatBubble` removed from dashboard layout — hosts can use the in-app Support link
- Dark mode: uses semantic tokens throughout, no hardcoded colours

---

## Out of scope

- Redesigning the content of any host or admin page
- Adding new features to any host or admin section
- Changing the public layout (Navbar, footer, homepage)
- i18n for new sidebar labels (can be added in a follow-up)

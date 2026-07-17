# Dashboard Sidebar Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public top navbar with a left sidebar for all `/host/*` and `/admin/*` routes, converting existing page tabs into real subroutes.

**Architecture:** A new `DashboardLayout` component (using the existing shadcn `sidebar.tsx`) wraps all host/admin routes as a React Router v6 layout route. A new `PublicLayout` wraps all existing public routes. Each former tab becomes a dedicated lazy-loaded page. `App.tsx` is restructured to use layout routes instead of a single Layout wrapper.

**Tech Stack:** React 18, react-router-dom v6, shadcn/ui sidebar, Tailwind CSS, TypeScript, Vitest, Vite

## Global Constraints

- All colours via semantic tokens (`bg-background`, `text-foreground`, etc.) — never hardcode HSL values
- Min tap target 44×44px on all interactive elements (`min-h-[44px]`)
- `isHost(roles)` returns true for admins too (see `src/lib/rbac.ts` — admin implies host)
- `isAdmin(roles)` checks for `"admin"` role only
- Never call `grant-host-role` edge function — use `approve-host-via-ticket` or `approve-host-application`
- Always `await rateLimit(...)` in edge functions (not modified in this plan)
- `__CACHE_BUST__` is a Vite-injected global — use same pattern as `Navbar.tsx`
- Run `npm run typecheck` after every task before committing

---

## File Map

**New files:**
```
src/
  components/
    PublicLayout.tsx          — Outlet wrapper for public Layout
    DashboardLayout.tsx       — sidebar shell (SidebarProvider + top bar + Outlet)
    AppSidebar.tsx            — role-aware sidebar nav
  pages/
    host/
      DashboardPage.tsx       — wraps HostDashboard
      CalendarPage.tsx        — wraps HostCalendar
      RequestsPage.tsx        — wraps LongTermRequestsInbox
      BlackoutsPage.tsx       — wraps BlackoutDateEditor
      BookingsPage.tsx        — wraps HostBookings
      VouchersPage.tsx        — wraps HostVouchers
      NewListingPage.tsx      — listing form extracted from Host.tsx
      ListingsPage.tsx        — MyListings extracted from Host.tsx
    admin/
      types.ts                — shared admin types + constants
      OverviewPage.tsx        — stats summary
      BookingsPage.tsx        — admin bookings list
      ApplicationsPage.tsx    — host applications + verification tickets
      TicketsPage.tsx         — all support tickets
      UsersPage.tsx           — user management
      AuditPage.tsx           — audit log
      DisbursementsPage.tsx   — AdminDisbursementPanel wrapper
```

**Modified files:**
```
src/
  App.tsx                     — layout routes restructure
  components/HostDashboard.tsx — replace onTabChange prop with useNavigate
  pages/Host.tsx              — becomes redirect component
  pages/Admin.tsx             — becomes redirect component
```

---

### Task 1: Create `PublicLayout`

**Files:**
- Create: `src/components/PublicLayout.tsx`

**Interfaces:**
- Produces: `PublicLayout` (no props) — React Router layout route component rendering `<Layout><Outlet /></Layout>`

- [ ] **Step 1: Create the file**

```tsx
// src/components/PublicLayout.tsx
import { Outlet } from "react-router-dom";
import { Layout } from "@/components/Layout";

export function PublicLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/PublicLayout.tsx
git commit -m "feat(layout): add PublicLayout outlet wrapper"
```

---

### Task 2: Create `AppSidebar`

**Files:**
- Create: `src/components/AppSidebar.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ roles: AppRole[] }`, `isHost`, `isAdmin` from `@/lib/rbac`
- Produces: `AppSidebar` (no props) — renders role-aware sidebar nav

- [ ] **Step 1: Create the file**

```tsx
// src/components/AppSidebar.tsx
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isHost, isAdmin } from "@/lib/rbac";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, CalendarDays, PlusCircle, List, BookOpen, Ticket,
  Wallet, Clock, Ban, Users, FileText, DollarSign, Bell, Headphones,
  ShoppingBag, ClipboardList, ShieldCheck,
} from "lucide-react";

const hostSections = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard",  to: "/host/dashboard", icon: LayoutDashboard },
      { label: "Calendar",   to: "/host/calendar",  icon: CalendarDays },
    ],
  },
  {
    group: "Listings",
    items: [
      { label: "New Listing", to: "/host/new-listing", icon: PlusCircle },
      { label: "My Listings", to: "/host/listings",    icon: List },
    ],
  },
  {
    group: "Bookings & Revenue",
    items: [
      { label: "Bookings",           to: "/host/bookings",  icon: BookOpen },
      { label: "Vouchers",           to: "/host/vouchers",  icon: Ticket },
      { label: "Wallet",             to: "/host/wallet",    icon: Wallet },
      { label: "Long-term Requests", to: "/host/requests",  icon: Clock },
      { label: "Blackout Dates",     to: "/host/blackouts", icon: Ban },
    ],
  },
];

const adminSections = [
  {
    group: "Admin",
    items: [
      { label: "Overview",        to: "/admin/overview",      icon: LayoutDashboard },
      { label: "Bookings",        to: "/admin/bookings",      icon: BookOpen },
      { label: "Applications",    to: "/admin/applications",  icon: ClipboardList },
      { label: "Support Tickets", to: "/admin/tickets",       icon: Headphones },
      { label: "Users",           to: "/admin/users",         icon: Users },
      { label: "Audit Log",       to: "/admin/audit",         icon: FileText },
      { label: "Disbursements",   to: "/admin/disbursements", icon: DollarSign },
    ],
  },
];

const accountItems = [
  { label: "My Bookings",   to: "/my-bookings",  icon: ShoppingBag },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Support",       to: "/support",       icon: Headphones },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors min-h-[44px] ${
    isActive
      ? "bg-secondary text-secondary-foreground font-medium"
      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
  }`;

export function AppSidebar() {
  const { roles } = useAuth();
  const admin = isAdmin(roles);
  const host = isHost(roles);

  const sections = [
    ...(admin ? adminSections : []),
    ...(host  ? hostSections  : []),
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link to="/">
          <img
            src={`/wordmark.png?v=${__CACHE_BUST__}`}
            alt="CheapStays"
            className="h-8 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.to} className={linkClass}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarMenu>
            {accountItems.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild>
                  <NavLink to={item.to} className={linkClass}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <p className="text-[10px] text-muted-foreground px-2">
          © {new Date().getFullYear()} CheapStays
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Declare `__CACHE_BUST__` global type if missing**

Check `src/vite-env.d.ts` — if `__CACHE_BUST__` is not declared there, add:
```ts
declare const __CACHE_BUST__: string;
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/AppSidebar.tsx src/vite-env.d.ts
git commit -m "feat(layout): add AppSidebar role-aware nav component"
```

---

### Task 3: Create `DashboardLayout`

**Files:**
- Create: `src/components/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `AppSidebar`, shadcn `SidebarProvider`/`SidebarInset`/`SidebarTrigger`, `useAuth()`
- Produces: `DashboardLayout({ requiredRole?: "host" | "admin" })` — layout route component

- [ ] **Step 1: Create the file**

```tsx
// src/components/DashboardLayout.tsx
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isHost, isAdmin } from "@/lib/rbac";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationsModal } from "@/components/NotificationsModal";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Props {
  requiredRole?: "host" | "admin";
}

export function DashboardLayout({ requiredRole }: Props) {
  const { user, roles, loading, signOut } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?mode=signin&next=${encodeURIComponent(pathname)}`} replace />;
  }

  if (requiredRole === "admin" && !isAdmin(roles)) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === "host" && !isHost(roles)) {
    return <Navigate to="/host/apply" replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px]" />
          <Link to="/" className="flex items-center">
            <img
              src={`/wordmark.png?v=${__CACHE_BUST__}`}
              alt="CheapStays"
              className="h-7 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `/favicon.png?v=${__CACHE_BUST__}`;
              }}
            />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsModal />
            <LanguageSwitcher />
            <ThemeToggle />
            <Button size="sm" variant="ghost" onClick={signOut} className="hidden sm:flex">
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardLayout.tsx
git commit -m "feat(layout): add DashboardLayout sidebar shell"
```

---

### Task 4: Restructure `App.tsx` routing

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PublicLayout`, `DashboardLayout`, all existing + new lazy page imports
- All existing public routes stay under `PublicLayout`; dashboard routes get `DashboardLayout`

- [ ] **Step 1: Add lazy imports and restructure routes**

Replace the entire contents of `src/App.tsx`:

```tsx
import { Suspense, lazy, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { PublicLayout } from "@/components/PublicLayout";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConsentGate } from "@/components/ConsentGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LegalDocumentPage } from "@/pages/legal/LegalDocumentPage";

// Public pages
const Index                      = lazy(() => import("./pages/Index"));
const NotFound                   = lazy(() => import("./pages/NotFound"));
const Auth                       = lazy(() => import("./pages/Auth"));
const Search                     = lazy(() => import("./pages/Search"));
const PopularCities              = lazy(() => import("./pages/PopularCities"));
const FeaturedStays              = lazy(() => import("./pages/FeaturedStays"));
const QuickStayVouchers          = lazy(() => import("./pages/QuickStayVouchers"));
const TypesOfStays               = lazy(() => import("./pages/TypesOfStays"));
const BecomePartnerPage          = lazy(() => import("./pages/BecomePartnerPage"));
const CustomerSupportPage        = lazy(() => import("./pages/CustomerSupportPage"));
const AboutPage                  = lazy(() => import("./pages/AboutPage"));
const Membership                 = lazy(() => import("./pages/Membership"));
const HostApply                  = lazy(() => import("./pages/HostApply"));
const Support                    = lazy(() => import("./pages/Support"));
const Notifications              = lazy(() => import("./pages/Notifications"));
const MyBookings                 = lazy(() => import("./pages/MyBookings"));
const LegalAcceptance            = lazy(() => import("./pages/LegalAcceptance"));
const BookingConfirmationSuccess = lazy(() => import("./pages/BookingConfirmationSuccess"));
const ListingDetail              = lazy(() => import("./pages/ListingDetail"));

// Host dashboard pages
const HostDashboardPage  = lazy(() => import("./pages/host/DashboardPage"));
const HostCalendarPage   = lazy(() => import("./pages/host/CalendarPage"));
const HostRequestsPage   = lazy(() => import("./pages/host/RequestsPage"));
const HostBlackoutsPage  = lazy(() => import("./pages/host/BlackoutsPage"));
const HostNewListingPage = lazy(() => import("./pages/host/NewListingPage"));
const HostListingsPage   = lazy(() => import("./pages/host/ListingsPage"));
const HostBookingsPage   = lazy(() => import("./pages/host/BookingsPage"));
const HostVouchersPage   = lazy(() => import("./pages/host/VouchersPage"));
const HostWalletPage     = lazy(() => import("./pages/host/WalletPage").then((m) => ({ default: m.HostWalletPage })));

// Admin dashboard pages
const AdminOverviewPage       = lazy(() => import("./pages/admin/OverviewPage"));
const AdminBookingsPage       = lazy(() => import("./pages/admin/BookingsPage"));
const AdminApplicationsPage   = lazy(() => import("./pages/admin/ApplicationsPage"));
const AdminTicketsPage        = lazy(() => import("./pages/admin/TicketsPage"));
const AdminUsersPage          = lazy(() => import("./pages/admin/UsersPage"));
const AdminAuditPage          = lazy(() => import("./pages/admin/AuditPage"));
const AdminDisbursementsPage  = lazy(() => import("./pages/admin/DisbursementsPage"));

const queryClient = new QueryClient();

const spinner = (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function RouteAwareErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RouteAwareErrorBoundary>
            <ConsentGate>
              <Suspense fallback={spinner}>
                <Routes>
                  {/* ── Public layout ── */}
                  <Route element={<PublicLayout />}>
                    <Route path="/"                  element={<Index />} />
                    <Route path="/auth"              element={<Auth />} />
                    <Route path="/search"            element={<Search />} />
                    <Route path="/popular-cities"    element={<PopularCities />} />
                    <Route path="/featured-stays"    element={<FeaturedStays />} />
                    <Route path="/vouchers"          element={<QuickStayVouchers />} />
                    <Route path="/types-of-stays"    element={<TypesOfStays />} />
                    <Route path="/become-a-partner"  element={<BecomePartnerPage />} />
                    <Route path="/customer-support"  element={<CustomerSupportPage />} />
                    <Route path="/about"             element={<AboutPage />} />
                    <Route path="/membership"        element={<Membership />} />
                    <Route path="/host"              element={<Navigate to="/host/apply" replace />} />
                    <Route path="/host/apply"        element={<HostApply />} />
                    <Route path="/support"           element={<Support />} />
                    <Route path="/my-bookings"       element={<MyBookings />} />
                    <Route path="/notifications"     element={<Notifications />} />
                    <Route path="/privacy"           element={<LegalDocumentPage docKey="privacy" />} />
                    <Route path="/terms"             element={<LegalDocumentPage docKey="terms" />} />
                    <Route path="/host-terms"        element={<LegalDocumentPage docKey="host-terms" />} />
                    <Route path="/renter-rules"      element={<LegalDocumentPage docKey="renter-rules" />} />
                    <Route path="/refunds"           element={<LegalDocumentPage docKey="refunds" />} />
                    <Route path="/safety"            element={<LegalDocumentPage docKey="safety" />} />
                    <Route path="/account-deletion"  element={<LegalDocumentPage docKey="account-deletion" />} />
                    <Route path="/legal"             element={<LegalDocumentPage docKey="legal" />} />
                    <Route path="/legal/accept"      element={<LegalAcceptance />} />
                    <Route path="/support-policy"    element={<LegalDocumentPage docKey="support" />} />
                    <Route path="/booking-success"   element={<BookingConfirmationSuccess />} />
                    <Route path="/listing/:id"       element={<ListingDetail />} />
                    <Route path="/listing/slug/:slug" element={<ListingDetail />} />
                  </Route>

                  {/* ── Host dashboard layout ── */}
                  <Route element={<DashboardLayout requiredRole="host" />}>
                    <Route path="/host/dashboard"   element={<HostDashboardPage />} />
                    <Route path="/host/calendar"    element={<HostCalendarPage />} />
                    <Route path="/host/requests"    element={<HostRequestsPage />} />
                    <Route path="/host/blackouts"   element={<HostBlackoutsPage />} />
                    <Route path="/host/new-listing" element={<HostNewListingPage />} />
                    <Route path="/host/listings"    element={<HostListingsPage />} />
                    <Route path="/host/bookings"    element={<HostBookingsPage />} />
                    <Route path="/host/vouchers"    element={<HostVouchersPage />} />
                    <Route path="/host/wallet"      element={<HostWalletPage />} />
                  </Route>

                  {/* ── Admin dashboard layout ── */}
                  <Route element={<DashboardLayout requiredRole="admin" />}>
                    <Route path="/admin"                 element={<Navigate to="/admin/overview" replace />} />
                    <Route path="/admin/overview"        element={<AdminOverviewPage />} />
                    <Route path="/admin/bookings"        element={<AdminBookingsPage />} />
                    <Route path="/admin/applications"    element={<AdminApplicationsPage />} />
                    <Route path="/admin/tickets"         element={<AdminTicketsPage />} />
                    <Route path="/admin/users"           element={<AdminUsersPage />} />
                    <Route path="/admin/audit"           element={<AdminAuditPage />} />
                    <Route path="/admin/disbursements"   element={<AdminDisbursementsPage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ConsentGate>
          </RouteAwareErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: errors for missing page files — that's fine, they'll be added in later tasks. Fix any *import* or *JSX* errors only.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): restructure App.tsx with layout routes for host/admin"
```

---

### Task 5: Update `HostDashboard` — replace `onTabChange` with `useNavigate`

**Files:**
- Modify: `src/components/HostDashboard.tsx`

The three `onClick={() => onTabChange("my")}` / `onTabChange("bookings")` calls become `navigate("/host/listings")` and `navigate("/host/bookings")`. The `onTabChange` prop is removed.

- [ ] **Step 1: Replace prop with navigate**

In `src/components/HostDashboard.tsx`:

Change the `Props` type and component signature:
```tsx
// BEFORE
type Props = { hostId: string; onTabChange: (tab: string) => void };
export function HostDashboard({ hostId, onTabChange }: Props) {
```
```tsx
// AFTER
import { useNavigate } from "react-router-dom";
type Props = { hostId: string };
export function HostDashboard({ hostId }: Props) {
  const navigate = useNavigate();
```

Replace all three `onTabChange` calls:
```tsx
// BEFORE
onClick={() => onTabChange("my")}
// AFTER
onClick={() => navigate("/host/listings")}

// BEFORE
onClick={() => onTabChange("bookings")}
// AFTER
onClick={() => navigate("/host/bookings")}
```
(There are two separate `onClick={() => onTabChange("bookings")}` calls — replace both.)

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors (the old `Host.tsx` call site `onTabChange={setActiveTab}` will error — ignore it until Task 8 converts Host.tsx)

- [ ] **Step 3: Commit**

```bash
git add src/components/HostDashboard.tsx
git commit -m "refactor(host): replace onTabChange prop with useNavigate in HostDashboard"
```

---

### Task 6: Create simple host sub-pages

**Files:**
- Create: `src/pages/host/DashboardPage.tsx`
- Create: `src/pages/host/CalendarPage.tsx`
- Create: `src/pages/host/RequestsPage.tsx`
- Create: `src/pages/host/BlackoutsPage.tsx`
- Create: `src/pages/host/BookingsPage.tsx`
- Create: `src/pages/host/VouchersPage.tsx`

Each is a thin wrapper around an existing component. Auth is already guaranteed by `DashboardLayout`.

- [ ] **Step 1: Create DashboardPage**

```tsx
// src/pages/host/DashboardPage.tsx
import { useAuth } from "@/hooks/useAuth";
import { HostDashboard } from "@/components/HostDashboard";
import { Seo } from "@/components/Seo";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Seo title="Dashboard · CheapStays Host" description="Your host dashboard." path="/host/dashboard" />
      <HostDashboard hostId={user.id} />
    </>
  );
}
```

- [ ] **Step 2: Create CalendarPage**

```tsx
// src/pages/host/CalendarPage.tsx
import { useAuth } from "@/hooks/useAuth";
import { HostCalendar } from "@/components/HostCalendar";
import { Seo } from "@/components/Seo";

export default function CalendarPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Seo title="Calendar · CheapStays Host" description="Manage your booking calendar." path="/host/calendar" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Calendar</h1>
      <HostCalendar hostId={user.id} />
    </>
  );
}
```

- [ ] **Step 3: Create RequestsPage**

```tsx
// src/pages/host/RequestsPage.tsx
import { useAuth } from "@/hooks/useAuth";
import { LongTermRequestsInbox } from "@/components/LongTermRequestsInbox";
import { Seo } from "@/components/Seo";

export default function RequestsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Seo title="Long-term Requests · CheapStays Host" description="Review long-term stay requests." path="/host/requests" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Long-term Requests</h1>
      <LongTermRequestsInbox hostId={user.id} />
    </>
  );
}
```

- [ ] **Step 4: Create BlackoutsPage**

```tsx
// src/pages/host/BlackoutsPage.tsx
import { useAuth } from "@/hooks/useAuth";
import { BlackoutDateEditor } from "@/components/BlackoutDateEditor";
import { Seo } from "@/components/Seo";

export default function BlackoutsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Seo title="Blackout Dates · CheapStays Host" description="Manage unavailable dates." path="/host/blackouts" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Blackout Dates</h1>
      <BlackoutDateEditor hostId={user.id} />
    </>
  );
}
```

- [ ] **Step 5: Create BookingsPage**

```tsx
// src/pages/host/BookingsPage.tsx
import { useAuth } from "@/hooks/useAuth";
import { HostBookings } from "@/components/HostBookings";
import { Seo } from "@/components/Seo";

export default function BookingsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Seo title="Bookings · CheapStays Host" description="Manage your bookings." path="/host/bookings" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Bookings</h1>
      <HostBookings hostId={user.id} />
    </>
  );
}
```

- [ ] **Step 6: Create VouchersPage**

```tsx
// src/pages/host/VouchersPage.tsx
import { useAuth } from "@/hooks/useAuth";
import { HostVouchers } from "@/components/HostVouchers";
import { Seo } from "@/components/Seo";

export default function VouchersPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Seo title="Vouchers · CheapStays Host" description="Manage your vouchers." path="/host/vouchers" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Vouchers</h1>
      <HostVouchers hostId={user.id} />
    </>
  );
}
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```
Expected: no errors for these files

- [ ] **Step 8: Commit**

```bash
git add src/pages/host/DashboardPage.tsx src/pages/host/CalendarPage.tsx \
        src/pages/host/RequestsPage.tsx src/pages/host/BlackoutsPage.tsx \
        src/pages/host/BookingsPage.tsx src/pages/host/VouchersPage.tsx
git commit -m "feat(host): add host dashboard sub-pages (wrapper components)"
```

---

### Task 7: Extract `NewListingPage` from `Host.tsx`

**Files:**
- Create: `src/pages/host/NewListingPage.tsx`

This extracts the listing form, AI description generator, `submitListing`, `generateDescription`, and the `ListingPublishGate` dialog from `Host.tsx`. The `slugify`, `LISTING_TYPES`, `STAY_CATEGORIES`, `AMENITY_OPTIONS`, `AMENITY_LABELS`, `inferLegacyType` constants also move here.

- [ ] **Step 1: Create the file**

```tsx
// src/pages/host/NewListingPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckSquare, Square } from "lucide-react";
import { Seo } from "@/components/Seo";
import { ImageUploader } from "@/components/ImageUploader";
import { VideoUploader } from "@/components/VideoUploader";
import { ListingPublishGate } from "@/components/ListingPublishGate";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { aiDescribeSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const STAY_CATEGORIES = [
  { value: "quick_stay",    label: "Quick Stay" },
  { value: "hourly_stay",   label: "Hourly Stay" },
  { value: "overnight_stay",label: "Overnight Stay" },
  { value: "hostel",        label: "Hostel" },
  { value: "private_pool",  label: "Private Pool" },
  { value: "condo",         label: "Condo" },
  { value: "apartment",     label: "Apartment" },
  { value: "hotel_room",    label: "Hotel Room" },
  { value: "motel_room",    label: "Motel Room" },
];

const AMENITY_OPTIONS = [
  "wifi","aircon","fan","kitchen","kitchenette","kitchen_shared",
  "hot_water","outdoor_shower","parking","pool","private_pool",
  "rooftop_pool","gym","work_desk","smart_tv","tv",
  "breakfast_included","pet_friendly","beach_access","hammock",
  "kayak","snorkel_gear","bike_rental","bbq_grill","fire_pit",
  "fireplace","garden","terrace","board_rack","electric_blankets",
];

const AMENITY_LABELS: Record<string, string> = {
  wifi:"WiFi",aircon:"Air conditioning",fan:"Fan",
  kitchen:"Full kitchen",kitchenette:"Kitchenette",kitchen_shared:"Shared kitchen",
  hot_water:"Hot water",outdoor_shower:"Outdoor shower",parking:"Parking",
  pool:"Pool",private_pool:"Private pool",rooftop_pool:"Rooftop pool",
  gym:"Gym",work_desk:"Work desk",smart_tv:"Smart TV",tv:"TV",
  breakfast_included:"Breakfast included",pet_friendly:"Pet friendly",
  beach_access:"Beach access",hammock:"Hammock",kayak:"Kayak",
  snorkel_gear:"Snorkel gear",bike_rental:"Bike rental",bbq_grill:"BBQ grill",
  fire_pit:"Fire pit",fireplace:"Fireplace",garden:"Garden",terrace:"Terrace",
  board_rack:"Board rack",electric_blankets:"Electric blankets",
};

function inferLegacyType(cat: string) {
  switch (cat) {
    case "hostel":      return "shared_room";
    case "hotel_room":
    case "motel_room":  return "private_room";
    case "private_pool":return "villa";
    case "hourly_stay":
    case "quick_stay":  return "glamping";
    default:            return "entire_place";
  }
}

function slugify(title: string, id: string) {
  return (
    title.toLowerCase().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").trim().slice(0,60) +
    "-" + id.slice(0,8)
  );
}

export default function NewListingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listingId, setListingId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({
    stay_availability_type: "overnight",
    stay_category: "overnight_stay",
    booking_mode: "instant",
    city: "", province: "", address: "",
    bedrooms: 1, bathrooms: 1, max_guests: 2,
    hourly_php: 0, price_3h: 0, price_6h: 0, price_12h: 0,
    overnight_php: 1500, nightly_php: 1500,
    promo_price: 0, min_nights: 1, description: "",
  });
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishGateOpen, setPublishGateOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  if (!user) return null;

  async function generateDescription() {
    const parsed = aiDescribeSchema.safeParse({
      title,
      bullets: bullets.split("\n").map((b) => b.trim()).filter(Boolean),
      tone: "confident",
    });
    if (!parsed.success) {
      toast({ title: "Add a title and at least one bullet", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-describe", { body: parsed.data });
      if (error) throw error;
      const desc = data?.description ?? "";
      setAiOut(desc);
      setForm((f) => ({ ...f, description: desc }));
    } catch (err) {
      toast({ title: "AI error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function toggleAmenity(a: string) {
    setSelectedAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function submitListing(isDraft: boolean) {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!form.city.trim() || !form.province.trim()) { toast({ title: "City and province are required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const slug = slugify(title, listingId);
      const { error } = await supabase.from("listings").upsert({
        id: listingId, slug, host_id: user.id,
        title: title.trim(), description: form.description.trim(),
        type: inferLegacyType(form.stay_category) as never,
        stay_availability_type: form.stay_availability_type,
        stay_category: form.stay_category, booking_mode: form.booking_mode,
        city: form.city.trim(), province: form.province.trim(),
        address: form.address.trim() || null,
        bedrooms: form.bedrooms, bathrooms: form.bathrooms, max_guests: form.max_guests,
        hourly_php: form.hourly_php || null, price_3h: form.price_3h || null,
        price_6h: form.price_6h || null, price_12h: form.price_12h || null,
        overnight_php: form.overnight_php || null,
        promo_price: form.promo_price || null,
        nightly_php: form.overnight_php,
        min_nights: form.min_nights, amenities: selectedAmenities,
        images, video_url: videoUrl, status: "draft",
      }, { onConflict: "id" });
      if (error) throw error;
      if (isDraft) {
        toast({ title: "Saved as draft", description: "You can publish it anytime from My Listings." });
      } else {
        setPublishingId(listingId);
        setPublishGateOpen(true);
      }
    } catch (err) {
      toast({ title: "Failed to save listing", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizePublish() {
    if (!publishingId) return;
    const { error } = await supabase.from("listings")
      .update({ status: "active", images, video_url: videoUrl })
      .eq("id", publishingId);
    if (error) {
      toast({ title: "Cannot publish", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Listing published!", description: "Your listing is now live." });
    setPublishGateOpen(false);
    setPublishingId(null);
    setListingId(crypto.randomUUID());
    navigate(`/listing/${publishingId}`);
  }

  return (
    <>
      <Seo title="New Listing · CheapStays Host" description="Create a new listing." path="/host/new-listing" />
      <div className="max-w-3xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">New listing</h1>

        {/* AI description generator */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-medium">AI description generator</h2>
            <Badge variant="secondary" className="text-[10px]">Optional</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Paste your listing's facts and we'll write a clean, honest description.</p>
          <div className="space-y-2">
            <Label>Listing title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cozy 1BR Condo in Cubao, Quezon City" />
          </div>
          <div className="space-y-2">
            <Label>Bullet points (one per line)</Label>
            <Textarea rows={5} value={bullets} onChange={(e) => setBullets(e.target.value)} placeholder={"40m² · 1 bed\nQuezon City · near MRT\nFast WiFi"} />
          </div>
          <Button onClick={generateDescription} disabled={aiLoading} variant="secondary">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {aiLoading ? "Writing…" : "Generate description"}
          </Button>
          {aiOut && (
            <div className="mt-2 border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">Generated — copied into description field below:</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiOut}</p>
            </div>
          )}
        </Card>

        {/* Listing form */}
        <Card className="p-6 space-y-6">
          <h2 className="font-medium text-lg">Listing details</h2>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cozy 1BR Condo in Cubao, Quezon City" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City *</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Quezon City" />
            </div>
            <div className="space-y-2">
              <Label>Province / Region *</Label>
              <Input value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} placeholder="NCR" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address <span className="text-muted-foreground text-xs">(optional — shown after booking)</span></Label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Unit 12, Tower A, Example St." />
          </div>

          <div className="space-y-2">
            <Label>Stay Category</Label>
            <div className="flex flex-wrap gap-2">
              {STAY_CATEGORIES.map((t) => (
                <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, stay_category: t.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.stay_category === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Availability Type</Label>
            <div className="flex flex-wrap gap-2">
              {[{value:"overnight",label:"Overnight stays only"},{value:"hourly",label:"Hourly stays only"},{value:"both",label:"Both overnight & hourly"}].map((t) => (
                <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, stay_availability_type: t.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.stay_availability_type === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Booking Mode</Label>
            <div className="flex flex-wrap gap-2">
              {[{value:"instant",label:"Instant Book"},{value:"manual_review",label:"Manual Review"},{value:"voucher",label:"Voucher / Open Date"}].map((t) => (
                <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, booking_mode: t.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.booking_mode === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Bedrooms</Label><Input type="number" min={0} max={20} value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: Number(e.target.value) }))} /></div>
            <div className="space-y-2"><Label>Bathrooms</Label><Input type="number" min={1} max={20} step={0.5} value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: Number(e.target.value) }))} /></div>
            <div className="space-y-2"><Label>Max guests</Label><Input type="number" min={1} max={50} value={form.max_guests} onChange={(e) => setForm((f) => ({ ...f, max_guests: Number(e.target.value) }))} /></div>
          </div>

          <div className="space-y-2">
            <Label>Promo price (₱) <span className="text-muted-foreground text-xs">(optional slash price)</span></Label>
            <Input type="number" min={0} step={50} value={form.promo_price || ""} onChange={(e) => setForm((f) => ({ ...f, promo_price: Number(e.target.value) }))} />
          </div>

          {(form.stay_availability_type === "overnight" || form.stay_availability_type === "both") && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/60">
              <div className="space-y-2"><Label>Overnight price (₱)</Label><Input type="number" min={100} step={50} value={form.overnight_php} onChange={(e) => setForm((f) => ({ ...f, overnight_php: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Minimum nights</Label><Input type="number" min={1} max={30} value={form.min_nights} onChange={(e) => setForm((f) => ({ ...f, min_nights: Number(e.target.value) }))} /></div>
            </div>
          )}

          {(form.stay_availability_type === "hourly" || form.stay_availability_type === "both") && (
            <div className="space-y-4 pt-2 border-t border-border/60">
              <h3 className="font-medium text-sm">Hourly Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Base Hourly Rate (₱)</Label><Input type="number" min={0} step={50} value={form.hourly_php || ""} onChange={(e) => setForm((f) => ({ ...f, hourly_php: Number(e.target.value) }))} /></div>
                <div className="space-y-2"><Label>3-Hour Block (₱)</Label><Input type="number" min={0} step={50} value={form.price_3h || ""} onChange={(e) => setForm((f) => ({ ...f, price_3h: Number(e.target.value) }))} /></div>
                <div className="space-y-2"><Label>6-Hour Block (₱)</Label><Input type="number" min={0} step={50} value={form.price_6h || ""} onChange={(e) => setForm((f) => ({ ...f, price_6h: Number(e.target.value) }))} /></div>
                <div className="space-y-2"><Label>12-Hour Block (₱)</Label><Input type="number" min={0} step={50} value={form.price_12h || ""} onChange={(e) => setForm((f) => ({ ...f, price_12h: Number(e.target.value) }))} /></div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={6} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe your place…" />
            <p className="text-xs text-muted-foreground">Use the AI generator above to write this for you.</p>
          </div>

          <div className="space-y-3">
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AMENITY_OPTIONS.map((a) => {
                const checked = selectedAmenities.includes(a);
                return (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors text-left ${checked ? "border-primary/60 bg-primary/5 text-foreground" : "border-border/50 hover:border-foreground/20 text-muted-foreground"}`}>
                    {checked ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                    {AMENITY_LABELS[a] ?? a}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/60">
            <div>
              <Label>Photos <span className="text-muted-foreground text-xs">(up to 10)</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5">Upload photos now or add them later from My Listings.</p>
            </div>
            <ImageUploader userId={user.id} listingId={listingId} value={images} onChange={setImages} onUploadingChange={setImagesUploading} maxFiles={10} />
          </div>

          <div className="space-y-3 pt-2 border-t border-border/60">
            <div>
              <Label>Video tour <span className="text-muted-foreground text-xs">(optional · max 30 s)</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5">A short walkthrough video significantly increases bookings.</p>
            </div>
            <VideoUploader userId={user.id} listingId={listingId} value={videoUrl} onChange={setVideoUrl} />
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-border/60">
            <Button onClick={() => submitListing(false)} disabled={submitting || imagesUploading} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {imagesUploading ? "Uploading photos…" : "Publish listing"}
            </Button>
            <Button variant="outline" onClick={() => submitListing(true)} disabled={submitting || imagesUploading}>
              Save as draft
            </Button>
          </div>
        </Card>
      </div>

      {publishingId && (
        <Dialog open={publishGateOpen} onOpenChange={setPublishGateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Finish setup before publishing</DialogTitle>
              <DialogDescription>
                Your listing was saved as a draft. Complete every requirement below to publish it.
              </DialogDescription>
            </DialogHeader>
            <ListingPublishGate listingId={publishingId} userId={user.id} onAllPassed={finalizePublish} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/host/NewListingPage.tsx
git commit -m "feat(host): extract NewListingPage from Host.tsx"
```

---

### Task 8: Extract `ListingsPage` from `Host.tsx`

**Files:**
- Create: `src/pages/host/ListingsPage.tsx`

Extract the `MyListings` function from `Host.tsx` (lines 105–290) as the default export.

- [ ] **Step 1: Create the file**

```tsx
// src/pages/host/ListingsPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ImageUploader } from "@/components/ImageUploader";
import { VideoUploader } from "@/components/VideoUploader";
import { Seo } from "@/components/Seo";

type ExistingListing = {
  id: string; title: string; status: string; images: string[]; video_url: string | null;
};

export default function ListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<ExistingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    supabase.from("listings").select("id,title,status,images,video_url")
      .eq("host_id", userId).order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setListings((data ?? []) as ExistingListing[]);
        setLoading(false);
      });
  }, [userId]);

  async function saveMedia(id: string, images: string[], video_url: string | null) {
    if (!userId) return;
    setSaving(id);
    const { data, error: err } = await supabase.from("listings")
      .update({ images, video_url }).eq("id", id).eq("host_id", userId)
      .select("id, images, video_url");
    setSaving(null);
    if (err) { toast({ title: "Save failed", description: err.message, variant: "destructive" }); return; }
    if (!data || data.length === 0) {
      toast({ title: "Nothing was saved", description: "The listing couldn't be updated — you may not own it or a permission rule blocked the change.", variant: "destructive" });
      return;
    }
    const saved = data[0] as { images: string[] | null; video_url: string | null };
    toast({ title: "Media saved" });
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, images: saved.images ?? [], video_url: saved.video_url ?? null } : l));
  }

  async function deleteListing(id: string) {
    if (!userId) return;
    setDeleting(id);
    const { error: err } = await supabase.from("listings").delete().eq("id", id).eq("host_id", userId);
    if (err?.code === "23503") {
      const { error: deactivateError } = await supabase.from("listings")
        .update({ status: "inactive" }).eq("id", id).eq("host_id", userId);
      setDeleting(null); setConfirmDelete(null);
      if (deactivateError) { toast({ title: "Delete failed", description: deactivateError.message, variant: "destructive" }); return; }
      toast({ title: "Listing deactivated", description: "This listing has booking history, so it was deactivated instead of deleted." });
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status: "inactive" } : l));
      return;
    }
    setDeleting(null); setConfirmDelete(null);
    if (err) { toast({ title: "Delete failed", description: err.message, variant: "destructive" }); return; }
    toast({ title: "Listing deleted" });
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  if (!userId) return null;

  return (
    <>
      <Seo title="My Listings · CheapStays Host" description="Manage your listings." path="/host/listings" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">My Listings</h1>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {error && <div className="text-center py-12 text-destructive">Failed to load listings: {error}</div>}
      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No listings yet.</p>
          <Link to="/host/new-listing" className="mt-4 inline-block text-sm underline underline-offset-4">Create your first listing</Link>
        </div>
      )}

      <div className="space-y-6">
        {listings.map((listing) => (
          <Card key={listing.id} className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{listing.title}</p>
                <Badge variant={listing.status === "active" ? "default" : "secondary"} className="text-[10px] mt-1">{listing.status}</Badge>
              </div>
              <Link to={`/listing/${listing.id}`} className="text-xs text-muted-foreground hover:text-foreground underline">View listing</Link>
            </div>

            <div className="space-y-2">
              <Label>Photos (max 10)</Label>
              <ImageUploader userId={userId} listingId={listing.id} value={listing.images ?? []}
                onChange={(imgs) => setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, images: imgs } : l))}
                onUploadingChange={(up) => setUploadingId(up ? listing.id : null)} maxFiles={10} />
            </div>

            <div className="space-y-2">
              <Label>Video tour <span className="text-muted-foreground text-xs">(max 30 s)</span></Label>
              <VideoUploader userId={userId} listingId={listing.id} value={listing.video_url ?? null}
                onChange={(url) => setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, video_url: url } : l))} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" disabled={saving === listing.id || uploadingId === listing.id}
                onClick={() => saveMedia(listing.id, listing.images ?? [], listing.video_url ?? null)}>
                {saving === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                {uploadingId === listing.id ? "Uploading…" : "Save media"}
              </Button>
              {confirmDelete === listing.id ? (
                <>
                  <Button size="sm" variant="destructive" disabled={deleting === listing.id} onClick={() => deleteListing(listing.id)}>
                    {deleting === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                    Confirm delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(listing.id)}>
                  Delete listing
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/host/ListingsPage.tsx
git commit -m "feat(host): extract ListingsPage from Host.tsx"
```

---

### Task 9: Convert `Host.tsx` to redirect and `Admin.tsx` to redirect

**Files:**
- Modify: `src/pages/Host.tsx`
- Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: Convert Host.tsx to redirect**

Replace the entire contents of `src/pages/Host.tsx`:

```tsx
// src/pages/Host.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isHost } from "@/lib/rbac";
import { Loader2 } from "lucide-react";

export default function Host() {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isHost(roles)) return <Navigate to="/host/dashboard" replace />;
  return <Navigate to="/host/apply" replace />;
}
```

- [ ] **Step 2: Convert Admin.tsx to redirect**

Replace the entire contents of `src/pages/Admin.tsx`:

```tsx
// src/pages/Admin.tsx
import { Navigate } from "react-router-dom";

export default function Admin() {
  return <Navigate to="/admin/overview" replace />;
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/Host.tsx src/pages/Admin.tsx
git commit -m "refactor: convert Host and Admin pages to redirect components"
```

---

### Task 10: Create shared admin types file

**Files:**
- Create: `src/pages/admin/types.ts`

- [ ] **Step 1: Create types and shared constants**

```ts
// src/pages/admin/types.ts
import type { AppRole } from "@/lib/rbac";

export type Booking = {
  id: string; listing_id: string; guest_id: string; host_id: string;
  check_in: string; check_out: string; status: string; total_php: number; created_at: string;
};

export type SupportTicket = {
  id: string; ticket_num: number; subject: string; status: string;
  priority: string; category: string; escalated: boolean; created_at: string; user_id: string;
};

export type TicketMessage = { id: string; sender: string; content: string; created_at: string };
export type TicketStatus  = "open" | "pending" | "resolved" | "closed" | "escalated";
export type UserRoleRow   = { id: string; user_id: string; role: AppRole };
export type ProfileRow    = { user_id: string; display_name: string | null };
export type AuditRow      = {
  id: string; command_id: string; command_source: string;
  operation: string; target_user_id: string; reason_code: string;
  before_state: Record<string, unknown>; after_state: Record<string, unknown>;
  executed_by: string | null; created_at: string;
};
export type UserView = { userId: string; displayName: string; initials: string; roles: AppRole[] };
export type HostApp = {
  id: string; user_id: string; full_legal_name: string; phone: string;
  property_type: string; city: string; province: string; property_description: string;
  id_type: string; id_front_path: string | null; selfie_path: string | null;
  status: string; created_at: string;
};

export const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500", pending: "bg-amber-400",
  cancelled: "bg-red-400", completed: "bg-blue-400", no_show: "bg-gray-400",
};

export const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive", high: "secondary", normal: "outline", low: "outline",
};

export const TICKET_STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed", "escalated"];

export const SENDER_LABEL: Record<string, string> = {
  user: "User", admin: "Admin", ai: "AI Assistant", system: "System",
};

export function buildUserViews(roles: UserRoleRow[], profiles: ProfileRow[]): UserView[] {
  const roleMap = new Map<string, Set<AppRole>>();
  for (const row of roles) {
    if (!roleMap.has(row.user_id)) roleMap.set(row.user_id, new Set());
    roleMap.get(row.user_id)?.add(row.role);
  }
  return profiles.map((p) => {
    const assigned = Array.from(roleMap.get(p.user_id) ?? new Set<AppRole>(["user"]));
    const label    = p.display_name?.trim() || p.user_id.slice(0, 8);
    const initials = label.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
    return { userId: p.user_id, displayName: label, initials, roles: assigned as AppRole[] };
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/types.ts
git commit -m "feat(admin): add shared admin types and utilities"
```

---

### Task 11: Create admin sub-pages — simple ones

**Files:**
- Create: `src/pages/admin/OverviewPage.tsx`
- Create: `src/pages/admin/BookingsPage.tsx`
- Create: `src/pages/admin/UsersPage.tsx`
- Create: `src/pages/admin/AuditPage.tsx`
- Create: `src/pages/admin/DisbursementsPage.tsx`

- [ ] **Step 1: Create OverviewPage**

```tsx
// src/pages/admin/OverviewPage.tsx
import { useCallback, useEffect, useState } from "react";
import { format, eachDayOfInterval, parseISO, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { Booking } from "./types";
import { STATUS_COLORS } from "./types";

function BookingCalendar({ bookings }: { bookings: Booking[] }) {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-medium text-sm">{format(month, "MMMM yyyy")}</span>
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{status}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>)}
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map((day) => {
          const bks = bookings.filter((b) => { const ci = parseISO(b.check_in); const co = parseISO(b.check_out); return day >= ci && day < co; });
          return (
            <div key={day.toISOString()} className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs">
              <span className={`text-[10px] font-medium ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {bks.slice(0, 3).map((b) => <span key={b.id} className={`block h-1.5 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />)}
                {bks.length > 3 && <span className="text-[9px] text-muted-foreground">+{bks.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [bookRes, ticketRes, appsRes] = await Promise.all([
      supabase.from("bookings").select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at").order("check_in", { ascending: false }).limit(300),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "escalated"]),
      supabase.from("host_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "manual_review"]),
    ]);
    setBookings((bookRes.data ?? []) as Booking[]);
    setOpenTickets(ticketRes.count ?? 0);
    setPendingApps(appsRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeBookings = bookings.filter((b) => b.status === "confirmed").length;

  return (
    <>
      <Seo title="Admin Overview · CheapStays" description="Admin overview." path="/admin/overview" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Overview</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-muted-foreground">Active bookings</p><p className="text-2xl font-semibold mt-1">{activeBookings}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Open tickets</p><p className="text-2xl font-semibold mt-1">{openTickets}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Pending applications</p><p className="text-2xl font-semibold mt-1">{pendingApps}</p></Card>
          </div>
          <Card className="p-5"><BookingCalendar bookings={bookings} /></Card>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create BookingsPage**

```tsx
// src/pages/admin/BookingsPage.tsx
import { useCallback, useEffect, useState } from "react";
import { format, eachDayOfInterval, parseISO, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { Booking } from "./types";
import { STATUS_COLORS } from "./types";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());

  const load = useCallback(async () => {
    const { data } = await supabase.from("bookings")
      .select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at")
      .order("check_in", { ascending: false }).limit(300);
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();

  const monthBookings = bookings.filter((b) => {
    const ci = parseISO(b.check_in);
    return ci >= startOfMonth(month) && ci <= endOfMonth(month);
  }).sort((a, b) => a.check_in.localeCompare(b.check_in));

  return (
    <>
      <Seo title="Bookings · CheapStays Admin" description="All bookings." path="/admin/bookings" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Bookings</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-medium text-sm">{format(month, "MMMM yyyy")}</span>
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{status}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>)}
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {days.map((day) => {
              const bks = bookings.filter((b) => { const ci = parseISO(b.check_in); const co = parseISO(b.check_out); return day >= ci && day < co; });
              return (
                <div key={day.toISOString()} className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs">
                  <span className={`text-[10px] font-medium ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</span>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {bks.slice(0, 3).map((b) => <span key={b.id} className={`block h-1.5 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} title={`${b.status} · ₱${b.total_php}`} />)}
                    {bks.length > 3 && <span className="text-[9px] text-muted-foreground">+{bks.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This month</p>
            {monthBookings.length === 0 && <p className="text-sm text-muted-foreground py-2">No bookings this month.</p>}
            {monthBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />
                  <span>{format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{b.status}</Badge>
                  <span className="text-muted-foreground text-xs">₱{b.total_php.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Create UsersPage**

```tsx
// src/pages/admin/UsersPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { UserRoleRow, ProfileRow } from "./types";
import { buildUserViews } from "./types";

export default function UsersPage() {
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [rolesRes, profilesRes] = await Promise.all([
      supabase.from("user_roles").select("id,user_id,role").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,display_name").limit(200),
    ]);
    setUserRoles((rolesRes.data ?? []) as UserRoleRow[]);
    setProfiles((profilesRes.data ?? []) as ProfileRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const users = useMemo(() => buildUserViews(userRoles, profiles), [userRoles, profiles]);
  const filtered = useMemo(() =>
    search.trim() ? users.filter((u) => u.displayName.toLowerCase().includes(search.toLowerCase()) || u.userId.includes(search)) : users,
    [users, search]);

  return (
    <>
      <Seo title="Users · CheapStays Admin" description="User management." path="/admin/users" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Users</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          <Input placeholder="Search by name or user ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm h-8 text-sm" />
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6">No users found.</p> : (
            <div className="grid gap-2">
              {filtered.map((u) => (
                <Card key={u.userId} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{u.initials}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium text-sm">{u.displayName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{u.userId.slice(0, 16)}…</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : r === "host" ? "secondary" : "outline"} className="text-[10px] capitalize">{r}</Badge>)}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Create AuditPage**

```tsx
// src/pages/admin/AuditPage.tsx
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { AuditRow } from "./types";

export default function AuditPage() {
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("role_mutation_audit")
      .select("id,command_id,command_source,operation,target_user_id,reason_code,before_state,after_state,executed_by,created_at")
      .order("created_at", { ascending: false }).limit(100);
    setAuditLog((data as unknown as AuditRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Seo title="Audit Log · CheapStays Admin" description="Role mutation audit log." path="/admin/audit" />
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Audit Log</h1>
      <p className="text-sm text-muted-foreground mb-6">Immutable record of all privileged role mutations.</p>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-2">
          {auditLog.length === 0 && <p className="text-sm text-muted-foreground">No audit records yet.</p>}
          {auditLog.map((r) => (
            <Card key={r.id} className="p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium capitalize">{r.operation.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="text-muted-foreground">Target: <span className="font-mono">{r.target_user_id.slice(0, 12)}…</span></p>
              <p className="text-muted-foreground">Reason: {r.reason_code}</p>
              <p className="text-muted-foreground">Source: {r.command_source}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Create DisbursementsPage**

```tsx
// src/pages/admin/DisbursementsPage.tsx
import { AdminDisbursementPanel } from "@/components/wallet/AdminDisbursementPanel";
import { Seo } from "@/components/Seo";

export default function DisbursementsPage() {
  return (
    <>
      <Seo title="Disbursements · CheapStays Admin" description="Manage host disbursements." path="/admin/disbursements" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Disbursements</h1>
      <AdminDisbursementPanel />
    </>
  );
}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/OverviewPage.tsx src/pages/admin/BookingsPage.tsx \
        src/pages/admin/UsersPage.tsx src/pages/admin/AuditPage.tsx \
        src/pages/admin/DisbursementsPage.tsx
git commit -m "feat(admin): add Overview, Bookings, Users, Audit, Disbursements pages"
```

---

### Task 12: Create `ApplicationsPage` and `TicketsPage`

**Files:**
- Create: `src/pages/admin/ApplicationsPage.tsx`
- Create: `src/pages/admin/TicketsPage.tsx`

These two pages have the most complex extracted logic: ticket expansion, reply sending, host approval, status updates.

- [ ] **Step 1: Create ApplicationsPage**

```tsx
// src/pages/admin/ApplicationsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HostApplicationReview } from "@/features/admin/HostApplicationReview";
import { submitHostApplicationDecision } from "@/features/admin/adminHostApproval.service";
import { Seo } from "@/components/Seo";
import type { SupportTicket, TicketMessage, HostApp } from "./types";

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [hostApps, setHostApps] = useState<HostApp[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [busy, setBusy] = useState(false);
  const [grantingHost, setGrantingHost] = useState<string | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Map<string, TicketMessage[]>>(new Map());
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [appsRes, ticketRes] = await Promise.all([
      supabase.from("host_applications")
        .select("id,user_id,full_legal_name,phone,property_type,city,province,property_description,id_type,id_front_path,selfie_path,status,created_at")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("support_tickets")
        .select("id,ticket_num,subject,status,priority,category,escalated,created_at,user_id")
        .eq("category", "host_verification").order("created_at", { ascending: false }).limit(100),
    ]);
    setHostApps((appsRes.data as HostApp[]) ?? []);
    setTickets((ticketRes.data as SupportTicket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingVerificationTickets = useMemo(() =>
    tickets.filter((t) => t.status !== "resolved" && t.status !== "closed"),
    [tickets]);

  const expandTicket = useCallback(async (ticketId: string) => {
    if (expandedTicketId === ticketId) { setExpandedTicketId(null); return; }
    setExpandedTicketId(ticketId);
    if (!ticketMessages.has(ticketId)) {
      setLoadingMessages(true);
      const { data } = await supabase.from("support_messages")
        .select("id,sender,content,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (data) setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
      setLoadingMessages(false);
    }
  }, [expandedTicketId, ticketMessages]);

  const updateTicketStatus = async (ticketId: string, status: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
      if (error) throw error;
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
    } catch { toast.error("Could not update ticket status."); }
    finally { setBusy(false); }
  };

  const grantHostRole = async (ticketId: string) => {
    setGrantingHost(ticketId);
    try {
      const { data, error } = await supabase.functions.invoke("approve-host-via-ticket", { body: { ticket_id: ticketId } });
      if (error) {
        let msg = error.message;
        try { const body = await (error as { context?: Response }).context?.json() as { error?: string } | undefined; if (body?.error) msg = body.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: "resolved" } : t));
      toast.success(data?.already_host ? "User already a host — ticket resolved." : "Host approved and ticket resolved.");
    } catch (err) { toast.error(`Approval failed: ${(err as Error).message}`); }
    finally { setGrantingHost(null); }
  };

  const handleAppDecision = async (appId: string, userId: string, approve: boolean, reason?: string) => {
    setBusy(true);
    try {
      await submitHostApplicationDecision({ applicationId: appId, targetUserId: userId, reviewerId: user?.id, approve, reason });
      await load();
      toast.success(approve ? "Application approved and host status confirmed." : "Application rejected.");
    } catch (err) { toast.error(`Failed: ${(err as Error).message}`); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Seo title="Applications · CheapStays Admin" description="Host application review." path="/admin/applications" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Applications</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-8">
          {pendingVerificationTickets.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Verification requests <span className="text-muted-foreground font-normal ml-2 text-sm">via Support chat</span></h2>
              {pendingVerificationTickets.map((t) => {
                const isExpanded = expandedTicketId === t.id;
                const messages = ticketMessages.get(t.id) ?? [];
                return (
                  <Card key={t.id} className="overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">#{t.ticket_num}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">Host Verification</Badge>
                        </div>
                        <p className="font-medium text-sm">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => expandTicket(t.id)}>{isExpanded ? "Hide" : "View details"}</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateTicketStatus(t.id, "closed")} disabled={busy}>Dismiss</Button>
                        <Button size="sm" className="h-8 text-xs" onClick={() => grantHostRole(t.id)} disabled={grantingHost === t.id}>
                          {grantingHost === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Approve as Host
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-2">
                        {loadingMessages && !ticketMessages.has(t.id) ? (
                          <p className="text-xs text-muted-foreground">Loading messages…</p>
                        ) : messages.filter((m) => m.sender === "user").length === 0 ? (
                          <p className="text-xs text-muted-foreground">No applicant messages found.</p>
                        ) : (
                          messages.filter((m) => m.sender === "user").map((msg) => (
                            <div key={msg.id} className="text-sm bg-muted rounded-lg px-3 py-2 whitespace-pre-wrap">{msg.content}</div>
                          ))
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
          <HostApplicationReview hostApps={hostApps} onDecision={handleAppDecision} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create TicketsPage**

```tsx
// src/pages/admin/TicketsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import type { SupportTicket, TicketMessage, TicketStatus } from "./types";
import { PRIORITY_VARIANT, TICKET_STATUSES, SENDER_LABEL } from "./types";

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [busy, setBusy] = useState(false);
  const [grantingHost, setGrantingHost] = useState<string | null>(null);
  const [ticketFilter, setTicketFilter] = useState("all");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Map<string, TicketMessage[]>>(new Map());
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyInputs, setReplyInputs] = useState<Map<string, string>>(new Map());
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("support_tickets")
      .select("id,ticket_num,subject,status,priority,category,escalated,created_at,user_id")
      .order("created_at", { ascending: false }).limit(200);
    setTickets((data as SupportTicket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    openTickets: tickets.filter((t) => t.status === "open" && !t.escalated).length,
    escalated: tickets.filter((t) => t.escalated).length,
  }), [tickets]);

  const filtered = useMemo(() =>
    tickets.filter((t) =>
      ticketFilter === "all" ? true : ticketFilter === "escalated" ? t.escalated : t.status === ticketFilter),
    [tickets, ticketFilter]);

  const expandTicket = useCallback(async (ticketId: string) => {
    if (expandedTicketId === ticketId) { setExpandedTicketId(null); return; }
    setExpandedTicketId(ticketId);
    if (!ticketMessages.has(ticketId)) {
      setLoadingMessages(true);
      const { data } = await supabase.from("support_messages")
        .select("id,sender,content,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (data) setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
      setLoadingMessages(false);
    }
  }, [expandedTicketId, ticketMessages]);

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
      if (error) throw error;
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
    } catch { toast.error("Could not update ticket status."); }
    finally { setBusy(false); }
  };

  const grantHostRole = async (ticketId: string) => {
    setGrantingHost(ticketId);
    try {
      const { data, error } = await supabase.functions.invoke("approve-host-via-ticket", { body: { ticket_id: ticketId } });
      if (error) {
        let msg = error.message;
        try { const body = await (error as { context?: Response }).context?.json() as { error?: string } | undefined; if (body?.error) msg = body.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: "resolved" } : t));
      toast.success(data?.already_host ? "User already a host — ticket resolved." : "Host approved and ticket resolved.");
    } catch (err) { toast.error(`Approval failed: ${(err as Error).message}`); }
    finally { setGrantingHost(null); }
  };

  const sendAdminReply = async (ticketId: string) => {
    const content = replyInputs.get(ticketId)?.trim();
    if (!content) return;
    setSendingReply(ticketId);
    try {
      const { error } = await supabase.from("support_messages").insert({ ticket_id: ticketId, sender: "admin", author_user_id: user?.id, content });
      if (error) throw error;
      setReplyInputs((prev) => { const next = new Map(prev); next.set(ticketId, ""); return next; });
      const { data } = await supabase.from("support_messages").select("id,sender,content,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (data) setTicketMessages((prev) => new Map(prev).set(ticketId, data as TicketMessage[]));
      toast.success("Reply sent.");
    } catch { toast.error("Could not send reply."); }
    finally { setSendingReply(null); }
  };

  return (
    <>
      <Seo title="Support Tickets · CheapStays Admin" description="Manage support tickets." path="/admin/tickets" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Support Tickets</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["all", "open", "pending", "escalated", "resolved", "closed"] as const).map((f) => (
              <Button key={f} size="sm" variant={ticketFilter === f ? "default" : "outline"}
                onClick={() => setTicketFilter(f)} className="capitalize h-7 text-xs">
                {f}
                {f === "open"      && stats.openTickets > 0 && ` (${stats.openTickets})`}
                {f === "escalated" && stats.escalated > 0   && ` (${stats.escalated})`}
              </Button>
            ))}
          </div>
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6">No tickets matching this filter.</p> : (
            <div className="space-y-2">
              {filtered.map((t) => {
                const isExpanded = expandedTicketId === t.id;
                const messages   = ticketMessages.get(t.id) ?? [];
                return (
                  <Card key={t.id} className={`overflow-hidden ${t.escalated ? "border-destructive/40" : ""}`}>
                    <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => expandTicket(t.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="font-mono text-xs text-muted-foreground">#{t.ticket_num}</span>
                          {t.escalated && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Escalated</Badge>}
                          {t.priority && t.priority !== "normal" && <Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"} className="text-[10px] h-4 px-1.5 capitalize">{t.priority}</Badge>}
                          {t.category && <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{t.category.replace(/_/g, " ")}</Badge>}
                        </div>
                        <p className="font-medium text-sm">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Select value={t.status} onValueChange={(val) => updateTicketStatus(t.id, val as TicketStatus)} disabled={busy}>
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}</SelectContent>
                        </Select>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-3">
                        {loadingMessages && !ticketMessages.has(t.id) ? (
                          <p className="text-xs text-muted-foreground">Loading messages…</p>
                        ) : messages.length === 0 ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> No messages yet.</p>
                        ) : (
                          messages.map((msg) => (
                            <div key={msg.id} className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${msg.sender === "user" ? "bg-muted ml-0" : msg.sender === "admin" ? "bg-primary/10 ml-auto text-right" : msg.sender === "ai" ? "bg-secondary/40 mx-auto text-center" : "bg-muted/50 mx-auto text-center text-muted-foreground italic"}`}>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">{SENDER_LABEL[msg.sender] ?? msg.sender} · {new Date(msg.created_at).toLocaleTimeString()}</p>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          ))
                        )}
                        {t.category === "host_verification" && t.status !== "resolved" && (
                          <div className="flex items-center gap-2 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-muted-foreground flex-1">This is a host verification request.</span>
                            <Button size="sm" className="h-8 text-xs shrink-0" disabled={grantingHost === t.id} onClick={() => grantHostRole(t.id)}>
                              {grantingHost === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve as Host"}
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                          <Input value={replyInputs.get(t.id) ?? ""} onChange={(e) => setReplyInputs((prev) => { const next = new Map(prev); next.set(t.id, e.target.value); return next; })}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminReply(t.id); } }}
                            placeholder="Reply to user…" className="h-8 text-xs flex-1" disabled={sendingReply === t.id} />
                          <Button size="sm" className="h-8 text-xs" disabled={!replyInputs.get(t.id)?.trim() || sendingReply === t.id} onClick={() => sendAdminReply(t.id)}>
                            {sendingReply === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/ApplicationsPage.tsx src/pages/admin/TicketsPage.tsx
git commit -m "feat(admin): add ApplicationsPage and TicketsPage"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full typecheck**

```bash
npm run typecheck
```
Expected: 0 errors

- [ ] **Step 2: Run unit tests**

```bash
npm run test
```
Expected: all existing tests pass (navbar tests remain valid — public layout unchanged)

- [ ] **Step 3: Build check**

```bash
npm run build
```
Expected: successful build, no errors

- [ ] **Step 4: Manual smoke test — start dev server**

```bash
npm run dev
```

Verify:
- [ ] Public home page `/` → normal navbar + footer visible
- [ ] `/auth` → normal navbar visible, can sign in
- [ ] Logged in as host → navigate to `/host` → redirects to `/host/dashboard`
- [ ] `/host/dashboard` → sidebar visible, no top navbar, host sections appear
- [ ] Sidebar links: Dashboard, Calendar, New Listing, My Listings, Bookings, Vouchers, Wallet, Long-term Requests, Blackout Dates all navigate correctly
- [ ] Account section: My Bookings, Notifications, Support links work
- [ ] Mobile: sidebar collapses to Sheet drawer, `≡` button opens it
- [ ] Logged in as admin → `/admin` → redirects to `/admin/overview`
- [ ] Admin sidebar shows both Admin section and Host section (if also host)
- [ ] All admin sub-pages load without error
- [ ] Sign Out button in top bar works
- [ ] ThemeToggle, LanguageSwitcher, NotificationsModal work in top bar
- [ ] Navigating from sidebar to `/` shows public navbar again (layout switches correctly)
- [ ] Non-host user visiting `/host/dashboard` → redirects to `/host/apply`
- [ ] Non-admin visiting `/admin/overview` → redirects to `/`

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(layout): smoke test fixes"
```

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
  ShoppingBag, ClipboardList,
} from "lucide-react";

const adminItems = [
  { label: "Overview",        to: "/admin/overview",      icon: LayoutDashboard },
  { label: "Bookings",        to: "/admin/bookings",      icon: BookOpen },
  { label: "Applications",    to: "/admin/applications",  icon: ClipboardList },
  { label: "Support Tickets", to: "/admin/tickets",       icon: Headphones },
  { label: "Users",           to: "/admin/users",         icon: Users },
  { label: "Audit Log",       to: "/admin/audit",         icon: FileText },
  { label: "Disbursements",   to: "/admin/disbursements", icon: DollarSign },
];

const hostItems = [
  { label: "Dashboard",           to: "/host/dashboard",   icon: LayoutDashboard },
  { label: "Calendar",            to: "/host/calendar",    icon: CalendarDays },
  { label: "New Listing",         to: "/host/new-listing", icon: PlusCircle },
  { label: "My Listings",         to: "/host/listings",    icon: List },
  { label: "Bookings",            to: "/host/bookings",    icon: BookOpen },
  { label: "Vouchers",            to: "/host/vouchers",    icon: Ticket },
  { label: "Wallet",              to: "/host/wallet",      icon: Wallet },
  { label: "Long-term Requests",  to: "/host/requests",    icon: Clock },
  { label: "Blackout Dates",      to: "/host/blackouts",   icon: Ban },
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
        {admin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin Tools</SidebarGroupLabel>
            <SidebarMenu>
              {adminItems.map((item) => (
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
        )}

        {host && (
          <>
            {admin && <SidebarSeparator />}
            <SidebarGroup>
              <SidebarGroupLabel>Host Tools</SidebarGroupLabel>
              <SidebarMenu>
                {hostItems.map((item) => (
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
          </>
        )}

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

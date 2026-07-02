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

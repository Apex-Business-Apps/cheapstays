import { Suspense, lazy, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { ConsentGate } from "@/components/ConsentGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LegalDocumentPage } from "@/pages/legal/LegalDocumentPage";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const Search = lazy(() => import("./pages/Search"));
const Membership = lazy(() => import("./pages/Membership"));
const Host = lazy(() => import("./pages/Host"));
const HostApply = lazy(() => import("./pages/HostApply"));
const Support = lazy(() => import("./pages/Support"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Admin = lazy(() => import("./pages/Admin"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const MyBookings = lazy(() => import("./pages/MyBookings"));

const queryClient = new QueryClient();

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
          <Layout>
            <ConsentGate>
              <RouteAwareErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/membership" element={<Membership />} />
                  <Route path="/host" element={<Host />} />
                  <Route path="/host/apply" element={<HostApply />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/my-bookings" element={<MyBookings />} />
                  <Route path="/privacy" element={<LegalDocumentPage docKey="privacy" />} />
                  <Route path="/terms" element={<LegalDocumentPage docKey="terms" />} />
                  <Route path="/host-terms" element={<LegalDocumentPage docKey="host-terms" />} />
                  <Route path="/renter-rules" element={<LegalDocumentPage docKey="renter-rules" />} />
                  <Route path="/refunds" element={<LegalDocumentPage docKey="refunds" />} />
                  <Route path="/safety" element={<LegalDocumentPage docKey="safety" />} />
                  <Route path="/account-deletion" element={<LegalDocumentPage docKey="account-deletion" />} />
                  <Route path="/legal" element={<LegalDocumentPage docKey="legal" />} />
                  <Route path="/support-policy" element={<LegalDocumentPage docKey="support" />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/listing/:id" element={<ListingDetail />} />
                  <Route path="/listing/slug/:slug" element={<ListingDetail />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </RouteAwareErrorBoundary>
            </ConsentGate>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

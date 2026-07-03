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

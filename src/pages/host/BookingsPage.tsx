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

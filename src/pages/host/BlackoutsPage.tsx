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

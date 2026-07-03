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

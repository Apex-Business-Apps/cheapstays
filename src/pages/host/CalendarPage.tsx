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

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Seo } from "@/components/Seo";
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
import { OverviewTab } from "./OverviewTab";
import { CalendarTab } from "./CalendarTab";
import { TodayActivityTab } from "./TodayActivityTab";
import { AlertsTab } from "./AlertsTab";

export default function OverviewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <Seo title="Admin Overview · CheapStays" description="Admin overview." path="/admin/overview" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Overview</h1>
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="today">Today's Activity</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarTab onSelectBooking={setSelectedId} />
        </TabsContent>
        <TabsContent value="today">
          <TodayActivityTab onSelectBooking={setSelectedId} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab onSelectBooking={setSelectedId} />
        </TabsContent>
      </Tabs>
      <BookingDetailDrawer bookingId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}

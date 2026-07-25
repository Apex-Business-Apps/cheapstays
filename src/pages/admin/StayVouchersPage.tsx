import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { Seo } from "@/components/Seo";
import { AdminVoucherBatchForm } from "@/components/stay-vouchers/AdminVoucherBatchForm";
import { AdminVoucherBatchList } from "@/components/stay-vouchers/AdminVoucherBatchList";
import { AdminVoucherPurchasesTable } from "@/components/stay-vouchers/AdminVoucherPurchasesTable";

export default function StayVouchersPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Seo title="Voucher Deals · Admin" description="Manage prepaid stay vouchers." path="/admin/stay-vouchers" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Voucher deals</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]"><Plus className="h-4 w-4 mr-1" /> New batch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create voucher batch</DialogTitle></DialogHeader>
            <AdminVoucherBatchForm onSaved={() => { setReloadKey((k) => k + 1); setDialogOpen(false); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="batches">
        <TabsList className="mb-6">
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>
        <TabsContent value="batches">
          <Card className="p-5"><AdminVoucherBatchList reloadKey={reloadKey} /></Card>
        </TabsContent>
        <TabsContent value="purchases">
          <Card className="p-5"><AdminVoucherPurchasesTable /></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

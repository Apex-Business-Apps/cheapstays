// src/pages/admin/DisbursementsPage.tsx
import { AdminDisbursementPanel } from "@/components/wallet/AdminDisbursementPanel";
import { Seo } from "@/components/Seo";

export default function DisbursementsPage() {
  return (
    <>
      <Seo title="Disbursements · CheapStays Admin" description="Manage host disbursements." path="/admin/disbursements" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Disbursements</h1>
      <AdminDisbursementPanel />
    </>
  );
}

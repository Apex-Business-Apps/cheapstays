import { useAuth } from "@/hooks/useAuth";
import { HostVouchers } from "@/components/HostVouchers";
import { Seo } from "@/components/Seo";

export default function VouchersPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Seo title="Vouchers · CheapStays Host" description="Manage your vouchers." path="/host/vouchers" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Vouchers</h1>
      <HostVouchers hostId={user.id} />
    </>
  );
}

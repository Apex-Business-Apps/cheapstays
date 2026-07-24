import { Card } from "@/components/ui/card";
import { Seo } from "@/components/Seo";
import { HostRedeemForm } from "@/components/stay-vouchers/HostRedeemForm";

export default function RedeemStayVoucherPage() {
  return (
    <div className="max-w-lg mx-auto">
      <Seo title="Redeem voucher · CheapStays" description="Redeem a guest's voucher at check-in." path="/host/redeem-stay-voucher" />
      <h1 className="text-2xl font-semibold mb-1">Redeem voucher</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Enter the code the guest shows you at check-in. We'll create the booking and credit your wallet on the standard payout schedule.
      </p>
      <Card className="p-5">
        <HostRedeemForm />
      </Card>
    </div>
  );
}

import { Seo } from "@/components/Seo";
import { BecomePartner } from "@/components/homepage";

export default function BecomePartnerPage() {
  return (
    <div>
      <Seo
        title="Become a Partner · CheapStays"
        description="List your property on CheapStays — owner-direct payouts, verified guests, and real support. Apply to become a host partner."
        path="/become-a-partner"
      />
      <BecomePartner />
    </div>
  );
}

import { Seo } from "@/components/Seo";
import { CustomerSupport } from "@/components/homepage";

export default function CustomerSupportPage() {
  return (
    <div>
      <Seo
        title="Customer Support · CheapStays"
        description="Need help with a booking, payment, or your account? Reach the CheapStays support team — a real person will get back to you."
        path="/customer-support"
      />
      <CustomerSupport />
    </div>
  );
}

import { Seo } from "@/components/Seo";
import { PaymentsKpis } from "@/components/admin/payments/PaymentsKpis";
import { PaymentsFlowChart } from "@/components/admin/payments/PaymentsFlowChart";
import { PaymentsLedgerTable } from "@/components/admin/payments/PaymentsLedgerTable";
import { WalletHealthList } from "@/components/admin/payments/WalletHealthList";

export default function PaymentsPage() {
  return (
    <>
      <Seo title="Payments · CheapStays Admin" description="Money in, held, and out." path="/admin/payments" />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything the platform has collected, what&apos;s waiting in host wallets, and what has already been paid out.
        </p>
      </header>

      <div className="space-y-6">
        <PaymentsKpis />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PaymentsFlowChart />
          </div>
          <WalletHealthList />
        </div>

        <PaymentsLedgerTable />
      </div>
    </>
  );
}

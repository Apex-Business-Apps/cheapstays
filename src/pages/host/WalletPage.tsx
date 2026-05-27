import { HostWalletCard } from '@/components/wallet/HostWalletCard';
import { WalletTransactionList } from '@/components/wallet/WalletTransactionList';
import { PayoutAccountSettings } from '@/components/wallet/PayoutAccountSettings';

export function HostWalletPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
      <HostWalletCard />
      <PayoutAccountSettings />
      <WalletTransactionList />
    </div>
  );
}

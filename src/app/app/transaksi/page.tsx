import { PosTransactionsScreen } from "@/features/pos/components/pos-transactions-screen";

export default function TransactionsPage() {
  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Transaksi</h1>
        <p className="text-sm text-muted-foreground">
          Riwayat transaksi lokal dengan filter tanggal dan detail item expandable.
        </p>
      </header>
      <PosTransactionsScreen />
    </main>
  );
}

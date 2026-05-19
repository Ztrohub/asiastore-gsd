import { PosScreen } from "@/features/pos/components/pos-screen";

export default function PosPage() {
  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">POS</h1>
        <p className="text-sm text-muted-foreground">
          Cari produk, atur qty, dan checkout cepat dengan keyboard.
        </p>
      </header>
      <PosScreen />
    </main>
  );
}

import { PosScreen } from "@/features/pos/components/pos-screen";

export default function PosPage() {
  return (
    <main className="space-y-4 lg:flex lg:h-[calc(100dvh-7rem)] lg:min-h-0 lg:flex-col lg:overflow-hidden lg:space-y-3">
      <header className="space-y-1 lg:flex-none">
        <h1 className="text-2xl font-semibold">POS</h1>
        <p className="text-sm text-muted-foreground">
          Cari produk, atur qty, dan checkout cepat dengan keyboard.
        </p>
      </header>
      <PosScreen />
    </main>
  );
}

import { PosScreen } from "@/features/pos/components/pos-screen";

export default function PosPage() {
  return (
    <main className="space-y-4 xl:flex xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:flex-col xl:overflow-hidden xl:space-y-3">
      <header className="space-y-1 xl:flex-none">
        <h1 className="text-2xl font-semibold">POS</h1>
        <p className="text-sm text-muted-foreground">
          Cari produk, atur qty, dan checkout cepat dengan keyboard.
        </p>
      </header>
      <PosScreen />
    </main>
  );
}

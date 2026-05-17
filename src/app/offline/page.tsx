export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Mode Offline Aktif</h1>
      <p className="text-sm text-muted-foreground">
        Shell aplikasi tetap tersedia. Data yang butuh server akan diproses saat koneksi kembali.
      </p>
    </main>
  );
}

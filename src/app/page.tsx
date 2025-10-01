import QrScanner from '@/components/qr-scanner';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary">Ezra 출석체크</h1>
        <p className="text-muted-foreground md:text-lg">
          Manually enter codes or use a hardware scanner for attendance.
        </p>
      </div>
      <QrScanner />
    </div>
  );
}

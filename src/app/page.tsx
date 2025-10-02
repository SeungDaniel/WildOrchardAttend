import QrScanner from '@/components/qr-scanner'; 

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary">Wildorchard 출석체크</h1>
        <p className="text-muted-foreground md:text-lg">
          QR코드 인식은 'Camera' Tab을 이용해주세요.
        </p>
      </div>
      <QrScanner />
    </div>
  );
}

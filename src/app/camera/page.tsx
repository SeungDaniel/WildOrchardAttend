import CameraScanner from '@/components/camera-scanner';

export default function CameraPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6">
       <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary">Camera Scanner</h1>
        <p className="text-muted-foreground md:text-lg">
          팀장님의 스마트폰에 QR코드를 인식시켜주세요.
        </p>
      </div>
      <CameraScanner />
    </div>
  );
}

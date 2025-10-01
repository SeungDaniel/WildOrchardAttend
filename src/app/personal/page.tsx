import PersonalScanner from '@/components/personal-scanner';

export default function PersonalPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary">개인 모드</h1>
        <p className="text-muted-foreground md:text-lg">
          개인 Google Sheets에 출석 코드를 기록합니다.
        </p>
      </div>
      <PersonalScanner />
    </div>
  );
}

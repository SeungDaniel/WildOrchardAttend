"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle, XCircle, QrCode, Loader2, Info, Trash2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { saveScanAndNotify, clearScansAction } from "@/lib/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useExternalScanner } from "@/hooks/use-external-scanner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


type ScanStatus = "idle" | "success" | "duplicate" | "error" | "notifying";
type ScanResult = {
  status: ScanStatus;
  code: string | null;
  timestamp: string | null;
  message?: string;
  name?: string;
  sheetName?: string;
};

export default function QrScanner() {
  const [isClient, setIsClient] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult>({
    status: "idle",
    code: null,
    timestamp: null,
  });
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [wasLoading, setWasLoading] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (wasLoading && !isLoading) {
      inputRef.current?.focus();
    }
    setWasLoading(isLoading);
  }, [isLoading, wasLoading]);

  const handleScan = useCallback(async (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;
    
    if (code === ":" || code === ": -") {
        toast({
            title: "잘못된 코드 형식",
            description: "유효하지 않은 코드입니다. 키보드의 한/영 키를 확인해주세요.",
            variant: "destructive",
        });
        setManualCode("");
        return; 
    }

    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (koreanRegex.test(code)) {
        toast({
            title: "한글 입력 제한",
            description: "영문으로 입력해주세요. 키보드의 한/영 키를 확인해주세요.",
            variant: "destructive",
        });
        setManualCode("");
        return;
    }
    
    setIsLoading(true);
    setLastScan({ status: "idle", code: null, timestamp: null });
    
    const result = await saveScanAndNotify(code);
    const timestamp = new Date().toLocaleString();

    if (!result) {
      setLastScan({ status: "error", code: code, timestamp, message: "An unexpected error occurred. The server did not respond." });
      toast({
          variant: "destructive",
          title: "Error Saving Scan",
          description: "An unexpected error occurred. Please try again.",
      });
    } else if (result.success) {
        setLastScan({ status: "success", code: code, timestamp, message: result.notificationResult, name: result.name, sheetName: result.sheetName });
    } else if (result.isDuplicate) {
        setLastScan({ status: "duplicate", code: code, timestamp, name: result.name });
    } else {
        setLastScan({ status: "error", code: code, timestamp, message: result.error });
        toast({
            variant: "destructive",
            title: "스캔 저장 오류",
            description: result.error || "알 수 없는 오류가 발생했습니다.",
        });
    }
    
    setIsLoading(false);
    setManualCode("");
    
  }, [toast]);
  
  useExternalScanner(handleScan);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleScan(manualCode);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualCode(e.target.value);
  };
  
  const handleClearScans = async () => {
    setIsClearing(true);
    const result = await clearScansAction();
    if(result.success){
      toast({
        title: "기록 삭제 완료",
        description: "모든 출석 스캔 기록이 성공적으로 삭제되었습니다."
      })
      setLastScan({ status: "idle", code: null, timestamp: null });
    } else {
       toast({
        variant: "destructive",
        title: "오류",
        description: result.error || "기록 삭제 중 오류가 발생했습니다.",
      })
    }
    setIsClearing(false);
  }


  const ScanFeedback = () => {
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>처리 중...</span>
            </div>
        )
    }
    
    if (!lastScan.code || lastScan.status === "idle") {
      return (
        <div className="text-muted-foreground p-4">
          Enter a code or use a scanner.
        </div>
      );
    }

    const { status, code, timestamp, message, name, sheetName } = lastScan;
    let bgColor, borderColor, IconComponent, title, textColor;
    
    switch(status) {
        case 'success':
            bgColor = 'bg-green-100 dark:bg-green-900/50'; 
            borderColor = 'border-green-200 dark:border-green-800'; 
            textColor = 'text-green-800 dark:text-green-300';
            title = name ? `${name} 님 처리 완료` : '처리 완료';
            IconComponent = CheckCircle;
            break;
        case 'duplicate':
            bgColor = 'bg-yellow-100 dark:bg-yellow-900/50'; 
            borderColor = 'border-yellow-200 dark:border-yellow-800'; 
            IconComponent = XCircle; 
            textColor = 'text-yellow-800 dark:text-yellow-300'; 
            title = name ? `${name} 님은 이미 체크인 되었습니다` : '이미 체크인 되었습니다';
            break;
        case 'error':
            bgColor = 'bg-red-100 dark:bg-red-900/50'; borderColor = 'border-red-200 dark:border-red-800'; IconComponent = XCircle; textColor = 'text-red-800 dark:text-red-300'; title = '오류 발생';
            break;
        default: return null;
    }

    return (
      <div className={`p-4 rounded-lg transition-all duration-300 ease-in-out ${bgColor} ${borderColor} border animate-in fade-in`}>
        <div className="flex items-start gap-4">
          <IconComponent className={`h-8 w-8 ${textColor}`} />
          <div className="flex-1">
            <p className={`font-bold text-lg ${textColor}`}>{title}</p>
            <p className="text-sm text-muted-foreground">Code: <span className="font-mono">{code}</span></p>
             <p className="text-xs text-muted-foreground max-w-xs break-words">{sheetName ? `${sheetName} 시트에 기록되었습니다.` : message || timestamp}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-center flex items-center justify-center gap-2">
              <QrCode className="h-6 w-6"/>
              Manual & Hardware Scanner
          </CardTitle>
          <CardDescription className="text-center mt-1">
              Enter code and press Enter, or use a hardware scanner.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleManualSubmit}>
              <div className="flex gap-2">
                  <Input
                      ref={inputRef}
                      id="manual-code"
                      value={manualCode}
                      onChange={handleInputChange}
                      placeholder="e.g. USER-1234"
                      disabled={isLoading || !isClient}
                      className="text-lg"
                      autoComplete="off"
                  />
                  <Button type="submit" disabled={isLoading || !manualCode.trim()}>
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit"}
                  </Button>
              </div>
          </form>

          <div className="min-h-[110px] flex items-center justify-center rounded-lg bg-secondary">
              <ScanFeedback />
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 pt-0 p-6">
           <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  모든 스캔 기록 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 작업은 되돌릴 수 없습니다. Firestore 데이터베이스의 'scans' 컬렉션에 있는 모든 출석 기록이 영구적으로 삭제됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isClearing}>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearScans} disabled={isClearing}>
                    {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  도움말
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>초기 설정 안내</DialogTitle>
                  <DialogDescription>
                    앱이 정상적으로 작동하려면 다음 설정을 확인해야 합니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle className="font-bold">1. Google Sheets 공유 (가장 중요)</AlertTitle>
                        <AlertDescription>
                            <p className="mt-2">
                                출석 기록을 저장하려는 Google Sheet의 <b className="text-destructive">'공유'</b> 버튼을 누르고, 아래 이메일 주소를 <b className="text-destructive">'편집자(Editor)'</b>로 추가해야 합니다.
                            </p>
                            <p className="mt-2 font-mono bg-secondary text-foreground p-2 rounded-md break-all">
                                firebase-adminsdk-fbsvc@swiftattend-gu65t.iam.gserviceaccount.com
                            </p>
                        </AlertDescription>
                    </Alert>
                     <Alert variant="destructive">
                        <AlertTitle>2. Firestore 데이터베이스 생성</AlertTitle>
                        <AlertDescription>
                          출석 기록을 저장하려면 <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Firebase Console</a>에서 <b>프로젝트의 Firestore 데이터베이스를 생성</b>해야 합니다. (최초 1회)
                        </AlertDescription>
                    </Alert>
                     <Alert>
                        <AlertTitle>3. Google Sheets 'Users' 시트 구조</AlertTitle>
                        <AlertDescription>
                         Google Sheets에 <b>'Users'라는 이름의 시트</b>를 만들어야 합니다. 시트의 <b>A열에는 코드(Code)</b>, <b>B열에는 이름(Name)</b>을 입력해야 합니다.
                        </AlertDescription>
                    </Alert>
                     <Alert>
                        <AlertTitle>4. Firestore 색인 생성</AlertTitle>
                        <AlertDescription>
                         최초 스캔 시 'query requires an index' 오류가 발생하면, 오류 메시지에 포함된 링크를 클릭하여 <b>데이터베이스 색인을 생성</b>해야 합니다. (최초 1회)
                        </AlertDescription>
                    </Alert>
                </div>
              </DialogContent>
            </Dialog>
        </CardFooter>
      </Card>
    </>
  );
}

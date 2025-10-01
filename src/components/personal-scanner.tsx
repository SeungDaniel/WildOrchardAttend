
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Settings, CheckCircle, XCircle, Loader2, Save, WifiOff, Trash2, Camera, CameraOff } from "lucide-react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { saveToPersonalSheet } from "@/lib/actions";
import { useExternalScanner } from "@/hooks/use-external-scanner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
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


type ScanResult = {
  status: "idle" | "success" | "error" | "duplicate";
  message: string;
};

export default function PersonalScanner() {
  const [isClient, setIsClient] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useLocalStorage("personal_spreadsheetId", "");
  const [sheetName, setSheetName] = useLocalStorage("personal_sheetName", "");
  const [startRow, setStartRow] = useLocalStorage("personal_startRow", "1");
  
  const [submitterId, setSubmitterId] = useLocalStorage("personal_submitterId", "");
  const [submitterIdColumn, setSubmitterIdColumn] = useLocalStorage("personal_submitterIdColumn", "A");
  
  const [codeColumn, setCodeColumn] = useLocalStorage("personal_codeColumn", "B");
  const [timestampColumn, setTimestampColumn] = useLocalStorage("personal_timestampColumn", "C");

  const [isDuplicateCheck, setIsDuplicateCheck] = useLocalStorage("personal_isDuplicateCheck", true);
  const [scannedCodes, setScannedCodes] = useLocalStorage<string[]>("personal_scannedCodes", []);
  
  const [manualCode, setManualCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult>({ status: "idle", message: "코드를 입력하거나 스캐너를 사용하세요." });
  const { toast } = useToast();
  
  // Camera state
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim() || isLoading) return;

    if (!spreadsheetId.trim() || !sheetName.trim()) {
      toast({
        title: "설정 필요",
        description: "Google Sheets 설정을 먼저 완료해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!submitterId.trim()) {
      toast({
        title: "입력자 ID 필요",
        description: "입력자 ID를 먼저 입력해주세요.",
        variant: "destructive",
      });
      return;
    }


    setIsLoading(true);

    if (isDuplicateCheck && scannedCodes.includes(code)) {
      setLastScan({ status: "duplicate", message: `중복된 코드입니다: ${code}` });
      setIsLoading(false);
      setManualCode("");
      return;
    }
    
    const valuesToInsert = [];
    if (codeColumn.trim() && code.trim()) {
        valuesToInsert.push({ value: code, column: codeColumn });
    }
    if (submitterId.trim() && submitterIdColumn.trim()) {
        valuesToInsert.push({ value: submitterId, column: submitterIdColumn });
    }
    if (timestampColumn.trim()) {
        valuesToInsert.push({ value: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), column: timestampColumn });
    }

    if(valuesToInsert.length === 0) {
        toast({
            title: "설정 오류",
            description: "기록할 열이 하나 이상 지정되어야 합니다. (예: 코드 열)",
            variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    const result = await saveToPersonalSheet({
        spreadsheetId,
        sheetName,
        startRow: parseInt(startRow, 10) || 1,
        valuesToInsert
    });

    if (result.success) {
      setLastScan({ status: "success", message: result.message || "성공적으로 저장되었습니다." });
      if (isDuplicateCheck) {
        setScannedCodes(prev => [...prev, code]);
      }
    } else {
      setLastScan({ status: "error", message: result.error || "알 수 없는 오류가 발생했습니다." });
      toast({
        title: "오류",
        description: result.error,
        variant: "destructive",
      });
    }

    setIsLoading(false);
    setManualCode("");

  }, [spreadsheetId, sheetName, startRow, codeColumn, submitterId, submitterIdColumn, timestampColumn, isDuplicateCheck, scannedCodes, setScannedCodes, toast, isLoading]);
  
  useExternalScanner(handleScan);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScan(manualCode);
  };

  const handleClearDuplicates = () => {
    setScannedCodes([]);
    toast({
      title: "중복 기록 초기화 완료",
      description: "개인 모드의 중복 스캔 기록이 현재 브라우저에서 삭제되었습니다.",
    });
  };
  
    // Effect for handling camera logic
  useEffect(() => {
    const startCamera = async () => {
      if (isCameraMode && !streamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } });
          streamRef.current = stream;
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error("Error accessing camera:", error);
          setHasCameraPermission(false);
          toast({
            variant: "destructive",
            title: "카메라 접근 거부됨",
            description: "이 기능을 사용하려면 브라우저 설정에서 카메라 권한을 허용해주세요.",
          });
        }
      }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        setHasCameraPermission(null);
    };
    
    if (isCameraMode) {
        startCamera();
    } else {
        stopCamera();
    }

    return () => {
      // Cleanup on component unmount
      stopCamera();
    };
  }, [isCameraMode, toast]);

    // Effect for scanning QR code from video stream
  useEffect(() => {
    const tick = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animationFrameId.current = requestAnimationFrame(tick);
        return;
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data && !isLoading) {
          handleScan(code.data);
        }
      }
      animationFrameId.current = requestAnimationFrame(tick);
    };

    if(isCameraMode && hasCameraPermission){
        animationFrameId.current = requestAnimationFrame(tick);
    } else {
        if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }

    return () => {
      if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isCameraMode, hasCameraPermission, isLoading, handleScan]);


  const ScanFeedback = () => {
    const { status, message } = lastScan;
    let IconComponent;
    let textColor = "text-muted-foreground";

    switch(status) {
        case 'success':
            IconComponent = CheckCircle;
            textColor = 'text-green-600 dark:text-green-500';
            break;
        case 'duplicate':
        case 'error':
            IconComponent = XCircle;
            textColor = 'text-red-600 dark:text-red-500';
            break;
        case 'idle':
            return <p className="text-muted-foreground p-4 text-center">{message}</p>;
        default:
             IconComponent = CheckCircle;
    }

    return (
         <div className={cn('flex items-center gap-3 p-4 animate-in fade-in', textColor)}>
            <IconComponent className="h-5 w-5" />
            <p className="font-semibold">{message}</p>
        </div>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle>개인 모드 스캐너</CardTitle>
        <CardDescription>개인 Google Sheets에 코드를 기록합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              <Settings className="mr-2 h-4 w-4"/>
              Google Sheets 설정
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4 animate-in fade-in">
              <Alert>
                <WifiOff className="h-4 w-4"/>
                <AlertTitle>중요: 공유 설정</AlertTitle>
                <AlertDescription>
                   이 기능을 사용하려면 아래 서비스 계정 이메일을 대상 Google 시트의 **편집자**로 추가해야 합니다.
                   <p className="mt-2 font-mono bg-secondary text-foreground p-2 rounded-md break-all">
                        firebase-adminsdk-fbsvc@swiftattend-gu65t.iam.gserviceaccount.com
                   </p>
                </AlertDescription>
             </Alert>
             <div className="space-y-2">
                <Label htmlFor="spreadsheet-id">Google Spreadsheet ID</Label>
                <Input 
                    id="spreadsheet-id"
                    placeholder="스프레드시트 URL에서 복사"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    disabled={!isClient}
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="sheet-name">Sheet Name</Label>
                <Input 
                    id="sheet-name"
                    placeholder="기록할 시트의 이름"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    disabled={!isClient}
                />
            </div>

            <div className="border p-4 rounded-md space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="start-row">입력 시작행</Label>
                    <Input 
                        id="start-row"
                        type="number"
                        placeholder="e.g. 1"
                        value={startRow}
                        onChange={(e) => setStartRow(e.target.value)}
                        disabled={!isClient}
                        min="1"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="submitter-id">입력자 ID</Label>
                    <Input 
                        id="submitter-id"
                        placeholder="본인의 이름 또는 ID"
                        value={submitterId}
                        onChange={(e) => setSubmitterId(e.target.value)}
                        disabled={!isClient}
                    />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2 col-span-1">
                        <Label htmlFor="submitter-id-column">ID 열</Label>
                        <Input 
                            id="submitter-id-column"
                            type="text"
                            placeholder="A"
                            value={submitterIdColumn}
                            onChange={(e) => setSubmitterIdColumn(e.target.value.toUpperCase())}
                            disabled={!isClient}
                        />
                    </div>
                    <div className="space-y-2 col-span-1">
                        <Label htmlFor="code-column">코드 열</Label>
                        <Input 
                            id="code-column"
                            type="text"
                            placeholder="B"
                            value={codeColumn}
                            onChange={(e) => setCodeColumn(e.target.value.toUpperCase())}
                            disabled={!isClient}
                        />
                    </div>
                     <div className="space-y-2 col-span-1">
                        <Label htmlFor="timestamp-column">시간 열</Label>
                        <Input 
                            id="timestamp-column"
                            type="text"
                            placeholder="C"
                            value={timestampColumn}
                            onChange={(e) => setTimestampColumn(e.target.value.toUpperCase())}
                            disabled={!isClient}
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex items-center space-x-2">
                <Switch 
                    id="duplicate-check" 
                    checked={isDuplicateCheck}
                    onCheckedChange={setIsDuplicateCheck}
                    disabled={!isClient}
                />
                <Label htmlFor="duplicate-check">중복 코드 방지 (현재 브라우저 전용)</Label>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        <div className="space-y-4">
             <div className="flex items-center space-x-2">
                <Switch 
                    id="camera-mode" 
                    checked={isCameraMode}
                    onCheckedChange={setIsCameraMode}
                    disabled={!isClient}
                />
                <Label htmlFor="camera-mode">카메라 모드</Label>
            </div>
            
            {isCameraMode && (
                 <div className="relative aspect-video w-full bg-secondary rounded-lg overflow-hidden flex items-center justify-center">
                    {hasCameraPermission === null && (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin"/>
                            <p>Requesting camera...</p>
                        </div>
                    )}
                    {hasCameraPermission === false && (
                         <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
                            <CameraOff className="h-8 w-8"/>
                            <p className="font-bold">Camera Access Denied</p>
                            <p className="text-xs">Please allow camera access in your browser settings.</p>
                        </div>
                    )}
                    <video ref={videoRef} className={cn("w-full h-full object-cover", { 'hidden': !hasCameraPermission })} autoPlay playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    {!isLoading && hasCameraPermission &&(
                        <div className="absolute inset-0 border-4 border-primary/50 rounded-lg animate-pulse"></div>
                    )}
                </div>
            )}
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
                <Label htmlFor="personal-code">코드 입력</Label>
                 <div className="flex gap-2">
                    <Input
                        id="personal-code"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="스캔 또는 직접 입력"
                        disabled={isLoading || !isClient}
                        autoComplete="off"
                    />
                    <Button type="submit" disabled={isLoading || !manualCode.trim()}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save />}
                    </Button>
                </div>
            </div>
        </form>

        <div className="min-h-[72px] flex items-center justify-center rounded-lg bg-secondary">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>저장 중...</span>
            </div>
          ) : (
            <ScanFeedback />
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-4 pt-0 p-6">
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  중복 기록 초기화
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>정말로 초기화하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 작업은 되돌릴 수 없습니다. 이 브라우저에 저장된 개인 모드의 중복 스캔 기록이 모두 삭제됩니다. 다른 기기나 브라우저에는 영향을 주지 않습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearDuplicates}>
                    초기화
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
      </CardFooter>
    </Card>
  );
}

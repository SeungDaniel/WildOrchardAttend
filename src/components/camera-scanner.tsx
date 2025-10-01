
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { CheckCircle, XCircle, Loader2, CameraOff, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { saveScanAndNotify } from "@/lib/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ScanStatus = "idle" | "success" | "duplicate" | "error";
type ScanResult = {
  status: ScanStatus;
  code: string | null;
  timestamp: string | null;
  message?: string;
  name?: string;
};

export default function CameraScanner() {
  const [lastScan, setLastScan] = useState<ScanResult>({ status: "idle", code: null, timestamp: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
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
    };

    if (!streamRef.current) {
        getCameraPermission();
    } else {
        setHasCameraPermission(true);
        if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }
    
    return () => {
        // Only stop the camera when the user navigates away from the page entirely
        const handleBeforeUnload = () => {
             if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // This inner return is for the component unmount, but we don't stop the stream here anymore
        // to keep it active between tab navigations. It will be stopped by beforeunload.
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }
  }, [toast]);

  const handleScan = useCallback(async (scannedCode: string) => {
    const code = scannedCode.trim();
    if (isProcessing || !code) return;

    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (koreanRegex.test(code)) {
        toast({
            title: "한글 입력 제한",
            description: "영문으로 입력해주세요. 키보드의 한/영 키를 확인해주세요.",
            variant: "destructive",
        });
        return;
    }

    setIsProcessing(true);
    
    if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
    }

    const result = await saveScanAndNotify(code);
    const timestamp = new Date().toLocaleString();
    
    if (!result) {
      setLastScan({ status: "error", code: code, timestamp, message: "An unexpected error occurred." });
    } else if (result.success) {
      setLastScan({ status: "success", code: code, timestamp, message: result.notificationResult || "출석이 기록되었습니다.", name: result.name });
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
    
    processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
    }, 700);

  }, [isProcessing, toast]);

  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animationFrameId = requestAnimationFrame(tick);
        return;
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data && !isProcessing) {
          handleScan(code.data);
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    if(hasCameraPermission){
        animationFrameId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
      }
    };
  }, [hasCameraPermission, isProcessing, handleScan]);


  const ScanFeedback = () => {
    if (isProcessing) {
        return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-5 w-5 animate-spin" /><span>처리 중...</span></div>;
    }
    if (!lastScan.code || lastScan.status === "idle") {
      return <div className="text-muted-foreground p-4">Point the camera at a QR code.</div>;
    }

    const { status, code, timestamp, message, name } = lastScan;
    let bgColor, IconComponent, title, textColor;
    switch(status) {
        case 'success':
            bgColor = 'bg-green-100 dark:bg-green-900/50'; textColor = 'text-green-800 dark:text-green-300'; title = name ? `${name} 님 처리 완료` : '처리 완료'; IconComponent = CheckCircle;
            break;
        case 'duplicate':
            bgColor = 'bg-yellow-100 dark:bg-yellow-900/50'; textColor = 'text-yellow-800 dark:text-yellow-300'; title = name ? `${name} 님은 이미 체크인 되었습니다` : '이미 체크인 되었습니다'; IconComponent = XCircle;
            break;
        case 'error':
            bgColor = 'bg-red-100 dark:bg-red-900/50'; textColor = 'text-red-800 dark:text-red-300'; title = '오류 발생'; IconComponent = XCircle;
            break;
        default: return null;
    }

    return (
      <div className={cn('p-4 rounded-lg transition-all duration-300 ease-in-out w-full', bgColor, 'animate-in', 'fade-in')}>
        <div className="flex items-start gap-4">
          <IconComponent className={cn('h-8 w-8', textColor)} />
          <div className="flex-1">
            <p className={cn('font-bold text-lg', textColor)}>{title}</p>
            <p className="text-sm text-muted-foreground">Code: <span className="font-mono">{code}</span></p>
            <p className="text-xs text-muted-foreground max-w-xs break-words">{message || timestamp}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-6 space-y-4">
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
                {!isProcessing && (
                    <div className="absolute inset-0 border-4 border-primary/50 rounded-lg animate-pulse"></div>
                )}
            </div>
             <div className="min-h-[110px] flex items-center justify-center rounded-lg bg-secondary">
              <ScanFeedback />
            </div>
        </CardContent>
    </Card>
  );
}

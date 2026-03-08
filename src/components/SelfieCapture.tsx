import { useState, useRef, useCallback } from "react";
import { Camera, RotateCcw, ScanFace, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelfieCaptureProps {
  onCapture: (imageData: string) => void;
  isProcessing: boolean;
}

const SelfieCapture = ({ onCapture, isProcessing }: SelfieCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setCameraError(null);
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCaptured(dataUrl);
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  if (!consented) {
    return (
      <div className="glass-card p-6 md:p-8 max-w-md mx-auto animate-fade-up">
        <div className="flex flex-col items-center text-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground">
            Reconocimiento facial
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Para encontrar tus fotos, necesitamos tomar una selfie y compararla con las fotos del evento. 
            Tu imagen se usa únicamente para la búsqueda y <strong className="text-foreground">no se almacena</strong>.
          </p>
          <Button
            onClick={() => {
              setConsented(true);
              startCamera();
            }}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display"
          >
            <ScanFace className="mr-2 h-4 w-4" />
            Acepto, buscar mis fotos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 md:p-6 max-w-md mx-auto animate-fade-up">
      <canvas ref={canvasRef} className="hidden" />

      {cameraError ? (
        <div className="text-center py-8">
          <p className="text-destructive text-sm mb-4">{cameraError}</p>
          <Button variant="outline" onClick={startCamera}>
            Reintentar
          </Button>
        </div>
      ) : captured ? (
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden aspect-[4/3]">
            <img src={captured} alt="Tu selfie" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={retake} className="flex-1 border-border text-foreground hover:bg-secondary">
              <RotateCcw className="mr-2 h-4 w-4" />
              Repetir
            </Button>
            <Button
              onClick={() => onCapture(captured)}
              disabled={isProcessing}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-display"
            >
              {isProcessing ? (
                <>
                  <ScanFace className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <ScanFace className="mr-2 h-4 w-4" />
                  Buscar mis fotos
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-secondary">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-56 border-2 border-primary/50 rounded-[40%] animate-pulse-gold" />
            </div>
          </div>
          <Button
            onClick={capturePhoto}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display"
          >
            <Camera className="mr-2 h-4 w-4" />
            Tomar foto
          </Button>
        </div>
      )}
    </div>
  );
};

export default SelfieCapture;

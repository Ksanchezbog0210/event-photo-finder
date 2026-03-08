import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, ImageIcon, ScanFace, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import SelfieCapture from "@/components/SelfieCapture";
import PhotoResultCard from "@/components/PhotoResultCard";
import PaymentModal from "@/components/PaymentModal";
import WatermarkImage from "@/components/WatermarkImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Photo = Database["public"]["Tables"]["event_photos"]["Row"];

interface MatchedPhoto extends Photo {
  publicUrl: string;
  matchScore: number;
}

type ViewState = "gallery" | "selfie" | "results";

const EventPage = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [event, setEvent] = useState<Event | null>(null);
  const [photos, setPhotos] = useState<(Photo & { publicUrl: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>("gallery");
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchedPhotos, setMatchedPhotos] = useState<MatchedPhoto[]>([]);
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [purchaseRequestId, setPurchaseRequestId] = useState<string | null>(null);
  const [freePhotoId, setFreePhotoId] = useState<string | null>(null);
  const [freePhotoUsed, setFreePhotoUsed] = useState(false);

  // Load free photo state from localStorage
  useEffect(() => {
    if (!eventId) return;
    const key = `plusspaz_free_${eventId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.used) {
        setFreePhotoUsed(true);
        setFreePhotoId(null);
      } else {
        setFreePhotoId(parsed.photoId);
        setFreePhotoUsed(false);
      }
    }
  }, [eventId]);

  const saveFreePhoto = (photoId: string) => {
    if (!eventId) return;
    const key = `plusspaz_free_${eventId}`;
    localStorage.setItem(key, JSON.stringify({ photoId, used: false }));
    setFreePhotoId(photoId);
    setFreePhotoUsed(false);
  };

  const markFreePhotoUsed = () => {
    if (!eventId) return;
    const key = `plusspaz_free_${eventId}`;
    localStorage.setItem(key, JSON.stringify({ photoId: freePhotoId, used: true }));
    setFreePhotoUsed(true);
    setFreePhotoId(null);
  };

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const { data: evt } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    if (!evt) {
      toast.error("Evento no encontrado");
      navigate("/");
      return;
    }
    setEvent(evt);

    const { data: eventPhotos } = await supabase
      .from("event_photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (eventPhotos) {
      const withUrls = eventPhotos.map((p) => {
        const { data } = supabase.storage.from("event-photos").getPublicUrl(p.storage_path);
        return { ...p, publicUrl: data.publicUrl };
      });
      setPhotos(withUrls);
    }
    setLoading(false);
  }, [eventId, navigate]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Poll for purchase approval
  useEffect(() => {
    if (!purchaseRequestId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("purchase_requests")
        .select("status, photo_ids")
        .eq("id", purchaseRequestId)
        .maybeSingle();
      if (data?.status === "approved") {
        const approvedIds = (data.photo_ids as string[]) || [];
        setPurchasedIds((prev) => {
          const next = new Set(prev);
          approvedIds.forEach((id) => next.add(id));
          return next;
        });
        toast.success("¡Pago aprobado! Ya puedes descargar tus fotos.");
        setPurchaseRequestId(null);
      } else if (data?.status === "rejected") {
        toast.error("Solicitud rechazada. Contacta al fotógrafo.");
        setPurchaseRequestId(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [purchaseRequestId]);

  const handleCapture = async (imageData: string) => {
    setIsProcessing(true);
    try {
      // Extract base64 data from data URL
      const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");

      const { data, error } = await supabase.functions.invoke("face-match", {
        body: { selfieBase64: base64, eventId },
      });

      if (error) {
        console.error("Face match error:", error);
        toast.error("Error al buscar tus fotos. Intenta de nuevo.");
        setIsProcessing(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setIsProcessing(false);
        return;
      }

      const matches: { photoId: string; score: number }[] = data?.matches || [];

      if (matches.length === 0) {
        toast.info("No encontramos coincidencias. Intenta con otra selfie con mejor iluminación.");
        setIsProcessing(false);
        setView("selfie");
        return;
      }

      // Map matches to photo data
      const results: MatchedPhoto[] = matches
        .map((m) => {
          const photo = photos.find((p) => p.id === m.photoId);
          if (!photo) return null;
          return { ...photo, matchScore: m.score };
        })
        .filter((r): r is MatchedPhoto => r !== null);

      // Assign free photo: use stored one if exists, otherwise first result
      if (!freePhotoUsed && !freePhotoId && results.length > 0) {
        saveFreePhoto(results[0].id);
      }

      setMatchedPhotos(results);
      setIsProcessing(false);
      setView("results");
      toast.success(`¡Encontramos ${results.length} foto${results.length !== 1 ? "s" : ""} donde apareces!`);
    } catch (err) {
      console.error("Face match exception:", err);
      toast.error("Error de conexión. Intenta de nuevo.");
      setIsProcessing(false);
    }
  };

  const handlePurchaseRequest = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      if (prev.includes(photoId)) return prev;
      return [...prev, photoId];
    });
    setPaymentModal(true);
  };

  const handlePaymentConfirmed = async (clientName: string, clientPhone: string, proofFile: File | null) => {
    if (!event || selectedPhotoIds.length === 0) return;
    
    let proofPath: string | null = null;
    
    // Upload proof file if provided
    if (proofFile) {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, proofFile);
      
      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Error al subir el comprobante");
        return;
      }
      proofPath = fileName;
    }
    
    const { data, error } = await supabase.from("purchase_requests").insert({
      event_id: event.id,
      photo_ids: selectedPhotoIds,
      client_name: clientName,
      client_phone: clientPhone,
      total_amount: selectedPhotoIds.length * Number(event.price_per_photo),
      currency: event.currency,
      payment_method: "sinpe",
      payment_proof_path: proofPath,
    }).select("id").single();

    if (error) {
      toast.error("Error al enviar solicitud");
      return;
    }
    setPurchaseRequestId(data.id);
    setPaymentModal(false);
    toast.success("Solicitud enviada. El fotógrafo verificará tu pago y aprobará la descarga.");

    // Notify admin via email (fire and forget)
    supabase.functions.invoke("notify-purchase", {
      body: { purchaseRequestId: data.id },
    }).catch((err) => console.error("Notification error:", err));
  };

  const handleDownload = async (photo: MatchedPhoto, isFree: boolean) => {
    const response = await fetch(photo.publicUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = photo.original_filename || `plusspaz-${photo.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (isFree) {
      markFreePhotoUsed();
      toast.success("¡Foto gratis descargada!");
    } else {
      toast.success("Foto descargada");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 pb-12">
        <div className="container max-w-5xl">
          {/* Event Header */}
          <div className="mb-8 animate-fade-up">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">{event.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(event.date).toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}
              </span>
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" />
                {photos.length} fotos
              </span>
            </div>
          </div>

          {/* Gallery View */}
          {view === "gallery" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Galería del evento</h2>
                {photos.length > 0 && (
                  <Button onClick={() => setView("selfie")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-display gold-glow">
                    <ScanFace className="mr-2 h-4 w-4" />
                    Encontrar mis fotos
                  </Button>
                )}
              </div>
              {photos.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">El fotógrafo aún no ha subido fotos a este evento.</p>
                </div>
              ) : (
                <div className="photo-grid">
                  {photos.map((photo, i) => (
                    <WatermarkImage key={photo.id} src={photo.publicUrl} alt={`Foto ${i + 1}`} className="aspect-square" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selfie View */}
          {view === "selfie" && (
            <div className="max-w-md mx-auto space-y-4">
              <button onClick={() => setView("gallery")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Volver a la galería
              </button>
              <SelfieCapture onCapture={handleCapture} isProcessing={isProcessing} />
            </div>
          )}

          {/* Results View */}
          {view === "results" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">Tus resultados</h2>
                  <p className="text-sm text-muted-foreground">
                    {matchedPhotos.length} foto{matchedPhotos.length !== 1 ? "s" : ""} encontrada{matchedPhotos.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setView("selfie")} className="border-border text-foreground hover:bg-secondary font-display">
                  <ScanFace className="mr-2 h-4 w-4" />
                  Buscar de nuevo
                </Button>
              </div>

              {purchaseRequestId && (
                <div className="glass-card p-4 border-primary/30 animate-pulse-gold">
                  <p className="text-sm text-primary font-display flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Esperando aprobación del fotógrafo...
                  </p>
                </div>
              )}

              <div className="photo-grid">
                {matchedPhotos.map((photo, i) => {
                  const isThisFree = !freePhotoUsed && photo.id === freePhotoId;
                  return (
                    <PhotoResultCard
                      key={photo.id}
                      src={photo.publicUrl}
                      matchScore={photo.matchScore}
                      index={i}
                      isFree={isThisFree}
                      isPurchased={purchasedIds.has(photo.id)}
                      pricePerPhoto={Number(event.price_per_photo)}
                      onRequestPurchase={() => handlePurchaseRequest(photo.id)}
                      onDownload={() => handleDownload(photo, isThisFree)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <PaymentModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        photoCount={selectedPhotoIds.length}
        totalAmount={selectedPhotoIds.length * Number(event.price_per_photo)}
        sinpePhone="89406622"
        onConfirm={handlePaymentConfirmed}
      />
    </div>
  );
};

export default EventPage;
